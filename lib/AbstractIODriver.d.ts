import { ImageSource, IODriverInterface, RequestReport, URIVersionTag, HTTPHeaders, AsyncImageStoreConfig } from './types';
export declare abstract class AbstractIODriver implements IODriverInterface {
    protected name: string;
    protected config: AsyncImageStoreConfig;
    constructor(name: string, config: AsyncImageStoreConfig);
    protected getHeadersFromVersionTag(versionTag: URIVersionTag): HTTPHeaders;
    protected expiryFromMaxAge(maxAge_s: number): number;
    protected getVersionTagFromHeaders(headers: {
        [key: string]: string;
    }): URIVersionTag | null;
    protected getExpirationFromHeaders(headers: HTTPHeaders): number;
    protected log(info: string): void;
    abstract deleteCacheRoot(): Promise<void>;
    abstract deleteImage(src: ImageSource): Promise<void>;
    abstract imageExists({ uri }: ImageSource): Promise<boolean>;
    abstract revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    abstract saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
}
