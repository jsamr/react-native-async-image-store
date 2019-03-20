"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AbstractIODriver {
    constructor(name, config) {
        this.name = name;
        this.config = config;
    }
    getHeadersFromVersionTag(versionTag) {
        const headers = {};
        if (versionTag.type === 'ETag') {
            headers['If-None-Match'] = versionTag.value;
        }
        else if (versionTag.type === 'LastModified') {
            headers['If-Modified-Since'] = versionTag.value;
        }
        return headers;
    }
    getFileExtensionFromMimeType(mime) {
        const regex = /^image\/(.+)/;
        const res = regex.exec(mime);
        if (!res) {
            return null;
        }
        const [_, extension] = res;
        return extension;
    }
    expiryFromMaxAge(maxAge_s) {
        return maxAge_s * 1000 + new Date().getTime();
    }
    getVersionTagFromHeaders(headers) {
        // TODO resilience to case variations
        if (headers.etag || headers.Etag) {
            return {
                type: 'ETag',
                value: (headers.etag || headers.Etag).trim()
            };
        }
        if (headers['last-modified'] || headers['Last-Modified']) {
            return {
                type: 'LastModified',
                value: (headers['last-modified'] || headers['Last-Modified']).trim()
            };
        }
        return null;
    }
    getExpirationFromHeaders(headers) {
        // TODO resilience to case variations
        if (headers['cache-control'] || headers['Cache-Control']) {
            const contentType = headers['cache-control'] || headers['Cache-Control'];
            const directives = contentType.split(',');
            for (const dir of directives) {
                const match = /^max-age=(.*)/.exec(dir);
                if (match) {
                    const [_, group] = match;
                    const maxAge_s = Number(group);
                    if (!isNaN(maxAge_s)) {
                        return this.expiryFromMaxAge(maxAge_s);
                    }
                }
            }
        }
        if (headers.expires || headers.Expires) {
            const expiresAt = headers.expires || headers.Expires;
            return Date.parse(expiresAt);
        }
        // console.info(`COULDN'T FIND EXPIRY OR MAX AGE INFORMATION, FALLBACK TO DEFAULT`)
        return this.expiryFromMaxAge(this.config.defaultMaxAge);
    }
    log(info) {
        if (this.config.debug) {
            console.log(`AsyncImageStore ${this.name}: ${info}`);
        }
    }
}
exports.AbstractIODriver = AbstractIODriver;
