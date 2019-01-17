import { ImageURISource } from "react-native";

export interface AsyncImageStoreConfig {
    /**
     * 
     * This value will be used when no `Cache-control: max-age` directive or `Expires` header has been given in the image response.
     * `Infinity` can be used to denote a "never expiring cache" default policy.
     * 
     * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
     */
    defaultMaxAge: number
    /**
     * This value will override any `Cache-control: max-age` directive or `Expires` header in the image response.
     * `Infinity` can be used to denote a "never expiring cache" policy.
     *
     * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
     */
    overrideMaxAge?: number
    /**
     * Folow `no-store` cache-control directives.
     * 
     * **Warning**: This is not recommanded unless explicitly understood as it defies the purpose of this library.
     */
    followNoStore: boolean
}

export interface CachePolicy extends AsyncImageStoreConfig {
    mustRevalidate: boolean
}

export interface AsyncStorageModel {
    cachePolicy: CachePolicy
    cacheRegistry: CacheRegistry
}

export interface CacheInfo {
    expires: number
    path: string
    versionTag: VersionTag|null
}

/**
 * A dictionnary were keys are uris, and values expire time, in milliseconds since epoch.
 */
export type CacheRegistry = {
    [uri: string]: CacheInfo
}

export type CacheEventType = 'AVAILABLE' | 'ERROR' | 'STALE' | 'REVALIDATING' | 'DELETED' | 'PRELOADING'

export interface BaseCacheEvent {
    type: CacheEventType
    uri: string
}

export interface PreloadCacheEvent extends BaseCacheEvent {
    type: 'PRELOADING'
}

export interface ErrorCacheEvent extends BaseCacheEvent {
    type: 'ERROR'
    path: string
    localURI: string
}

export interface StandardCacheEvent extends BaseCacheEvent {
    path: string
    localURI: string
    versionTag: VersionTag | null
}

export type CacheEvent = PreloadCacheEvent | ErrorCacheEvent | StandardCacheEvent

export type CacheEventCallback = (event: CacheEvent) => void

export interface VersionTag {
    type: 'ETag' | 'LastModified'
    value: string
}

export interface RequestReport {
    uri: string
    expires: number
    error: boolean
    versionTag: VersionTag | null
    path: string
}

export type SecuredImageSource = ImageURISource & { uri: string }