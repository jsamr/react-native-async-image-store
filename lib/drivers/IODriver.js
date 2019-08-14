"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const MissingContentTypeException_1 = require("../errors/MissingContentTypeException");
const ForbiddenMimeTypeException_1 = require("../errors/ForbiddenMimeTypeException");
const ImageDownloadFailure_1 = require("../errors/ImageDownloadFailure");
const ramda_1 = require("ramda");
class IODriver {
    constructor(name, config, fileLocator) {
        this.name = name;
        this.config = config;
        this.fileLocator = fileLocator;
        this.fileSystem = new config.FileSystemDriver(name);
        this.downloadManager = new config.DownloadManager();
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
    getImageFileExtensionFromHeaders(uri, headers) {
        const mimeType = headers.get('Content-Type');
        if (!mimeType) {
            throw new MissingContentTypeException_1.MissingContentTypeException(uri);
        }
        const extension = this.getFileExtensionFromMimeType(mimeType);
        if (!extension) {
            throw new ForbiddenMimeTypeException_1.ForbiddenMimeTypeException(uri, mimeType);
        }
        return extension;
    }
    expiryFromMaxAge(maxAge_s) {
        return maxAge_s * 1000 + new Date().getTime();
    }
    getVersionTagFromHeaders(headers) {
        if (headers.get('Etag')) {
            return {
                type: 'ETag',
                value: headers.get('Etag').trim()
            };
        }
        if (headers.get('Last-Modified')) {
            return {
                type: 'LastModified',
                value: headers.get('Last-Modified').trim()
            };
        }
        return null;
    }
    getExpirationFromHeaders(headers) {
        if (headers.has('Cache-Control')) {
            const contentType = headers.get('Cache-Control');
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
        if (headers.has('Expires')) {
            const expiresAt = headers.get('Expires');
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
    createBaseDirIfMissing() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.fileSystem.nodeExists(this.fileLocator.getBaseDirURI()))) {
                return this.fileSystem.makeDirectory(this.fileLocator.getBaseDirURI());
            }
        });
    }
    deleteBaseDirIfExists() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.fileSystem.nodeExists(this.fileLocator.getBaseDirURI())) {
                return this.fileSystem.delete(this.fileLocator.getBaseDirURI());
            }
        });
    }
    deleteImage(src) {
        return __awaiter(this, void 0, void 0, function* () {
            const { uri } = src;
            const file = this.fileLocator.getLocalURIForRemoteURI(uri);
            if (yield this.imageExists(src)) {
                yield this.fileSystem.delete(this.fileLocator.getLocalURIForRemoteURI(uri));
                this.log(`Local file '${file}' from origin ${uri} successfully deleted`);
            }
            else {
                this.log(`Local file '${file}' from origin ${uri} was targeted for delete but it does not exist`);
            }
        });
    }
    imageExists({ uri }) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fileSystem.nodeExists(uri);
        });
    }
    revalidateImage({ uri, headers }, versionTag) {
        return __awaiter(this, void 0, void 0, function* () {
            const newHeaders = Object.assign({}, headers, this.getHeadersFromVersionTag(versionTag));
            return this.saveImage({ uri, headers: newHeaders });
        });
    }
    saveImage({ uri, headers: userHeaders }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Override default cache-control
            const headers = ramda_1.mergeDeepRight(userHeaders, { 'Cache-Control': 'max-age=31536000' });
            const baseLocalURI = this.fileLocator.getFilePrefixURIForRemoteURI(uri);
            try {
                const report = yield this.downloadManager.downloadImage(uri, baseLocalURI, headers);
                let localURI = '';
                const error = !report.isOK ? new ImageDownloadFailure_1.ImageDownloadFailure(uri, report.status) : null;
                if (report.isOK) {
                    const extension = this.getImageFileExtensionFromHeaders(uri, report.headers);
                    localURI = `${baseLocalURI}.${extension}`;
                    yield this.fileSystem.move(baseLocalURI, localURI);
                }
                return {
                    uri,
                    error,
                    localURI,
                    expires: this.config.overrideMaxAge ? this.expiryFromMaxAge(this.config.overrideMaxAge) : this.getExpirationFromHeaders(report.headers),
                    versionTag: this.getVersionTagFromHeaders(report.headers)
                };
            }
            catch (error) {
                return {
                    uri,
                    error: new ImageDownloadFailure_1.ImageDownloadFailure(uri, error.status, error.message),
                    expires: 0,
                    localURI: this.fileLocator.getFilePrefixURIForRemoteURI(uri),
                    versionTag: null
                };
            }
        });
    }
}
exports.IODriver = IODriver;
