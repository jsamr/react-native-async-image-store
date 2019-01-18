"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rn_fetch_blob_1 = __importDefault(require("rn-fetch-blob"));
const FileLocator_1 = require("./FileLocator");
const ramda_1 = require("ramda");
function getHeadersFromVersionTag(versionTag) {
    const headers = {};
    if (versionTag.type === 'ETag') {
        headers['If-None-Match'] = versionTag.value;
    }
    else if (versionTag.type === 'LastModified') {
        headers['If-Modified-Since'] = versionTag.value;
    }
    return headers;
}
function expiryFromMaxAge(maxAge_s) {
    return maxAge_s * 1000 + new Date().getTime();
}
class Fetcher {
    constructor(name, config) {
        this.config = config;
        this.fileLocator = new FileLocator_1.FileLocator(name);
    }
    prepareFetch(uri) {
        return rn_fetch_blob_1.default.config({
            path: this.fileLocator.getURIFilename(uri)
        });
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
                // console.info('DIRECTIVE', dir)
                const match = /^max-age=(.*)/.exec(dir);
                if (match) {
                    const [_, group] = match;
                    const maxAge_s = Number(group);
                    if (!isNaN(maxAge_s)) {
                        console.info('FOUND MAX AGE', maxAge_s);
                        return expiryFromMaxAge(maxAge_s);
                    }
                }
            }
        }
        if (headers.expires || headers.Expires) {
            const expiresAt = headers.expires || headers.Expires;
            return Date.parse(expiresAt);
        }
        // console.info(`COULDN'T FIND EXPIRY OR MAX AGE INFORMATION, FALLBACK TO DEFAULT`)
        return expiryFromMaxAge(this.config.defaultMaxAge);
    }
    saveImage({ uri, headers: userHeaders }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Override default cache-control
            const headers = ramda_1.mergeDeepRight(userHeaders, { 'Cache-Control': 'max-age=31536000' });
            try {
                const response = yield this.prepareFetch(uri).fetch('GET', uri, headers);
                const error = response.respInfo.status >= 400 ? new Error(`Received status ${response.respInfo.status}`) : null;
                return {
                    uri,
                    error,
                    expires: this.config.overrideMaxAge ? expiryFromMaxAge(this.config.overrideMaxAge) : this.getExpirationFromHeaders(response.respInfo.headers),
                    path: this.fileLocator.getURIFilename(uri),
                    versionTag: this.getVersionTagFromHeaders(response.respInfo.headers)
                };
            }
            catch (error) {
                return {
                    uri,
                    error,
                    expires: 0,
                    path: this.fileLocator.getURIFilename(uri),
                    versionTag: null
                };
            }
        });
    }
    revalidateImage({ uri, headers }, versionTag) {
        return __awaiter(this, void 0, void 0, function* () {
            const newHeaders = Object.assign({}, headers, getHeadersFromVersionTag(versionTag));
            return this.saveImage({ uri, headers: newHeaders });
        });
    }
    imageExists({ uri }) {
        return __awaiter(this, void 0, void 0, function* () {
            return rn_fetch_blob_1.default.fs.exists(this.fileLocator.getURIFilename(uri));
        });
    }
    deleteImage({ uri }) {
        return __awaiter(this, void 0, void 0, function* () {
            return rn_fetch_blob_1.default.fs.unlink(this.fileLocator.getURIFilename(uri));
        });
    }
}
exports.Fetcher = Fetcher;
