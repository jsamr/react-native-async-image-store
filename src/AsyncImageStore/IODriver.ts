import RNFetchBlob from 'rn-fetch-blob'
import { FileLocator } from './FileLocator'
import { ImageSource, URIVersionTag, HTTPHeaders, AsyncImageStoreConfig } from './types'
import { mergeDeepRight } from 'ramda'
import { defaultConfig } from './default-config'

export interface RequestReport {
  uri: string
  expires: number
  error: Error|null
  versionTag: URIVersionTag | null
  path: string
}

function getHeadersFromVersionTag(versionTag: URIVersionTag) {
  const headers: HTTPHeaders = {}
  if (versionTag.type === 'ETag') {
    headers['If-None-Match'] = versionTag.value
  } else if (versionTag.type === 'LastModified') {
    headers['If-Modified-Since'] = versionTag.value
  }
  return headers
}

function expiryFromMaxAge(maxAge_s: number): number {
  return maxAge_s * 1000 + new Date().getTime()
}

export class IODriver {

  private fileLocator: FileLocator
  constructor(name: string, private config: typeof defaultConfig & AsyncImageStoreConfig) {
    this.fileLocator = new FileLocator(name, config)
  }

  private prepareFetch(uri: string) {
    return RNFetchBlob.config({
      path: this.fileLocator.getURIFilename(uri)
    })
  }

  private getVersionTagFromHeaders(headers: { [key: string]: string }): URIVersionTag|null {
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

  private getExpirationFromHeaders(headers: HTTPHeaders): number {
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
            return expiryFromMaxAge(maxAge_s)
          }
        }
      }
    }
    if (headers.expires || headers.Expires) {
      const expiresAt = headers.expires || headers.Expires
      return Date.parse(expiresAt)
    }
        // console.info(`COULDN'T FIND EXPIRY OR MAX AGE INFORMATION, FALLBACK TO DEFAULT`)
    return expiryFromMaxAge(this.config.defaultMaxAge)
  }

  public async saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport> {
        // Override default cache-control
    const headers = mergeDeepRight(userHeaders, { 'Cache-Control': 'max-age=31536000' })
    try {
      const response = await this.prepareFetch(uri).fetch('GET', uri, headers)
      const error = response.respInfo.status >= 400 ? new Error(`Received status ${response.respInfo.status}`) : null
      return {
        uri,
        error,
        expires: this.config.overrideMaxAge ? expiryFromMaxAge(this.config.overrideMaxAge) : this.getExpirationFromHeaders(response.respInfo.headers),
        path: this.fileLocator.getURIFilename(uri),
        versionTag: this.getVersionTagFromHeaders(response.respInfo.headers)
      }
    } catch (error) {
      return {
        uri,
        error,
        expires: 0,
        path: this.fileLocator.getURIFilename(uri),
        versionTag: null
      }
    }

  }

  public async revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport> {
    const newHeaders = {
      ...headers,
      ...getHeadersFromVersionTag(versionTag)
    }
    return this.saveImage({ uri, headers: newHeaders })
  }

  public async imageExists({ uri }: ImageSource): Promise<boolean> {
    return RNFetchBlob.fs.exists(this.fileLocator.getURIFilename(uri))
  }

  public async deleteImage({ uri }: ImageSource): Promise<void> {
    return RNFetchBlob.fs
      .unlink(this.fileLocator.getURIFilename(uri))
      .catch(console.error.bind(console))
  }

  public async deleteCacheRoot(): Promise<void> {
    return RNFetchBlob.fs
      .unlink(this.fileLocator.baseDir)
      .catch(console.error.bind(console))
  }
}
