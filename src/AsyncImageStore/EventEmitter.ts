import { CacheEventCallback, CacheEvent } from "./types";

export class EventEmitter {
    
    private listeners: Map<string, Set<CacheEventCallback>> = new Map()
    
    private getCallbacksForUri(uri: string): Set<CacheEventCallback> {
        let callbacksForUri: Set<CacheEventCallback> = this.listeners.get(uri) || new Set()
        this.listeners.set(uri, callbacksForUri)
        return callbacksForUri
    }

    public addListener(uri: string, listener: CacheEventCallback) {
        let callbacksForUri = this.getCallbacksForUri(uri)
        callbacksForUri.add(listener)
    }

    public removeListener(uri: string, listener: CacheEventCallback) {
        let callbacksForUri = this.getCallbacksForUri(uri)
        callbacksForUri.delete(listener)
    }

    public dispatch(event: CacheEvent) {
        const callbacks = this.getCallbacksForUri(event.uri)
        for (const listener of callbacks) {
            listener(event)
        }
    }
}