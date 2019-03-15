import { AsyncImageStoreConfig } from '../types';
export declare class FileLocator {
    private storeName;
    private config;
    constructor(storeName: string, config: AsyncImageStoreConfig);
    readonly baseDir: string;
    getURIFilename(uri: string): string;
}
