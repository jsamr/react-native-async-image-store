import { StorageDriver } from './StorageDriver'
import { IODriver } from './IODriver'
import { FSKind, AsyncImageStoreConfig } from '../types'

export const defaultConfig: AsyncImageStoreConfig = {
  StorageDriver,
  IODriver,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  fsKind: 'PERMANENT' as FSKind,
  ioThrottleFrequency: 10
}
