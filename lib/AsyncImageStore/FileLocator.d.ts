export declare class FileLocator {
    private storeName;
    constructor(storeName: string);
    readonly baseDir: string;
    getURIFilename(uri: string): string;
}
