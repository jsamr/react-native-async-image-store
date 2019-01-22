import { StorageInstance, URICacheRegistry } from './types';
export declare class Storage implements StorageInstance {
    private name;
    constructor(name: string);
    getKey(): string;
    load(): Promise<URICacheRegistry | null>;
    clear(): Promise<void>;
    save(registry: URICacheRegistry): Promise<void>;
}
