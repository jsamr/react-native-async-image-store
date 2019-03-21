import { AsyncImageStoreConfig, ProgressCallback, StateInterface, URICacheFileState, URICacheModel, URICacheRegistry, URICacheState, URICacheSyncState, URICommandType, URIEvent, URIEventListener, URIPatch } from "../interfaces";
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
export declare class State implements StateInterface {
    private config;
    private storeName;
    private reactors;
    private listeners;
    private lastEvents;
    private registryListeners;
    private cacheStore;
    constructor(config: AsyncImageStoreConfig, storeName: string);
    private getListenersForURI;
    private notifyURIListeners;
    private getURILens;
    initURIModel(uri: string): void;
    addRegistryUpdateListener(listener: RegistryUpdateListener): void;
    updateURIModel(uri: string, patch: URIPatch | null): Promise<void>;
    updateNetworkModel(networkAvailable: boolean): Promise<void>;
    registerCommandReactor<C extends string, P>(commandName: C, reactor: Reactor): void;
    getURIModel(uri: string): URICacheModel;
    getLocalPathFromURI(uri: string): string;
    getBaseDir(): string;
    getTempFilenameFromURI(uri: string): string;
    addListener(uri: string, listener: URIEventListener): URIEvent;
    removeListener(uri: string, listener: URIEventListener): void;
    getLastURIEvent(uri: string): URIEvent;
    dispatchCommand(uri: string, commandType: URICommandType, payload?: any): Promise<URIEvent>;
    dispatchCommandToAll(commandType: URICommandType, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]>;
    dispatchCommandWhen(commandType: URICommandType, predicate: (state: URICacheState) => boolean, payload?: any, onProgress?: ProgressCallback): Promise<URIEvent[]>;
    mount(initialRegistry: URICacheRegistry | null): Promise<void>;
    unmount(): Promise<void>;
}
