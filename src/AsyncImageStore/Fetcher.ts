import RNFetchBlob from 'rn-fetch-blob'
import { FileLocator } from './FileLocator';
import { RequestReport, SecuredImageSource, VersionTag } from './types.d'

export class Fetcher {

    private fileLocator: FileLocator
    constructor(private name: string) {
        this.fileLocator = new FileLocator(name)
    }

    private RNFetch(uri: string) {
        return RNFetchBlob.config({
            path: this.fileLocator.getURIFilename(uri)
        })
    }

    private getVersionTagFromHeaders(headers: { [key: string]: string }): VersionTag|null {
        if (headers['etag']) {
            return {
                type: 'ETag',
                value: headers['etag'].trim()
            }
        }
        if (headers['last-modified']) {
            return {
                type: 'LastModified',
                value: headers['last-modified'].trim()
            }
        }
        return null
    }

    private getExpirationFromHeaders(headers: { [key: string]: string }): number {
        if (headers['content-type']) {
            const contentType = headers['content-type']
            const directives = contentType.split(',')
            for (const dir of directives) {
                const match = /^max-age=(.*)/.exec(dir)
                if (match) {
                    const [ _, group] = match
                    const maxAge_s = Number(group)
                    if (!isNaN(maxAge_s)) {
                        return maxAge_s * 1000 + new Date().getTime()
                    }
                }
            }
        }
        if (headers['expires']) {
            const expiresAt = headers['expires']
            return Date.parse(expiresAt)
        }
        console.info(`COULDN'T FIND EXPIRY OR MAX AGE INFORMATION`)
        return new Date().getTime()
    }

    public async saveImage({ uri, headers, method }: SecuredImageSource): Promise<RequestReport> {
        const response = await this.RNFetch(uri).fetch(method as any || 'GET', headers as any)
        return {
            uri,
            error: response.respInfo.status >= 400,
            expires: this.getExpirationFromHeaders(response.respInfo.headers),
            path: this.fileLocator.getURIFilename(uri),
            versionTag: this.getVersionTagFromHeaders(response.respInfo.headers)
        }
    }

    public async imageExists({ uri }: SecuredImageSource): Promise<boolean> {
        return RNFetchBlob.fs.exists(uri)
    }
}