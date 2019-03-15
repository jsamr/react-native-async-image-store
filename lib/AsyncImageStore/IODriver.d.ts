import { AsyncImageStoreConfig, ImageSource, URIVersionTag, IODriverInterface, RequestReport } from '../types';
import { AbstractIODriver } from '../AbstractIODriver';
export declare class IODriver extends AbstractIODriver implements IODriverInterface {
    private fileLocator;
    constructor(name: string, config: AsyncImageStoreConfig);
    private prepareFetch;
    saveImage({ uri, headers: userHeaders }: ImageSource): Promise<RequestReport>;
    revalidateImage({ uri, headers }: ImageSource, versionTag: URIVersionTag): Promise<RequestReport>;
    imageExists({ uri }: ImageSource): Promise<boolean>;
    deleteImage(src: ImageSource): Promise<void>;
    deleteCacheRoot(): Promise<void>;
}
