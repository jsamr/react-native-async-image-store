import RNFetchBlob from 'rn-fetch-blob'
import { AsyncImageStoreConfig, ImageSource, URIVersionTag, IODriverInterface, RequestReport, HTTPHeaders } from '@src/interfaces'
import { mergeDeepRight } from 'ramda'
import { FileLocator } from '@src/drivers/FileLocator'
import { AbstractIODriver } from '@src/drivers/AbstractIODriver'
import { ImageDownloadFailure } from '@src/errors/ImageDownloadFailure'
import { MissingContentTypeException } from '@src/errors/MissingContentTypeException'
import { ForbiddenMimeTypeException } from '@src/errors/ForbiddenMimeTypeException'

export class IODriver extends AbstractIODriver implements IODriverInterface {

  private fileLocator: FileLocator
  constructor(name: string, config: AsyncImageStoreConfig) {
    super(name, config)
    this.fileLocator = new FileLocator(name, config)
  }

  private prepareFetch(uri: string) {
    return RNFetchBlob.config({
      path: this.fileLocator.getURIFilename(uri)
    })
  }

  private getImageFileExtension(uri: string, headers: HTTPHeaders) {
    const mimeType: string|undefined = headers['Content-Type'] || headers['content-type']
    if (!mimeType) {
      throw new MissingContentTypeException(uri)
    }
    const extension = this.getFileExtensionFromMimeType(mimeType)
    if (!extension) {
      throw new ForbiddenMimeTypeException(uri, mimeType)
    }
  }

  async saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport> {
    // Override default cache-control
    const headers = mergeDeepRight(userHeaders, { 'Cache-Control': 'max-age=31536000' })
    try {
      const response = await this.prepareFetch(uri).fetch('GET', uri, headers)
      console.info(response.respInfo.headers)
      // Content-Type = image/jpeg
      const error = response.respInfo.status >= 400 ? new ImageDownloadFailure(uri, response.respInfo.status) : null
      return {
        uri,
        error,
        expires: this.config.overrideMaxAge ? this.expiryFromMaxAge(this.config.overrideMaxAge) : this.getExpirationFromHeaders(response.respInfo.headers),
        path: this.fileLocator.getURIFilename(uri),
        versionTag: this.getVersionTagFromHeaders(response.respInfo.headers)
      }
    } catch (error) {
      return {
        uri,
        error: new ImageDownloadFailure(uri, error.status),
        expires: 0,
        path: this.fileLocator.getURIFilename(uri),
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
    return RNFetchBlob.fs.exists(this.fileLocator.getURIFilename(uri))
  }

  async deleteImage(src: ImageSource): Promise<void> {
    const { uri } = src
    const file = this.fileLocator.getURIFilename(uri)
    if (await this.imageExists(src)) {
      await RNFetchBlob.fs.unlink(this.fileLocator.getURIFilename(uri))
      this.log(`Local file '${file}' from origin ${uri} successfully deleted`)
    } else {
      this.log(`Local file '${file}' from origin ${uri} was targeted for delete but it does not exist`)
    }
  }

  async deleteCacheRoot(): Promise<void> {
    return RNFetchBlob.fs.unlink(this.fileLocator.baseDir)
  }
}
