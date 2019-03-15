"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const es6_error_1 = __importDefault(require("es6-error"));
class ForbiddenMimeTypeException extends es6_error_1.default {
    constructor(targetUrl, mime) {
        super(`Download failed for image from origin ${targetUrl}. The response from origin contains a Content-Type header which doesn't describe an image mime type.`);
    }
}
exports.ForbiddenMimeTypeException = ForbiddenMimeTypeException;
