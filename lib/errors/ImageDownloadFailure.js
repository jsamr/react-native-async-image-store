"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const es6_error_1 = __importDefault(require("es6-error"));
class ImageDownloadFailure extends es6_error_1.default {
    constructor(targetUrl, status, reason) {
        const postfix = (status && `Received status code ${status}.`) || reason || '';
        super(`Download failed for image from origin ${targetUrl}. ${postfix}`);
    }
}
exports.ImageDownloadFailure = ImageDownloadFailure;
