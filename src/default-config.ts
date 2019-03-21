import { AsyncStorageDriver } from './drivers/AsyncStorageDriver'
import { IODriver } from './drivers/IODriver'
import { FSKind, AsyncImageStoreConfig } from './interfaces'

export const defaultConfig: AsyncImageStoreConfig = {
  IODriver,
  StorageDriver: AsyncStorageDriver,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  fsKind: 'PERMANENT' as FSKind,
  ioThrottleFrequency: 10
}
