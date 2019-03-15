import { StorageDriver } from './drivers/StorageDriver'
import { IODriver } from './drivers/IODriver'
import { FSKind, AsyncImageStoreConfig } from './interfaces'

export const defaultConfig: AsyncImageStoreConfig = {
  StorageDriver,
  IODriver,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  fsKind: 'PERMANENT' as FSKind,
  ioThrottleFrequency: 10
}
