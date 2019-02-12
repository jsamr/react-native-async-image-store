"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Storage_1 = require("./Storage");
exports.defaultConfig = {
    Storage: Storage_1.Storage,
    debug: __DEV__,
    defaultMaxAge: 86000,
    autoRemoveStaleImages: false,
    fsKind: 'PERMANENT',
    ioThrottleFrequency: 10
};
