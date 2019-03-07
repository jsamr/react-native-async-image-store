import { ImageSource, URIVersionTag, AsyncImageStoreConfig } from './types';
import { defaultConfig } from './default-config';
export interface RequestReport {
    uri: string;
    expires: number;
    error: Error | null;
    versionTag: URIVersionTag | null;
    path: string;
}
export declare class IODriver {
    private name;
    private config;
    private fileLocator;
    constructor(name: string, config: typeof defaultConfig & AsyncImageStoreConfig);
    private prepareFetch;
    private getVersionTagFromHeaders;
    private getExpirationFromHeaders;
    private log;
    saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
    revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    imageExists({ uri }: ImageSource): Promise<boolean>;
    deleteImage(src: ImageSource): Promise<void>;
    deleteCacheRoot(): Promise<void>;
}
