import invariant from 'invariant'
import { AsyncImageStoreConfig, AsyncStorageModel, CacheEventCallback, SecuredImageSource, CacheEvent, RequestReport, CacheInfo, CacheEventType } from './types'
import { Fetcher } from './Fetcher'
import { EventEmitter } from './EventEmitter';
import { FileLocator } from './FileLocator';
import { Platform } from 'react-native';
import { func } from 'prop-types';

const storesMap: Map<string, AsyncImageStore> = new Map()

const defaultConfig: AsyncImageStoreConfig = {
    defaultMaxAge: 86000,
    followNoStore: false
}

const FILE_PREFIX = Platform.OS === 'ios' ? '' : 'file://';

function getSourceFromUri(target: string|SecuredImageSource): SecuredImageSource {
    if (typeof target === 'string') {
        return { uri: target }
    }
    return target
}

function getCacheInfoFromReport({ path, expires, versionTag }: RequestReport): CacheInfo {
    return {
        path,
        expires,
        versionTag
    }
}

export class AsyncImageStore {
    private model: AsyncStorageModel
    private fetcher: Fetcher
    private eventEmitter: EventEmitter
    private fileLocator: FileLocator

    constructor(private name: string, userConfig: Partial<AsyncImageStoreConfig>) {
        invariant(name !== "", 'AsyncImageStore: store name cannot be empty.')
        invariant(!storesMap.has(name), 'AsyncImageStore: only one instance per storeName is allowed.')
        storesMap.set(name, this)
        const config = {
            ...defaultConfig,
            ...userConfig
        }
        this.model = {
            cachePolicy: {
                ...config,
                mustRevalidate: true
            },
            cacheRegistry: {}
        }
        this.fetcher = new Fetcher(name)
        this.eventEmitter = new EventEmitter()
        this.fileLocator = new FileLocator(name)
    }

    private getLocalURI(path: string) {
        return FILE_PREFIX + path
    }

    private makeCacheEventFromReport({ uri, path, versionTag }: RequestReport, type: CacheEventType): CacheEvent {
        return {
            type,
            uri,
            path,
            versionTag,
            localURI: this.getLocalURI(path),
        }
    }

    private getCacheInfo(uri: string): CacheInfo|undefined {
        return this.model.cacheRegistry[uri]
    }
    /**
     * Add a listener which gets called every time the state of the given
     * uri resource change in cache.
     * 
     * @param uri 
     * @param listener 
     */
    public addCacheEventListener(uri: string, listener: CacheEventCallback) {
        this.eventEmitter.addListener(uri, listener)
    }

    /**
     * Remove a previously registered listener.
     * 
     * @param uri
     * @param listener 
     */
    public removeCacheEventListener(uri: string, listener: CacheEventCallback) {
        this.eventEmitter.removeListener(uri, listener)
    }

    /**
     * Preload the provided image to Store.
     * If the provided image exists in store and is stale, this function
     * behaves like `revalidateImage`.
     * 
     * @param target string URI or React ImageURISource prop
     * @returns A promise
     */
    public async preloadImage(target: string|SecuredImageSource): Promise<CacheEvent> {
        const source = getSourceFromUri(target)
        const { uri } = source
        const cacheInfo = this.getCacheInfo(uri)
        if (cacheInfo) {
            return this.revalidateImage(uri)
        }
        this.eventEmitter.dispatch({ uri, type: 'PRELOADING' })
        const report = await this.fetcher.saveImage(source)
        let event: CacheEvent
        if (!report.error) {
            event = this.makeCacheEventFromReport(report, 'AVAILABLE')
            this.model.cacheRegistry[uri] = getCacheInfoFromReport(report)
        } else {
           event = this.makeCacheEventFromReport(report, 'ERROR')
        }
        this.eventEmitter.dispatch(event)
        return event
    }

    public async preloadImages(uri: string[]) {

    }

    public async deleteImage(target: string|SecuredImageSource) {

    }

    /**
     * Revalidate a stored image
     * 
     * - **if it was previously registered** and
     * - **if it is staled**
     * 
     * Otherwise do nothing.
     * 
     * @param target
     */
    public async revalidateImage(target: string|SecuredImageSource): Promise<CacheEvent|null> {
        const source = getSourceFromUri(target)
        const cacheInfo = this.getCacheInfo(source.uri)
        if (!cacheInfo || cacheInfo.expires > new Date().getTime()) {   
            return null
        }
        // Get appropriate headers
        const source: SecuredImageSource = {
            ...source,
            headers: {
                ...source.headers
            }
        }
        await this.fetcher.saveImage()
        return {} as any
    }

    public async revalidateAllStaleImages() {

    }

    public async removeAllImages() {

    }

    public async removeAllStaleImages() {

    }
}

export function getStoreByName(name: string): AsyncImageStore|null {
    return storesMap.get(name) || null
}