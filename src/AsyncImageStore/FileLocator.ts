import RNFetchBlob from 'rn-fetch-blob'
import { Buffer } from 'buffer'

export class FileLocator {
  constructor(private storeName: string) {}

  public get baseDir() {
    return `${RNFetchBlob.fs.dirs.CacheDir}/${this.storeName}`
  }

  public getURIFilename(uri: string) {
    return `${this.baseDir}/${Buffer.from(uri).toString('base64')}`
  }
}
