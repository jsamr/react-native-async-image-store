import invariant from 'invariant'
import {
    AsyncImageStoreConfig,
    ImageSource,
    URIPatch,
    URIEvent,
    HTTPHeaders,
    URICacheState,
    URIEventListener,
    URICommandType,
    StorageDriverInterface,
    ProgressCallback,
    RequestReport
} from '@src/interfaces'
import { IODriver } from '@src/drivers/IODriver'
import { Platform } from 'react-native'
import { State, ProposeFunction } from '@src/State'
import { defaultConfig } from '@src/default-config'

export type Target = string|ImageSource

const storesMap: Map<string, AsyncImageStore> = new Map()

// TODO investigate
const FILE_PREFIX = Platform.OS === 'ios' ? '' : 'file://'

function getSourceFromUri(target: Target): ImageSource {
  if (typeof target === 'string') {
    return { uri: target }
  }
  return target
}

function reportToProposal(report: RequestReport): URIPatch {
  const { path, versionTag, expires } = report
  return {
    path,
    versionTag,
    localURI: FILE_PREFIX + path,
    expired: expires < new Date().getTime(),
    fetching: false,
    error: report.error,
    fileExists: report.error === null
  }
}

/**
 * This method allow config values to be JSON-stringified and persisted.
 * It converts `Infinity` to `Number.MAX_SAFE_INTEGER`.
 * 
 * @param config 
 */
function normalizeUserConf(config: Partial<AsyncImageStoreConfig>): Partial<AsyncImageStoreConfig> {
  const newConf = {
    ...config
  }
  if (config.defaultMaxAge === Infinity) {
    newConf.defaultMaxAge = Number.MAX_SAFE_INTEGER
  }
  if (config.overrideMaxAge === Infinity) {
    newConf.overrideMaxAge = Number.MAX_SAFE_INTEGER
  }
  return newConf
}

export class AsyncImageStore {
  private iodriver: IODriver
  private state: State
  private mounted: boolean = false
  private config: AsyncImageStoreConfig
  private storage: StorageDriverInterface

  constructor(private name: string, userConfig: Partial<AsyncImageStoreConfig>) {
    invariant(name !== '', 'AsyncImageStore: store name cannot be empty.')
    invariant(!storesMap.has(name), 'AsyncImageStore: only one instance per storeName is allowed.')
    storesMap.set(name, this)
    const config = {
      ...defaultConfig,
      ...normalizeUserConf(userConfig)
    } as AsyncImageStoreConfig
    this.config = config
    this.iodriver = new IODriver(name, config)
    this.state = new State(config)
    this.storage = new config.StorageDriver(name)
    this.state.registerCommandReactor('PRELOAD', this.onPreload.bind(this))
    this.state.registerCommandReactor('REVALIDATE', this.onRevalidate.bind(this))
    this.state.registerCommandReactor('DELETE', this.onDelete.bind(this))
  }

  private async onPreload(event: URIEvent, propose: ProposeFunction, headers?: HTTPHeaders): Promise<void> {
    const { nextModel: model, nextState: state } = event
    const { uri } = model
    if (state.fileState === 'FRESH') {
      this.log(`File from origin ${uri} is FRESH; ignoring preloading.`)
      return
    }
    if (state.fileState === 'STALE') {
      return this.onRevalidate(event, propose, headers)
    }
    if (state.networkState === 'UNAVAILABLE') {
      this.log(`File from origin ${uri} cannot be preloaded: network is unavailable.`)
      propose({ error: new Error('Network is unavailable.') })
      return
    }
    const preloadProposal: URIPatch = { fetching: true, registered: true, error: null }
    if (headers) {
      preloadProposal.headers = headers
    }
    propose(preloadProposal)
    const report = await this.iodriver.saveImage(model)
    propose(reportToProposal(report))
    this.logReport(report, uri)
  }

