import { AsyncImageStoreConfig, HTTPHeaders, ImageSource, IODriverInterface, RequestReport, URIVersionTag, FileLocatorInterface } from "../interfaces";
export declare abstract class AbstractIODriver implements IODriverInterface {
    protected name: string;
    protected config: AsyncImageStoreConfig;
    protected fileLocator: FileLocatorInterface;
    protected constructor(name: string, config: AsyncImageStoreConfig, fileLocator: FileLocatorInterface);
    protected getHeadersFromVersionTag(versionTag: URIVersionTag): HTTPHeaders;
    protected getFileExtensionFromMimeType(mime: string): string | null;
    protected getImageFileExtensionFromHeaders(uri: string, headers: HTTPHeaders): string;
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
