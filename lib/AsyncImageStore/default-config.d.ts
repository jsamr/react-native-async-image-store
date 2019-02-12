import { StorageConstructor } from './types';
export declare const defaultConfig: {
    Storage: StorageConstructor<import("./types").StorageInstance>;
    debug: boolean;
    defaultMaxAge: number;
    autoRemoveStaleImages: boolean;
    ioThrottleFrequency: number;
};