  private async onRevalidate(event: URIEvent, propose: ProposeFunction, headers?: HTTPHeaders): Promise<void> {
    const { nextModel: model, nextState: state } = event
    let revalidate = false
    if (!model.registered) {
      this.log(`File with origin ${model.uri} is unregistered; preload must be invoked first; ignoring revalidation.`)
      return
    }
    const exists = await this.iodriver.imageExists(model)
    if (exists === false) {
      propose({ fileExists: false })
      if (state.networkState === 'AVAILABLE') {
        this.log(`File from origin ${model.uri} does not exists anymore. Revalidating...`)
        revalidate = true
      } else {
        this.log(`File from origin ${model.uri} does not exists anymore but network is unavailable. ignoring revalidation.`)
      }
    } else {
      if (state.fileState === 'FRESH') {
        this.log(`File from origin ${model.uri} is FRESH and file exists, revalidation succeeded.`)
      }
      if (state.fileState === 'STALE' && state.networkState === 'UNAVAILABLE') {
        this.log(`File from origin ${model.uri} is STALE and file exists, but network is not available; ignoring revalidation.`)
      }
    }
    revalidate = revalidate && (state.fileState === 'UNAVAILABLE' || state.fileState === 'STALE')
    if (revalidate) {
      const preloadProposal: URIPatch = { fetching: true, error: null }
      if (headers) {
        preloadProposal.headers = headers
      }
      propose(preloadProposal)
      const report = model.versionTag && exists ?
        await this.iodriver.revalidateImage(model, model.versionTag) :
        await this.iodriver.saveImage(model)
      propose(reportToProposal(report))
      this.logReport(report, model.uri)
    }
  }

  private async onDelete(event: URIEvent, propose: ProposeFunction) {
    propose(null)
    await this.iodriver.deleteImage(event.nextModel)
  }

  private logReport(report: RequestReport, uri: string) {
    if (report.error) {
      this.log(`File download from origin ${uri} failed.\n${report.error.message}`)
    } else {
      this.log(`File download from origin ${uri} succeeded.`)
    }
  }

  private log(info: string) {
    if (this.config.debug) {
      console.log(`AsyncImageStore ${this.name}: ${info}`)
    }
  }

  private async dispatchCommandToURI<P>(uri: string, name: URICommandType, payload?: any) {
    return this.state.dispatchCommand(uri, name, payload)
  }

  private async dispatchCommandToAll<P>(name: URICommandType, onProgress?: ProgressCallback) {
    return this.state.dispatchCommandToAll(name, null, onProgress)
  }

  private async dispatchCommandWhen<P>(name: URICommandType, when: (state: URICacheState) => boolean, onProgress?: ProgressCallback) {
    return this.state.dispatchCommandWhen(name, when, null, onProgress)
  }

  private assertMountInvariant() {
    invariant(this.mounted, `${this.constructor.name} actions must be invoked after mounting occurs, but Store \`${this.name}' is unmounted.`)
  }

  /**
   * **Asynchronously** mount the Store, restoring cache metadata from storage.
   * 
   * **Suggestion**: Mount this Store during your application initialization, ideally in the root component, where you can display a splashscreen or an activity indicator while
   * it happens. Good hook candidates are `componentWillMount` and `componentDidMount`, **which you can declare `async`**.
   */
  public async mount(): Promise<void> {
    const registry = await this.storage.load()
    await this.state.mount(registry)
    this.state.addRegistryUpdateListener(this.storage.save.bind(this.storage))
    if (this.config.autoRemoveStaleImages) {
      await this.deleteAllStaleImages()
    }
    this.mounted = true
  }

  /**
   * **Asynchronously** release the Store from memory and persists its state.
   * 
   * **Suggestion**: Unmount the Store in your root component, in `componentWillUnmount` method, **which you can declare `async`**.
   * 
   * **Info**: Carefully consuming lifecycle methods is mandatory to prevent memory leaks. Note that **cache metadata is persisted on change**.
   */
  public async unmount(): Promise<void> {
    if (this.mounted) {
      this.mounted = false
      await this.state.unmount()
    }
  }

    /**
     * Inform if Store is mounted
     */
  public isMounted(): boolean {
    return this.mounted
  }

    /**
     * Add a listener which gets called every time the cache model associated with the given
     * uri resource change.
     * 
     * @param uri 
     * @param listener 
     * @return The most-recent `URIEvent` associated with the given URI.
     * If this URI has not been registered yet, the return event will be of type `URI_INIT`.
     */
  public addCacheUpdateListener(uri: string, listener: URIEventListener): URIEvent {
    this.assertMountInvariant()
    return this.state.addListener(uri, listener)
  }

    /**
     * Remove a previously registered listener.
     * 
     * @param uri
     * @param listener 
     */
  public removeCacheUpdateListener(uri: string, listener: URIEventListener) {
    this.state.removeListener(uri, listener)
  }

    /**
     * **Asynchronously**  preload the provided image to Store.
     * 
     * **Info** This function will revalidate an image which has already been preloaded, and download unconditionnaly otherwise.
     * 
     * @param target string URI or React `ImageURISource` prop
     * @return A Promise resolving to the next `URIEvent`
     */
  public async preloadImage(target: Target): Promise<URIEvent> {
    this.assertMountInvariant()
    const source = getSourceFromUri(target)
    return this.dispatchCommandToURI(source.uri, 'PRELOAD', source.headers)
  }

