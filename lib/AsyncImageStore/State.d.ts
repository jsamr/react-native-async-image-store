import { URICacheModel, URIEvent, URICommandType, URICacheFileState, URICacheSyncState, URICacheState, URIEventListener, URIPatch, URICacheRegistry } from './types';
import { defaultConfig } from './default-config';
export declare type ProposeFunction = (patch: Partial<URICacheModel> | null) => void;
export declare type Reactor = (event: URIEvent, propose: ProposeFunction, payload?: any) => Promise<void>;
export declare type RegistryUpdateListener = (reg: URICacheRegistry) => Promise<void>;
export interface CacheStore {
    networkAvailable: boolean;
    registry: URICacheRegistry;
}
export declare function deriveFileStateFromModel(model: URICacheModel): URICacheFileState;
export declare function deriveSyncStateFromModel(model: URICacheModel): URICacheSyncState;
export declare function getURIStateFromModel(model: URICacheModel | null, networkAvailable: boolean): URICacheState;
export declare function getInitialURICacheModel(uri: string): URICacheModel;
export declare const DEBOUNCE_DELAY = 500;
export declare class State {
    private name;
    private config;
    private reactors;
    private listeners;
    private lastEvents;
    private registryListeners;
    private cacheStore;
    constructor(name: string, config?: typeof defaultConfig);
    private getListenersForURI;
    private notifyURIListeners;
    private getURILens;
    /**
     *
     * @param uri Initialize the URI model if unregistered.
     */
    initURIModel(uri: string): void;
    /**
     * Add a hook on registry updates.
     *
     * **Info**: updates are debounced every 400ms, and limitted to one running promise per listener.
     *
     * @param listener
     */
    addRegistryUpdateListener(listener: RegistryUpdateListener): void;
    /**
     * Asynchronously update the given URI model.
     *
     * @param uri
     * @param patch
     * @param type
     */
    updateURIModel(uri: string, patch: URIPatch | null): Promise<void>;
    updateNetworkModel(networkAvailable: boolean): Promise<void>;
    /**
     * Register a function which will be called when an event is dispatched to a specific URI.
     *
     * @param commandName
     * @param reactor
     */
    registerCommandReactor<C extends string, P>(commandName: C, reactor: Reactor): void;
    getURIModel(uri: string): URICacheModel;
    /**
     * Asynchronously add a listener and return a promise resolving to the last event associated with the given URI.
     * If no URI has been registered yet, the returned event is of type `URI_INIT`.
     *
     * @param uri
     * @param listener
     * @return A `URIEvent` containing the last state and model associated with this URI.
     */
    addListener(uri: string, listener: URIEventListener): URIEvent;
    /**
     * Remove a listener.
     *
     * @param uri
     * @param listener
     */
    removeListener(uri: string, listener: URIEventListener): void;
    getLastURIEvent(uri: string): URIEvent;
    /**
     * Dispatch a command to be applied to given URI.
     * The returned promise resolves when the command has been applied.
     *
     * @param uri
     * @param commandType
     * @param payload
     */
    dispatchCommand(uri: string, commandType: URICommandType, payload?: any): Promise<URIEvent>;
    /**
     * Dispatch a command to all registered URIs.
     *
     * @param commandType
     * @param payload?
     * @param onProgress?
     */
    dispatchCommandToAll(commandType: URICommandType, payload?: any, onProgress?: (event: URIEvent) => void): Promise<URIEvent[]>;
    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandType
     * @param predicate
     * @param payload?
     * @param onProgress?
     */
    dispatchCommandWhen(commandType: URICommandType, predicate: (state: URICacheState) => boolean, payload?: any, onProgress?: (event: URIEvent) => void): Promise<URIEvent[]>;
    mount(initialRegistry: URICacheRegistry | null): Promise<void>;
    unmount(): Promise<void>;
}
