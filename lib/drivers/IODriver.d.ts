import { AsyncImageStoreConfig, ImageSource, URIVersionTag, IODriverInterface, RequestReport, FileLocatorInterface } from "../interfaces";
import { AbstractIODriver } from "./AbstractIODriver";
export declare class IODriver extends AbstractIODriver implements IODriverInterface {
    constructor(name: string, config: AsyncImageStoreConfig, fileLocator: FileLocatorInterface);
    private prepareFetch;
    saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
    revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    imageExists({ uri }: ImageSource): Promise<boolean>;
    deleteImage(src: ImageSource): Promise<void>;
    deleteCacheRoot(): Promise<void>;
}
