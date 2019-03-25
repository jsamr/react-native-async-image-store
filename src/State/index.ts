import {
    AsyncImageStoreConfig,
    ProgressCallback,
    StateInterface,
    URICacheFileState,
    URICacheModel,
    URICacheRegistry,
    URICacheState,
    URICacheSyncState,
    URICommandType,
    URIEvent,
    URIEventListener,
    URIEventType,
    URIPatch
} from '@src/interfaces'
import { mergePath } from 'ramda-adjunct'
import { equals, lensPath, lensProp, set, view, dissocPath, clone } from 'ramda'
import pdebounce from 'p-debounce'
import pthrottle from 'p-throttle'
import RNFetchBlob from 'rn-fetch-blob'
import { Buffer } from 'buffer'
import invariant from 'invariant'

export type ProposeFunction = (patch: Partial<URICacheModel>|null) => void
export type Reactor = (event: URIEvent, propose: ProposeFunction, payload?: any) => Promise<void>
export type RegistryUpdateListener = (reg: URICacheRegistry) => Promise<void>
export interface CacheStore {
  networkAvailable: boolean
  registry: URICacheRegistry
}

export function deriveFileStateFromModel(model: URICacheModel): URICacheFileState {
  const expired = model.expired
  if (model.fileExists) {
    return expired ? 'STALE' : 'FRESH'
  }
  return 'UNAVAILABLE'
}

export function deriveSyncStateFromModel(model: URICacheModel): URICacheSyncState {
  if (model.fetching) {
    if (!model.fileExists) {
      return 'FETCHING'
    }
    if (!model.expired) {
      return 'REFRESHING'
    }
  }
  return model.error ? 'IDLE_ERROR' : 'IDLE_SUCCESS'
}

export function getURIStateFromModel(model: URICacheModel|null, networkAvailable: boolean): URICacheState {
  return {
    fileState: model ? deriveFileStateFromModel(model) : 'UNAVAILABLE',
    syncState: model ? deriveSyncStateFromModel(model) : 'DELETED',
    networkState: networkAvailable ? 'AVAILABLE' : 'UNAVAILABLE'
  }
}

export function getInitialURICacheModel(uri: string): URICacheModel {
  return {
    uri,
    error: null,
    expired: true,
    fetching: false,
    fileExists: false,
    localURI: '',
    path: '',
    registered: false,
    versionTag: null
  }
}

const initialCacheStore = {
  networkAvailable: true,
  registry: {}
}

export const DEBOUNCE_DELAY = 500

export class State implements StateInterface {
  private reactors: Map<string, Reactor> = new Map()
  private listeners: Map<string, Set<URIEventListener>> = new Map()
  private lastEvents: Map<string, URIEvent> = new Map()
  private registryListeners: Set<RegistryUpdateListener> = new Set()

  private cacheStore: CacheStore = clone(initialCacheStore)

  constructor(private config: AsyncImageStoreConfig, private storeName: string) {
    this.updateURIModel = this.updateURIModel.bind(this)
    this.updateNetworkModel = this.updateNetworkModel.bind(this)
    // Throttle dispatch commands to prevent I/O and CPU obstruction
    // 10 operations / second seems like a sane limit
    this.dispatchCommand = pthrottle(this.dispatchCommand.bind(this), config.ioThrottleFrequency, 1000)
  }

  private getListenersForURI(uri: string) {
    let listeners = this.listeners.get(uri)
    if (!listeners) {
      listeners = new Set()
      this.listeners.set(uri, listeners)
    }
    return listeners
  }

  private async notifyURIListeners(uri: string, nextModel: URICacheModel, type: URIEventType = 'URI_UPDATE') {
    const listeners = this.getListenersForURI(uri)
    const nextState = getURIStateFromModel(nextModel, this.cacheStore.networkAvailable)
    const nextEvent: URIEvent = {
      type,
      nextModel,
      nextState
    }
    this.lastEvents.set(uri, nextEvent)
    for (const listener of listeners) {
      const resp = listener(nextEvent)
      resp && await resp
    }
    for (const listener of this.registryListeners) {
      // Calls are limited to one after the other, preventing parallel
      // Storage.save calls.
      await listener(this.cacheStore.registry)
    }
  }

  private getURILens(uri: string) {
    const path = ['registry', uri]
    return lensPath(path)
  }

  initURIModel(uri: string) {
    if (!this.lastEvents.get(uri)) {
      const lens = this.getURILens(uri)
      this.cacheStore = set(lens, getInitialURICacheModel(uri))(this.cacheStore)
      const nextModel: URICacheModel = view(lens)(this.cacheStore) as URICacheModel
      const nextState = getURIStateFromModel(nextModel, this.cacheStore.networkAvailable)
      const nextEvent: URIEvent = {
        nextModel,
        nextState,
        type: 'URI_INIT'
      }
      this.lastEvents.set(uri, nextEvent)
    }
  }

