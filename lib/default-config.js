"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StorageDriver_1 = require("./drivers/StorageDriver");
const IODriver_1 = require("./drivers/IODriver");
exports.defaultConfig = {
    StorageDriver: StorageDriver_1.StorageDriver,
    IODriver: IODriver_1.IODriver,
    debug: __DEV__,
    defaultMaxAge: 86000,
    autoRemoveStaleImages: false,
    fsKind: 'PERMANENT',
    ioThrottleFrequency: 10
};
