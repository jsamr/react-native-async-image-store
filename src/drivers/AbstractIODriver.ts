import {
    AsyncImageStoreConfig,
    HTTPHeaders,
    ImageSource,
    IODriverInterface,
    RequestReport,
    URIVersionTag,
    FileLocatorInterface
} from '@src/interfaces'
import { MissingContentTypeException } from '@src/errors/MissingContentTypeException'
import { ForbiddenMimeTypeException } from '@src/errors/ForbiddenMimeTypeException'

export abstract class AbstractIODriver implements IODriverInterface {
  protected constructor(protected name: string, protected config: AsyncImageStoreConfig, protected fileLocator: FileLocatorInterface) {}

  protected getHeadersFromVersionTag(versionTag: URIVersionTag) {
    const headers: HTTPHeaders = {}
    if (versionTag.type === 'ETag') {
      headers['If-None-Match'] = versionTag.value
    } else if (versionTag.type === 'LastModified') {
      headers['If-Modified-Since'] = versionTag.value
    }
    return headers
  }

  protected getFileExtensionFromMimeType(mime: string): string|null {
    const regex=/^image\/(.+)/
    const res = regex.exec(mime)
    if (!res) {
      return null
    }
    const [_, extension ] = res
    return extension
  }

  protected getImageFileExtensionFromHeaders(uri: string, headers: HTTPHeaders): string {
    const mimeType: string|undefined = headers['Content-Type'] || headers['content-type']
    if (!mimeType) {
      throw new MissingContentTypeException(uri)
    }
    const extension = this.getFileExtensionFromMimeType(mimeType)
    if (!extension) {
      throw new ForbiddenMimeTypeException(uri, mimeType)
    }
    return extension
  }

  protected expiryFromMaxAge(maxAge_s: number): number {
    return maxAge_s * 1000 + new Date().getTime()
  }

  protected getVersionTagFromHeaders(headers: { [key: string]: string }): URIVersionTag|null {
    // TODO resilience to case variations
    if (headers.etag || headers.Etag) {
      return {
        type: 'ETag',
        value: (headers.etag || headers.Etag).trim()
      }
    }
    if (headers['last-modified'] || headers['Last-Modified']) {
      return {
        type: 'LastModified',
        value: (headers['last-modified'] || headers['Last-Modified']).trim()
      }
    }
    return null
  }

  protected getExpirationFromHeaders(headers: HTTPHeaders): number {
    // TODO resilience to case variations
    if (headers['cache-control'] || headers['Cache-Control']) {
      const contentType = headers['cache-control'] || headers['Cache-Control']
      const directives = contentType.split(',')
      for (const dir of directives) {
        const match = /^max-age=(.*)/.exec(dir)
        if (match) {
          const [ _, group] = match
          const maxAge_s = Number(group)
          if (!isNaN(maxAge_s)) {
            return this.expiryFromMaxAge(maxAge_s)
          }
        }
      }
    }
    if (headers.expires || headers.Expires) {
      const expiresAt = headers.expires || headers.Expires
      return Date.parse(expiresAt)
    }
    // console.info(`COULDN'T FIND EXPIRY OR MAX AGE INFORMATION, FALLBACK TO DEFAULT`)
    return this.expiryFromMaxAge(this.config.defaultMaxAge)
  }

  protected log(info: string) {
    if (this.config.debug) {
      console.log(`AsyncImageStore ${this.name}: ${info}`)
    }
  }
  public abstract deleteCacheRoot(): Promise<void>
  public abstract deleteImage(src: ImageSource): Promise<void>
  public abstract imageExists({ uri }: ImageSource): Promise<boolean>
  public abstract revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>
  public abstract saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>

}
