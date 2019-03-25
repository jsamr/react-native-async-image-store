import RNFetchBlob from 'rn-fetch-blob'
import {
    AsyncImageStoreConfig,
    ImageSource,
    URIVersionTag,
    IODriverInterface,
    RequestReport,
    FileLocatorInterface
} from '@src/interfaces'
import { mergeDeepRight } from 'ramda'
import { AbstractIODriver } from '@src/drivers/AbstractIODriver'
import { ImageDownloadFailure } from '@src/errors/ImageDownloadFailure'

export class IODriver extends AbstractIODriver implements IODriverInterface {

  constructor(name: string, config: AsyncImageStoreConfig, fileLocator: FileLocatorInterface) {
    super(name, config, fileLocator)
  }

  private prepareFetch(uri: string) {
    return RNFetchBlob.config({
      path: this.fileLocator.getTempFilenameFromURI(uri)
    })
  }

  async saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport> {
    // Override default cache-control
    const headers = mergeDeepRight(userHeaders, { 'Cache-Control': 'max-age=31536000' })
    try {
      const response = await this.prepareFetch(uri).fetch('GET', uri, headers)
      // Content-Type = image/jpeg
      const downloadPath = this.fileLocator.getTempFilenameFromURI(uri)
      let path = downloadPath
      const error = response.respInfo.status >= 400 ? new ImageDownloadFailure(uri, response.respInfo.status) : null
      if (!error) {
        path += '.' + this.getImageFileExtensionFromHeaders(uri, response.respInfo.headers)
        await RNFetchBlob.fs.mv(downloadPath, path)
        console.info(`Moved file from ${downloadPath} to ${path}`)
      }
      return {
        uri,
        error,
        path,
        expires: this.config.overrideMaxAge ? this.expiryFromMaxAge(this.config.overrideMaxAge) : this.getExpirationFromHeaders(response.respInfo.headers),
        versionTag: this.getVersionTagFromHeaders(response.respInfo.headers)
      }
    } catch (error) {
      return {
        uri,
        error: new ImageDownloadFailure(uri, error.status),
        expires: 0,
        path: this.fileLocator.getTempFilenameFromURI(uri),
        versionTag: null
      }
    }

  }

  async revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport> {
    const newHeaders = {
      ...headers,
      ...this.getHeadersFromVersionTag(versionTag)
    }
    return this.saveImage({ uri, headers: newHeaders })
  }

  async imageExists({ uri }: ImageSource): Promise<boolean> {
    return RNFetchBlob.fs.exists(this.fileLocator.getLocalPathFromURI(uri))
  }

  async deleteImage(src: ImageSource): Promise<void> {
    const { uri } = src
    const file = this.fileLocator.getLocalPathFromURI(uri)
    if (await this.imageExists(src)) {
      await RNFetchBlob.fs.unlink(this.fileLocator.getLocalPathFromURI(uri))
      this.log(`Local file '${file}' from origin ${uri} successfully deleted`)
    } else {
      this.log(`Local file '${file}' from origin ${uri} was targeted for delete but it does not exist`)
    }
  }

  async deleteCacheRoot(): Promise<void> {
    if (await RNFetchBlob.fs.exists(this.fileLocator.getBaseDir())) {
      return RNFetchBlob.fs.unlink(this.fileLocator.getBaseDir())
    }
  }
}
