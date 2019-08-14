import { AsyncImageStoreConfig, HTTPHeaders, ImageSource, IODriverInterface, RequestReport, URIVersionTag, FileLocatorInterface, FileSystemDriverInterface, DownloadManagerInterface } from "../interfaces";
export declare class IODriver implements IODriverInterface {
    protected name: string;
    protected config: AsyncImageStoreConfig;
    protected fileLocator: FileLocatorInterface;
    protected fileSystem: FileSystemDriverInterface;
    protected downloadManager: DownloadManagerInterface;
    constructor(name: string, config: AsyncImageStoreConfig, fileLocator: FileLocatorInterface);
    protected getHeadersFromVersionTag(versionTag: URIVersionTag): HTTPHeaders;
    protected getFileExtensionFromMimeType(mime: string): string | null;
    protected getImageFileExtensionFromHeaders(uri: string, headers: Headers): string;
    protected expiryFromMaxAge(maxAge_s: number): number;
    protected getVersionTagFromHeaders(headers: Headers): URIVersionTag | null;
    protected getExpirationFromHeaders(headers: Headers): number;
    protected log(info: string): void;
    createBaseDirIfMissing(): Promise<void>;
    deleteBaseDirIfExists(): Promise<void>;
    deleteImage(src: ImageSource): Promise<void>;
    imageExists({ uri }: ImageSource): Promise<boolean>;
    revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
}
