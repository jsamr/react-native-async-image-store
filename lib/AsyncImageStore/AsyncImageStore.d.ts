import { AsyncImageStoreConfig, ImageSource, URIEvent, URIEventListener } from './types';
export declare type Target = string | ImageSource;
export declare class AsyncImageStore {
    private name;
    private fetcher;
    private state;
    private mounted;
    private config;
    constructor(name: string, userConfig: Partial<AsyncImageStoreConfig>);
    private onPreload;
    private onRevalidate;
    private onDelete;
    private logReport;
    private log;
    private dispatchCommandToURI;
    private dispatchCommandToAll;
    private dispatchCommandWhen;
    private assertMountInvariant;
    /**
     * Mount the Store, restoring cache metadata from storage.
     *
     * **Suggestion**: Mount this Store during your application initialization, ideally in the root component, where you can display a splashscreen or an activity indicator while
     * it happens.
     */
    mount(): Promise<void>;
    /**
     * Release the Store.
     *
     * **Suggestion**: Unmount the Store in your root component, in `componentWillUnmount` method, **which you can declare `async`**.
     *
     * **Info**: Carefully consuming lifecycle methods is mandatory to prevent memory leaks. Note that cache metadata is persisted on change.
     */
    unmount(): Promise<void>;
    /**
     * Inform if Store is mounted
     */
    isMounted(): boolean;
    /**
     * Add a listener which gets called every time the cache model associated with the given
     * uri resource change.
     *
     * @param uri
     * @param listener
     * @return The most-recent `URIEvent` associated with the given URI.
     * If this URI has not been registered yet, the return event will be of type `URI_INIT`.
     */
    addCacheUpdateListener(uri: string, listener: URIEventListener): URIEvent;
    /**
     * Remove a previously registered listener.
     *
     * @param uri
     * @param listener
     */
    removeCacheUpdateListener(uri: string, listener: URIEventListener): void;
    /**
     * Asynchronously preload the provided image to Store.
     *
     * **Info** This function will revalidate an image which has already been preloaded, and download unconditionnaly otherwise.
     *
     * @param target string URI or React `ImageURISource` prop
     * @return A Promise resolving to the next `URIEvent`
     */
    preloadImage(target: Target): Promise<URIEvent>;
    /**
     * Asynchronously preload the list of images to Store.
     *
     * **Info** This function will revalidate images which are already preloaded, and download the others.
     *
     * @param targets an array of string URI or React `ImageURISource` prop
     * @return A Promise resolving to an array of `URIEvent`
     */
    preloadImages(targets: Target[]): Promise<URIEvent[]>;
    /**
     * Delete an existing image from the Store.
     * Does nothing if the provided URI have no matching entry in Store.
     *
     * @param target
     */
    deleteImage(target: Target): Promise<URIEvent>;
    /**
     * Delete all images from the Store.
     */
    deleteAllImages(): Promise<URIEvent[]>;
    /**
     * Delete all image which are stale from the Store.
     */
    deleteAllStaleImages(): Promise<URIEvent[]>;
    /**
     * Asynchronously revalidate a stored image:
     *
     * - **if it was previously registered** and
     * - **if it is staled**
     *
     * **Info**: Revalidation is done with:
     *
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     *
     * **Warning** This method does nothing on a resource which has not been registered,
     * i.e. to which `preload` has not been called at least once.
     *
     * @param target string URI or React `ImageURISource` prop
     * @return A Promise resolving to the next `URIEvent`
     */
    revalidateImage(target: Target): Promise<URIEvent>;
    /**
     * Revalidate all stale images in the store.
     *
     * **Info**: Revalidation is done with:
     *
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     */
    revalidateAllStaleImages(): Promise<URIEvent[]>;
}
export declare function getStoreByName(name: string): AsyncImageStore | null;
export declare function createStore(name: string, userConfig?: AsyncImageStoreConfig): AsyncImageStore;
