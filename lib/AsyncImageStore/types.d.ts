export interface AsyncImageStoreConfig {
    /**
     * Log events to the console
     *
     * **Default**: `false`
     */
    debug: boolean;
    /**
     *
     * This value will be used when no `Cache-control: max-age` directive or `Expires` header have been given in the image response.
     * `Infinity` can be used to denote an **immutable**, never-expire image default policy.
     *
     * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
     *
     * **Default**: `84000` seconds (1 day)
     */
    defaultMaxAge: number;
    /**
     * This value will override any `Cache-control: max-age` directive or `Expires` header in the image response.
     * `Infinity` can be used to denote an **immutable**, never-expire policy.
     *
     * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
     *
     * **Default**: `undefined` (don't override)
     */
    overrideMaxAge?: number;
    /**
     * A `class` which produces `StorageInterface` instances.
     * This class is used to instanciate a storage instance which get called to persist meta-info updates.
     *
     * **Default**: The default implementation uses `AsyncStorage`
     *
     * @see StorageInstance
     * @see StorageConstructor
     * @see URICacheRegistry
     *
     */
    Storage?: StorageConstructor<any>;
}
export interface StorageInstance {
    load(): Promise<URICacheRegistry | null>;
    save(registry: URICacheRegistry): Promise<void>;
    clear(): Promise<void>;
}
export declare type StorageConstructor<C extends StorageInstance = StorageInstance> = new (name: string) => C;
export interface HTTPHeaders {
    [n: string]: string;
}
export interface ImageSource {
    uri: string;
    headers?: HTTPHeaders;
}
export interface URIVersionTag {
    type: 'ETag' | 'LastModified';
    value: string;
}
export declare type URICommandType = 'PRELOAD' | 'REVALIDATE' | 'DELETE';
export declare type URICacheFileState = 'UNAVAILABLE' | 'FRESH' | 'STALE';
export declare type URICacheSyncState = 'IDLE_SUCCESS' | 'IDLE_ERROR' | 'FETCHING' | 'REFRESHING' | 'DELETED';
export declare type CacheNetworkState = 'AVAILABLE' | 'UNAVAILABLE';
export interface URICacheModel {
    uri: string;
    headers?: {
        [key: string]: string;
    };
    registered: boolean;
    fileExists: boolean;
    expired: boolean;
    fetching: boolean;
    path: string;
    localURI: string;
    versionTag: URIVersionTag | null;
    error: Error | null;
}
export declare type URIEventType = 'NETWORK_UPDATE' | 'URI_UPDATE' | 'URI_INIT';
export declare type URIPatch = Partial<URICacheModel>;
export interface URIEvent {
    type: URIEventType;
    nextModel: URICacheModel;
    nextState: URICacheState;
}
export declare type URIEventListener = (event: URIEvent) => Promise<void> | void;
export interface URICacheState {
    fileState: URICacheFileState;
    syncState: URICacheSyncState;
    networkState: CacheNetworkState;
}
export interface URICacheRegistry {
    [uri: string]: URICacheModel;
}
