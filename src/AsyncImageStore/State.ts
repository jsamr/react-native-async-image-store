import { URICacheModel, URIEvent, URICommandType, URICacheFileState, URICacheSyncState, URICacheState, URIEventListener , URIEventType, URIPatch } from './types'
import { mergePath } from 'ramda-adjunct'
import { lensPath, lensProp, set, equals, view, partial } from 'ramda'

export type ProposeFunction = (patch: Partial<URICacheModel>) => void

export type Reactor = (event: URIEvent, propose: ProposeFunction, payload?: any) => Promise<void>

export interface URICacheRegistry {
  [uri: string]: URICacheModel
}

export interface CacheStore {
  networkAvailable: boolean
  uriStates: URICacheRegistry
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

export function getURIStateFromModel(model: URICacheModel, networkAvailable: boolean): URICacheState {
  return {
    fileState: deriveFileStateFromModel(model),
    syncState: deriveSyncStateFromModel(model),
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

export class State {
  private reactors: Map<string, Reactor> = new Map()
  private listeners: Map<string, Set<URIEventListener>> = new Map()
  private lastEvents: Map<string, URIEvent> = new Map()
  private cacheStore: CacheStore = {
    networkAvailable: true,
    uriStates: {}
  }

  constructor() {
    this.updateURIModel = this.updateURIModel.bind(this)
    this.updateNetworkModel = this.updateNetworkModel.bind(this)
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
  }

  private getURILens(uri: string) {
    const path = ['uriStates', uri]
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
   * Asynchronously update the given URI model.
   * 
   * @param uri
   * @param patch 
   * @param type 
   */
  public async updateURIModel(uri: string, patch: URIPatch): Promise<void> {
    const path = ['uriStates', uri]
    const uriLens = lensPath(path)
    const next: CacheStore = mergePath(path as any, patch, this.cacheStore) as CacheStore
    const viewURI = view(uriLens)
    if (!equals(viewURI(next), viewURI(this.cacheStore))) {
      this.cacheStore = next
      await this.notifyURIListeners(uri, viewURI(next) as URICacheModel)
    }
  }

  public async updateNetworkModel(networkAvailable: boolean): Promise<void> {
    const networkLens = lensProp('networkAvailable')
    if (networkAvailable !== this.cacheStore.networkAvailable) {
      this.cacheStore = set(networkLens, networkAvailable, this.cacheStore)
      // tslint:disable-next-line:forin
      for (const uri in Object.keys(this.cacheStore.uriStates)) {
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
      await reactor(lastEvent, partial(this.updateURIModel, [uri]) as any, payload)
      return this.getLastURIEvent(uri)
    }
    return lastEvent
  }

    /**
     * Dispatch a command to all registered URIs.
     * 
     * @param commandType
     * @param payload? 
     */
  public async dispatchCommandToAll(commandType: URICommandType, payload?: any): Promise<URIEvent[]> {
    const events: URIEvent[] = []
    for (const uri of Object.getOwnPropertyNames(this.cacheStore.uriStates)) {
      events.push(await this.dispatchCommand(uri, commandType, payload))
    }
    return events
  }

    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandType
     * @param predicate 
     */
  public async dispatchCommandWhen(commandType: URICommandType, predicate: (state: URICacheState) => boolean, payload?: any): Promise<URIEvent[]> {
    const events: URIEvent[] = []
    for (const [uri, event] of this.lastEvents) {
      if (predicate(event.nextState)) {
        events.push(await this.dispatchCommand(uri, commandType))
      }
    }
    return events
  }

  public async mount(): Promise<void> {
        //
  }

  public async unmount(): Promise<void> {
    for (const [_uri, listener] of this.listeners) {
      listener.clear()
    }
  }
}
