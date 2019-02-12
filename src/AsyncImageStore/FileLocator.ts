import RNFetchBlob from 'rn-fetch-blob'
import { Buffer } from 'buffer'
import { defaultConfig } from './default-config'
import { AsyncImageStoreConfig } from './types'

export class FileLocator {
  constructor(private storeName: string, private config: typeof defaultConfig & AsyncImageStoreConfig) {}

  public get baseDir() {
    const dir = this.config.fsKind === 'CACHE' ?
                RNFetchBlob.fs.dirs.CacheDir :
                RNFetchBlob.fs.dirs.DocumentDir
    return `${dir}/${this.storeName}`
  }

  public getURIFilename(uri: string) {
    return `${this.baseDir}/${Buffer.from(uri).toString('base64')}`
  }
}
