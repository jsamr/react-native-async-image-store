import { Storage } from './Storage'
import { StorageConstructor, FSKind } from './types'

declare const __DEV__: boolean

export const defaultConfig = {
  Storage: Storage as StorageConstructor,
  debug: __DEV__,
  defaultMaxAge: 86000,
  autoRemoveStaleImages: false,
  fsKind: 'PERMANENT' as FSKind,
  ioThrottleFrequency: 10
}
