import {
  URICacheModel,
  URIEvent,
  URICommandType,
  URICacheFileState,
  URICacheSyncState,
  URICacheState,
  URIEventListener,
  URIEventType,
  URIPatch,
  URICacheRegistry,
  ProgressCallback,
  AsyncImageStoreConfig } from '@src/interfaces'
import { mergePath } from 'ramda-adjunct'
import { lensPath, lensProp, set, equals, view, assocPath } from 'ramda'
import pdebounce from 'p-debounce'
import pthrottle from 'p-throttle'

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

export const DEBOUNCE_DELAY = 500

export class State {
  private reactors: Map<string, Reactor> = new Map()
  private listeners: Map<string, Set<URIEventListener>> = new Map()
  private lastEvents: Map<string, URIEvent> = new Map()
  private registryListeners: Set<RegistryUpdateListener> = new Set()

  private cacheStore: CacheStore = {
    networkAvailable: true,
    registry: {}
  }

  constructor(config: AsyncImageStoreConfig) {
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

  /**
   * 
   * @param uri Initialize the URI model if unregistered.
   */
  public initURIModel(uri: string) {
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

  /**
   * Add a hook on registry updates.
   * 
   * **Info**: updates are debounced every 400ms, and limitted to one running promise per listener.
   * 
   * @param listener 
   */
  public addRegistryUpdateListener(listener: RegistryUpdateListener) {
    const debouncedListener = pdebounce(listener, DEBOUNCE_DELAY)
    this.registryListeners.add(debouncedListener)
  }

  /**
   * Asynchronously update the given URI model.
   * 
   * @param uri
   * @param patch 
   * @param type 
   */
  public async updateURIModel(uri: string, patch: URIPatch|null): Promise<void> {
    const path = ['registry', uri]
    const uriLens = lensPath(path)
    const viewURI = view(uriLens)
    const next: CacheStore = patch ?
        mergePath(path as any, patch, this.cacheStore) as CacheStore :
        assocPath(path, null, this.cacheStore)
    if (!equals(viewURI(next), viewURI(this.cacheStore))) {
      this.cacheStore = next
      await this.notifyURIListeners(uri, viewURI(next) as URICacheModel)
    }
  }

  public async updateNetworkModel(networkAvailable: boolean): Promise<void> {
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

  /**
   * Register a function which will be called when an event is dispatched to a specific URI.
   * 
   * @param commandName
   * @param reactor 
   */
  public registerCommandReactor<C extends string, P>(commandName: C, reactor: Reactor) {
    this.reactors.set(commandName, reactor)
  }

  public getURIModel(uri: string): URICacheModel {
    const lens = this.getURILens(uri)
    return view(lens, this.cacheStore)
  }

  /**
   * Asynchronously add a listener and return a promise resolving to the last event associated with the given URI.
   * If no URI has been registered yet, the returned event is of type `URI_INIT`.
   * 
   * @param uri 
   * @param listener 
   * @return A `URIEvent` containing the last state and model associated with this URI.
   */
  public addListener(uri: string, listener: URIEventListener): URIEvent {
    const listeners = this.getListenersForURI(uri)
    const lastEvent = this.getLastURIEvent(uri)
    listeners.add(listener)
    return lastEvent
  }

  /**
   * Remove a listener.
   * 
   * @param uri 
   * @param listener 
   */
  public removeListener(uri: string, listener: URIEventListener) {
    const listeners = this.getListenersForURI(uri)
    listeners.delete(listener)
  }

  public getLastURIEvent(uri: string): URIEvent {
    const lastEvent = this.lastEvents.get(uri)
    if (!lastEvent) {
      this.initURIModel(uri)
    }
    return this.lastEvents.get(uri) as URIEvent
  }

    /**
     * Dispatch a command to be applied to given URI.
     * The returned promise resolves when the command has been applied.
     * 
     * @param uri 
     * @param commandType 
     * @param payload 
     */
  public async dispatchCommand(uri: string, commandType: URICommandType, payload?: any): Promise<URIEvent> {
    const reactor = this.reactors.get(commandType)
    const lastEvent = this.getLastURIEvent(uri)
    if (reactor) {
      await reactor(lastEvent, (...args) => this.updateURIModel(uri, ...args), payload)
      return this.getLastURIEvent(uri)
    }
    return lastEvent
  }

    /**
     * Dispatch a command to all registered URIs.
     * 
     * @param commandType
     * @param payload
     * @param onProgress
     */
  public async dispatchCommandToAll(commandType: URICommandType, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]> {
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

    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandType
     * @param predicate 
     * @param payload
     * @param onProgress
     */
  public async dispatchCommandWhen(commandType: URICommandType, predicate: (state: URICacheState) => boolean, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]> {
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

  public async mount(initialRegistry: URICacheRegistry|null): Promise<void> {
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

  public async unmount(): Promise<void> {
    for (const [_uri, listener] of this.listeners) {
      listener.clear()
    }
    this.registryListeners.clear()
  }
}
