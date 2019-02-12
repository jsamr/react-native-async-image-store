"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rn_fetch_blob_1 = __importDefault(require("rn-fetch-blob"));
const buffer_1 = require("buffer");
class FileLocator {
    constructor(storeName) {
        this.storeName = storeName;
    }
    get baseDir() {
        return `${rn_fetch_blob_1.default.fs.dirs.DocumentDir}/${this.storeName}`;
    }
    getURIFilename(uri) {
        return `${this.baseDir}/${buffer_1.Buffer.from(uri).toString('base64')}`;
    }
}
exports.FileLocator = FileLocator;
