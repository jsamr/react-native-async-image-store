import { Storage } from './Storage'
import { StorageConstructor } from './types'

declare const __DEV__: boolean

export const defaultConfig = {
  Storage: Storage as StorageConstructor,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  fsKind: 'PERMANENT',
  ioThrottleFrequency: 10
}
