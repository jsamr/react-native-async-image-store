import { AsyncStorageDriver } from './drivers/AsyncStorageDriver'
import { IODriver } from './drivers/IODriver'
import { BaseAsyncImageStoreConfig } from './interfaces'

export const defaultConfig: BaseAsyncImageStoreConfig = {
  IODriver,
  StorageDriver: AsyncStorageDriver,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  maxParallelDownloads: 10
}
