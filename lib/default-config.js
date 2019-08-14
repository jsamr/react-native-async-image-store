"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncStorageDriver_1 = require("./drivers/AsyncStorageDriver");
const IODriver_1 = require("./drivers/IODriver");
exports.defaultConfig = {
    IODriver: IODriver_1.IODriver,
    StorageDriver: AsyncStorageDriver_1.AsyncStorageDriver,
    debug: __DEV__,
    defaultMaxAge: 86000,
    autoRemoveStaleImages: false,
    maxParallelDownloads: 10
};
