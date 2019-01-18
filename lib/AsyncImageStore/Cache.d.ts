import { VersionTag } from './types';
export interface CacheInfo {
    expires: number;
    path: string;
    versionTag: VersionTag | null;
}
export interface CacheModel {
    uri: string;
    headers?: {
        [key: string]: string;
    };
    registered: boolean;
    networkAvailable: boolean;
    fileExists: boolean;
    expired: boolean;
    fetching: boolean;
    path: string;
    localURI: string;
    versionTag: VersionTag | null;
    error: Error | null;
}
/**
 * A dictionnary were keys are uris, and values expire time, in milliseconds since epoch.
 */
export declare type CacheRegistry = {
    [uri: string]: CacheInfo;
};
export declare type CacheFileState = 'UNAVAILABLE' | 'FRESH' | 'STALE';
export declare type CacheSyncState = 'IDLE_SUCCESS' | 'IDLE_ERROR' | 'FETCHING' | 'REFRESHING';
export interface CacheFileStateUpdateEvent {
    type: 'FILE_STATE_UPDATE';
    uri: string;
    state: CacheFileState;
    path: string;
    localURI: string;
    versionTag: VersionTag | null;
}
export interface CacheSyncStateUpdateEvent {
    type: 'SYNC_STATE_UPDATE';
    state: CacheSyncState;
    uri: string;
    error: Error | null;
}
export declare type Patch = Partial<CacheModel> | null;
export declare type ProposeFunction = (patch: Patch) => void;
export declare type Reactor = (model: CacheStateUpdateEvent, propose: ProposeFunction, payload?: any) => Promise<void>;
export interface Command<C extends string> {
    payload?: any;
    name: C;
    onResolve: () => void;
}
export declare function deriveFileStateFromModel(model: CacheModel): CacheFileState;
export declare function deriveSyncStateFromModel(model: CacheModel): CacheSyncState;
export declare type CacheStateUpdateEvent = {
    model: CacheModel;
    fileState: CacheFileState;
    syncState: CacheSyncState;
};
export declare type CacheEventCallback = (event: CacheStateUpdateEvent) => Promise<void>;
export declare class Cache {
    private initialModels;
    private lastEvents;
    private pendingSubs;
    private networkAvailable$;
    private commands;
    private events;
    private callbacks;
    private reactors;
    private networkAvailable;
    constructor(initialModels: Map<string, CacheModel>);
    private mapModelToUpdateEvent;
    private onNetinfo;
    private getEventsForURI;
    private getCommandsForURI;
    attach(): Promise<void>;
    detach(): Promise<void>;
    addListener(uri: string, callback: CacheEventCallback): void;
    removeListener(uri: string, callback: CacheEventCallback): void;
    registerCommandReactor<C extends string, P>(commandName: C, reactor: Reactor): void;
    /**
     * Dispatch a command to be applied to given URI.
     * The returned promise resolves when the command has been applied.
     *
     * @param uri
     * @param commandName
     * @param payload
     */
    dispatchCommand<C extends string>(uri: string, commandName: C, payload?: any): Promise<CacheStateUpdateEvent>;
    /**
     * Dispatch a command to all registered URIs.
     *
     * @param commandName The name of the command to dispatch.
     */
    dispatchCommandToAll<C extends string>(commandName: C): Promise<CacheStateUpdateEvent[]>;
    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandName
     * @param predicate
     */
    dispatchCommandWhen<C extends string>(commandName: C, predicate: (state: CacheStateUpdateEvent) => boolean): Promise<CacheStateUpdateEvent[]>;
    /**
     *
     * @param uri The URI to test.
     * @returns null if the URI has never been registered, CacheModelUpdateEvent otherwise
     */
    getLastModelUpdateEvent(uri: string): null | CacheStateUpdateEvent;
    /**
     * Free all resources associated with URI.
     *
     * @param uri
     */
    detatchURI(uri: string): void;
}
