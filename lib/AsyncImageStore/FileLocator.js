"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rn_fetch_blob_1 = __importDefault(require("rn-fetch-blob"));
const buffer_1 = require("buffer");
class FileLocator {
    constructor(storeName, config) {
        this.storeName = storeName;
        this.config = config;
    }
    get baseDir() {
        const dir = this.config.fsKind === 'CACHE' ?
            rn_fetch_blob_1.default.fs.dirs.CacheDir :
            rn_fetch_blob_1.default.fs.dirs.DocumentDir;
        return `${dir}/${this.storeName}`;
    }
    getURIFilename(uri) {
        return `${this.baseDir}/${buffer_1.Buffer.from(uri).toString('base64')}`;
    }
}
exports.FileLocator = FileLocator;
