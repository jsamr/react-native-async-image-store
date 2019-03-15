export interface AsyncImageStoreConfig {
  /**
   * Log events to the console
   * 
   * **Default**: `__DEV__`
   */
  debug: boolean
  /**
   * 
   * This value will be used when no `Cache-control: max-age` directive or `Expires` header have been given in the image response.
   * `Infinity` can be used to denote an **immutable**, never-expire image default policy.
   * 
   * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
   * 
   * **Default**: `84000` seconds (1 day)
   */
  defaultMaxAge: number
  /**
   * This value will override any `Cache-control: max-age` directive or `Expires` header in the image response.
   * `Infinity` can be used to denote an **immutable**, never-expire policy.
   *
   * **Info** `max-age` is a cache control directive specifying the duration, in seconds, during which images are considered fresh.
   * 
   * **Default**: `undefined` (don't override)
   */
  overrideMaxAge?: number
  /**
   * When this option is set to `true`, the store will automatically remove stale (expired)
   * images on mount.
   * 
   * **Default**: `false`
   */
  autoRemoveStaleImages: boolean
  /**
   * Which kind of file-system should be used.
   * 
   * Files stored while `fsKind` is set to `PERMANENT` will never be (intentionnaly) altered
   * by the operating system, while `CACHE` option offers no such guarantee thus limitating your application storage footprint.
   * 
   * **Implementation note**: See [`RNFetchBlob.fs.dirs.DocumentDir` and `RNFetchBlob.fs.dirs.CacheDir`](https://github.com/joltup/rn-fetch-blob/wiki/File-System-Access-API#dirs)
   * 
   * **Default**: `PERMANENT`
   */
  fsKind: FSKind
  /**
   * The maximum number of I/O operations per second handled by one Store at a time.
   * This is a balance between operation speed and JS thread obstruction.
   * 
   * **Default**: `10`
   */
  ioThrottleFrequency: number
  /**
   * A `class` which produces `StorageDriverInterface` instances.
   * This driver is used to persist meta-information about updates.
   * 
   * **Default**: The default implementation uses `AsyncStorage`
   * 
   * @see StorageDriverInterface
   * @see StorageDriverClass
   * @see URICacheRegistry
   * 
   */
  StorageDriver: StorageDriverClass<any>
  /**
   * A `class` which produces `IODriverInterface` instances.
   * This driver is used to fetch, store, delete and check images existence.
   * 
   * **Default**: The default implementation uses `RNFetchBlob`
   * 
   * @see IODriverInterface
   * @see IODriverClass
   * @see AbstractIODriver
   * 
   */
  IODriver: IODriverClass<any>
}

export type FSKind = 'CACHE' | 'PERMANENT'

export interface IODriverInterface {
  saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>
  revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>
  imageExists({ uri }: ImageSource): Promise<boolean>
  deleteImage(src: ImageSource): Promise<void>
  deleteCacheRoot(): Promise<void>
}

export interface StorageDriverInterface {
  load(): Promise<URICacheRegistry|null>
  save(registry: URICacheRegistry): Promise<void>
  clear(): Promise<void>
}

export type IODriverClass<C extends IODriverInterface> = new(name: string, config: AsyncImageStoreConfig) => IODriverInterface

export type StorageDriverClass<C extends StorageDriverInterface = StorageDriverInterface> = new(name: string) => C

export type ProgressCallback = (event: URIEvent, currentIndex: number, total: number) => void

export interface HTTPHeaders {
  [n: string]: string
}

export interface ImageSource {
  uri: string,
  headers?: HTTPHeaders
}

export interface RequestReport {
  uri: string
  expires: number
  error: Error|null
  versionTag: URIVersionTag | null
  path: string
}

export interface URIVersionTag {
  type: 'ETag' | 'LastModified'
  value: string
}

export type URICommandType = 'PRELOAD' | 'REVALIDATE' | 'DELETE'

export type URICacheFileState = 'UNAVAILABLE' | 'FRESH' | 'STALE'

export type URICacheSyncState = 'IDLE_SUCCESS' | 'IDLE_ERROR' | 'FETCHING' | 'REFRESHING' | 'DELETED'

export type CacheNetworkState = 'AVAILABLE' | 'UNAVAILABLE'

export interface URICacheModel {
  uri: string
  headers?: {[key: string]: string}
  registered: boolean
  fileExists: boolean
  expired: boolean
  fetching: boolean
  path: string
  localURI: string
  versionTag: URIVersionTag|null
  error: Error|null
}

export type URIEventType = 'NETWORK_UPDATE' | 'URI_UPDATE' | 'URI_INIT'

export type URIPatch = Partial<URICacheModel>

export interface URIEvent {
  type: URIEventType
  nextModel: URICacheModel
  nextState: URICacheState
}

export type URIEventListener = (event: URIEvent) => Promise<void>|void

export interface URICacheState {
  fileState: URICacheFileState
  syncState: URICacheSyncState
  networkState: CacheNetworkState
}

export interface URICacheRegistry {
  [uri: string]: URICacheModel
}