  addRegistryUpdateListener(listener: RegistryUpdateListener) {
    const debouncedListener = pdebounce(listener, DEBOUNCE_DELAY)
    this.registryListeners.add(debouncedListener)
  }

  async updateURIModel(uri: string, patch: URIPatch | null): Promise<void> {
    const path = ['registry', uri]
    const uriLens = lensPath(path)
    const viewURI = view(uriLens)
    const next: CacheStore = patch ?
            mergePath(path as any, patch, this.cacheStore) as CacheStore :
            dissocPath(path, this.cacheStore)
    if (!equals(viewURI(next), viewURI(this.cacheStore))) {
      this.cacheStore = next
      await this.notifyURIListeners(uri, viewURI(next) as URICacheModel)
    }
    if (patch === null) {
      // remove event entry
      this.lastEvents.delete(uri)
    }
  }

  async updateNetworkModel(networkAvailable: boolean): Promise<void> {
    const networkLens = lensProp('networkAvailable')
    if (networkAvailable !== this.cacheStore.networkAvailable) {
      this.cacheStore = set(networkLens, networkAvailable, this.cacheStore)
      for (const uri of Object.keys(this.cacheStore.registry)) {
        const lens = this.getURILens(uri)
        const actual = view(lens, this.cacheStore) as URICacheModel
        await this.notifyURIListeners(uri, actual, 'NETWORK_UPDATE')
      }
    }
  }

  registerCommandReactor<C extends string, P>(commandName: C, reactor: Reactor) {
    this.reactors.set(commandName, reactor)
  }

  getURIModel(uri: string): URICacheModel {
    const lens = this.getURILens(uri)
    return view(lens, this.cacheStore)
  }

  getLocalPathFromURI(uri: string): string {
    const pathLens = lensProp('path')
    const pathFromURI = view(pathLens, this.getURIModel(uri)) as string
    invariant(pathFromURI !== undefined, 'the fetched URI has no matching model in registry')
    return pathFromURI
  }

  getBaseDir() {
    const dir = this.config.fsKind === 'CACHE' ?
          RNFetchBlob.fs.dirs.CacheDir :
          RNFetchBlob.fs.dirs.DocumentDir
    return `${dir}/${this.storeName}`
  }

  getTempFilenameFromURI(uri: string) {
    return `${this.getBaseDir()}/${Buffer.from(uri).toString('base64')}`
  }

  addListener(uri: string, listener: URIEventListener): URIEvent {
    const listeners = this.getListenersForURI(uri)
    const lastEvent = this.getLastURIEvent(uri)
    listeners.add(listener)
    return lastEvent
  }

  removeListener(uri: string, listener: URIEventListener) {
    const listeners = this.getListenersForURI(uri)
    listeners.delete(listener)
  }

  getLastURIEvent(uri: string): URIEvent {
    const lastEvent = this.lastEvents.get(uri)
    if (!lastEvent) {
      this.initURIModel(uri)
    }
    return this.lastEvents.get(uri) as URIEvent
  }

  async dispatchCommand(uri: string, commandType: URICommandType, payload?: any): Promise<URIEvent> {
    const reactor = this.reactors.get(commandType)
    const lastEvent = this.getLastURIEvent(uri)
    if (reactor) {
      await reactor(lastEvent, (...args) => this.updateURIModel(uri, ...args), payload)
      return this.getLastURIEvent(uri)
    }
    return lastEvent
  }

  async dispatchCommandToAll(commandType: URICommandType, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]> {
    const events: URIEvent[] = []
    const properties = Object.getOwnPropertyNames(this.cacheStore.registry)
    let i = 0
    for (const uri of properties) {
      const nextEvent = await this.dispatchCommand(uri, commandType, payload)
      events.push(nextEvent)
      onProgress && onProgress(nextEvent, i, properties.length)
      i = i + 1
    }
    return events
  }

  async dispatchCommandWhen(commandType: URICommandType, predicate: (state: URICacheState) => boolean, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]> {
    const events: URIEvent[] = []
    const applicableEvents = Array.from(this.lastEvents.values()).filter(e => predicate(e.nextState))
    let i = 0
    for (const event of applicableEvents) {
      const nextEvent = await this.dispatchCommand(event.nextModel.uri, commandType, payload)
      events.push(nextEvent)
      onProgress && onProgress(nextEvent, i, applicableEvents.length)
      i = i + 1
    }
    return events
  }

  async mount(initialRegistry: URICacheRegistry | null): Promise<void> {
    if (initialRegistry) {
      this.cacheStore.registry = initialRegistry
      for (const uri of Object.getOwnPropertyNames(initialRegistry)) {
        const model = initialRegistry[uri]
        const state = getURIStateFromModel(model, this.cacheStore.networkAvailable)
        const event: URIEvent = {
          nextModel: model,
          nextState: state,
          type: 'URI_INIT'
        }
        this.lastEvents.set(uri, event)
      }
    }
  }

  async unmount(): Promise<void> {
    for (const [_uri, listener] of this.listeners) {
      listener.clear()
    }
    this.registryListeners.clear()
  }
}
