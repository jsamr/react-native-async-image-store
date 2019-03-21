import { StorageDriverInterface, URICacheRegistry } from "../interfaces";
export declare class AsyncStorageDriver implements StorageDriverInterface {
    private name;
    constructor(name: string);
    getKey(): string;
    load(): Promise<URICacheRegistry | null>;
    clear(): Promise<void>;
    save(registry: URICacheRegistry): Promise<void>;
}