    /**
     * **Asynchronously**  preload the list of images to Store.
     * 
     * **Info** This function will revalidate images which are already preloaded, and download the others.
     * 
     * @param targets an array of string URI or React `ImageURISource` prop
     * @param onProgress a callback to be invoked after each preloading
     * @return A Promise resolving to an array of `URIEvent`
     */
  public async preloadImages(targets: Target[], onProgress?: ProgressCallback): Promise<URIEvent[]> {
    this.assertMountInvariant()
    const events: URIEvent[] = []
    let i = 0
    for (const target of targets) {
      const event = await this.preloadImage(target)
      events.push(event)
      onProgress && onProgress(event, i, targets.length)
      i = i + 1
    }
    return events
  }

    /**
     * **Asynchronously** delete an existing image from the Store.
     * Does nothing if the provided URI have no matching entry in Store.
     * 
     * @param target 
     */
  public async deleteImage(target: Target): Promise<URIEvent> {
    this.assertMountInvariant()
    const source = getSourceFromUri(target)
    return this.dispatchCommandToURI(source.uri, 'DELETE')
  }

    /**
     * **Asynchronously** delete all images from the Store.
     * 
     * @param onProgress a callback to be invoked after each deletion
     */
  public async deleteAllImages(onProgress?: ProgressCallback): Promise<URIEvent[]> {
    this.assertMountInvariant()
    return this.dispatchCommandToAll('DELETE', onProgress)
  }

    /**
     * **Asynchronously** delete all image which are stale from the Store.
     * 
     * @param onProgress a callback to be invoked after each deletion
     */
  public async deleteAllStaleImages(onProgress?: ProgressCallback): Promise<URIEvent[]> {
    this.assertMountInvariant()
    return this.dispatchCommandWhen('DELETE', (s => s.fileState === 'STALE'), onProgress)
  }

    /**
     * **Asynchronously** revalidate a stored image *if it was previously registered*.
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
  public async revalidateImage(target: Target): Promise<URIEvent> {
    this.assertMountInvariant()
    const source = getSourceFromUri(target)
    return this.dispatchCommandToURI(source.uri, 'REVALIDATE', source.headers)
  }

    /**
     * **Asynchronously** revalidate all images *which were previously registered*.
     * 
     * **Info**: Revalidation is done with:
     * 
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     * 
     * **Warning** This method does nothing on a resource which has not been registered,
     * i.e. to which `preload` has not been called at least once.
     * 
     * @param onProgress a callback to be invoked after each revalidation
     * @return A Promise resolving to a list of `URIEvent` related to each revalidation.
     */
  public async revalidateAllImages(onProgress?: ProgressCallback): Promise<URIEvent[]> {
    this.assertMountInvariant()
    return this.dispatchCommandToAll('REVALIDATE', onProgress)
  }

    /**
     * **Asynchronously** revalidate all stale images in the store.
     *
     * **Info**: Revalidation is done with:
     * 
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     * 
     * @param onProgress a callback to be invoked after each revalidation
     * @return A Promise resolving to a list of `URIEvent` related to each revalidation.
     */
  public async revalidateAllStaleImages(onProgress?: ProgressCallback): Promise<URIEvent[]> {
    this.assertMountInvariant()
    return this.dispatchCommandWhen('REVALIDATE', (s => s.fileState === 'STALE'), onProgress)
  }

  /**
   * **Asynchronously** clear and **unmount** the store. This method:
   * 
   * - unmount the store
   * - clear metadata from storage
   * - delete store root folder from filesystem
   * 
   * **Warning**: This method will wipe out all images registered with this library.
   * @throws If the cache root could not be deleted
   * 
   */
  public async clear(): Promise<void> {
    if (this.mounted) {
      await this.unmount()
    }
    await this.storage.clear()
    await this.iodriver.deleteCacheRoot()
  }
}

/**
 * Get store by name, if exists.
 * 
 * @param name 
 */
export function getStoreByName(name: string): AsyncImageStore|null {
  return storesMap.get(name) || null
}

/**
 * Create a store from a unique name, which will be used as directory.
 * 
 * **Warning**: Can be called once only. Use `getStoreByName` instead if you're looking for an instance.
 * 
 * @param name The unique name.
 * @param userConfig See config structure in the type definition of `AsyncImageStoreConfig`
 * @see AsyncImageStoreConfig
 * @see getStoreByName
 */
export function createStore(name: string, userConfig?: Partial<AsyncImageStoreConfig>) {
  return new AsyncImageStore(name, userConfig || {})
}
