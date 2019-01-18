import { ImageSource, URIVersionTag, AsyncImageStoreConfig } from './types';
export interface RequestReport {
    uri: string;
    expires: number;
    error: Error | null;
    versionTag: URIVersionTag | null;
    path: string;
}
export declare class Fetcher {
    private config;
    private fileLocator;
    constructor(name: string, config: AsyncImageStoreConfig);
    private prepareFetch;
    private getVersionTagFromHeaders;
    private getExpirationFromHeaders;
    saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
    revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    imageExists({ uri }: ImageSource): Promise<boolean>;
    deleteImage({ uri }: ImageSource): Promise<void>;
}
