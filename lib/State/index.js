"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ramda_adjunct_1 = require("ramda-adjunct");
const ramda_1 = require("ramda");
const p_debounce_1 = __importDefault(require("p-debounce"));
const p_throttle_1 = __importDefault(require("p-throttle"));
const rn_fetch_blob_1 = __importDefault(require("rn-fetch-blob"));
const buffer_1 = require("buffer");
const invariant_1 = __importDefault(require("invariant"));
function deriveFileStateFromModel(model) {
    const expired = model.expired;
    if (model.fileExists) {
        return expired ? 'STALE' : 'FRESH';
    }
    return 'UNAVAILABLE';
}
exports.deriveFileStateFromModel = deriveFileStateFromModel;
function deriveSyncStateFromModel(model) {
    if (model.fetching) {
        if (!model.fileExists) {
            return 'FETCHING';
        }
        if (!model.expired) {
            return 'REFRESHING';
        }
    }
    return model.error ? 'IDLE_ERROR' : 'IDLE_SUCCESS';
}
exports.deriveSyncStateFromModel = deriveSyncStateFromModel;
function getURIStateFromModel(model, networkAvailable) {
    return {
        fileState: model ? deriveFileStateFromModel(model) : 'UNAVAILABLE',
        syncState: model ? deriveSyncStateFromModel(model) : 'DELETED',
        networkState: networkAvailable ? 'AVAILABLE' : 'UNAVAILABLE'
    };
}
exports.getURIStateFromModel = getURIStateFromModel;
function getInitialURICacheModel(uri) {
    return {
        uri,
        error: null,
        expired: true,
        fetching: false,
        fileExists: false,
        localURI: '',
        path: '',
        registered: false,
        versionTag: null
    };
}
exports.getInitialURICacheModel = getInitialURICacheModel;
const initialCacheStore = {
    networkAvailable: true,
    registry: {}
};
exports.DEBOUNCE_DELAY = 500;
class State {
    constructor(config, storeName) {
        this.config = config;
        this.storeName = storeName;
        this.reactors = new Map();
        this.listeners = new Map();
        this.lastEvents = new Map();
        this.registryListeners = new Set();
        this.cacheStore = ramda_1.clone(initialCacheStore);
        this.updateURIModel = this.updateURIModel.bind(this);
        this.updateNetworkModel = this.updateNetworkModel.bind(this);
        // Throttle dispatch commands to prevent I/O and CPU obstruction
        // 10 operations / second seems like a sane limit
        this.dispatchCommand = p_throttle_1.default(this.dispatchCommand.bind(this), config.ioThrottleFrequency, 1000);
    }
    getListenersForURI(uri) {
        let listeners = this.listeners.get(uri);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(uri, listeners);
        }
        return listeners;
    }
    notifyURIListeners(uri, nextModel, type = 'URI_UPDATE') {
        return __awaiter(this, void 0, void 0, function* () {
            const listeners = this.getListenersForURI(uri);
            const nextState = getURIStateFromModel(nextModel, this.cacheStore.networkAvailable);
            const nextEvent = {
                type,
                nextModel,
                nextState
            };
            this.lastEvents.set(uri, nextEvent);
            for (const listener of listeners) {
                const resp = listener(nextEvent);
                resp && (yield resp);
            }
            for (const listener of this.registryListeners) {
                // Calls are limited to one after the other, preventing parallel
                // Storage.save calls.
                yield listener(this.cacheStore.registry);
            }
        });
    }
    getURILens(uri) {
        const path = ['registry', uri];
        return ramda_1.lensPath(path);
    }
    initURIModel(uri) {
        if (!this.lastEvents.get(uri)) {
            const lens = this.getURILens(uri);
            this.cacheStore = ramda_1.set(lens, getInitialURICacheModel(uri))(this.cacheStore);
            const nextModel = ramda_1.view(lens)(this.cacheStore);
            const nextState = getURIStateFromModel(nextModel, this.cacheStore.networkAvailable);
            const nextEvent = {
                nextModel,
                nextState,
                type: 'URI_INIT'
            };
            this.lastEvents.set(uri, nextEvent);
        }
    }
    addRegistryUpdateListener(listener) {
        const debouncedListener = p_debounce_1.default(listener, exports.DEBOUNCE_DELAY);
        this.registryListeners.add(debouncedListener);
    }
    updateURIModel(uri, patch) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = ['registry', uri];
            const uriLens = ramda_1.lensPath(path);
            const viewURI = ramda_1.view(uriLens);
            const next = patch ?
                ramda_adjunct_1.mergePath(path, patch, this.cacheStore) :
                ramda_1.dissocPath(path, this.cacheStore);
            if (!ramda_1.equals(viewURI(next), viewURI(this.cacheStore))) {
                this.cacheStore = next;
                yield this.notifyURIListeners(uri, viewURI(next));
            }
            if (patch === null) {
                // remove event entry
                this.lastEvents.delete(uri);
            }
        });
    }
    updateNetworkModel(networkAvailable) {
        return __awaiter(this, void 0, void 0, function* () {
            const networkLens = ramda_1.lensProp('networkAvailable');
            if (networkAvailable !== this.cacheStore.networkAvailable) {
                this.cacheStore = ramda_1.set(networkLens, networkAvailable, this.cacheStore);
                for (const uri of Object.keys(this.cacheStore.registry)) {
                    const lens = this.getURILens(uri);
                    const actual = ramda_1.view(lens, this.cacheStore);
                    yield this.notifyURIListeners(uri, actual, 'NETWORK_UPDATE');
                }
            }
        });
    }
    registerCommandReactor(commandName, reactor) {
        this.reactors.set(commandName, reactor);
    }
    getURIModel(uri) {
        const lens = this.getURILens(uri);
        return ramda_1.view(lens, this.cacheStore);
    }
    getLocalPathFromURI(uri) {
        const pathLens = ramda_1.lensProp('path');
        const pathFromURI = ramda_1.view(pathLens, this.getURIModel(uri));
        invariant_1.default(pathFromURI !== undefined, 'the fetched URI has no matching model in registry');
        return pathFromURI;
    }
    getBaseDir() {
        const dir = this.config.fsKind === 'CACHE' ?
            rn_fetch_blob_1.default.fs.dirs.CacheDir :
            rn_fetch_blob_1.default.fs.dirs.DocumentDir;
        return `${dir}/${this.storeName}`;
    }
    getTempFilenameFromURI(uri) {
        return `${this.getBaseDir()}/${buffer_1.Buffer.from(uri).toString('base64')}`;
    }
    addListener(uri, listener) {
        const listeners = this.getListenersForURI(uri);
        const lastEvent = this.getLastURIEvent(uri);
        listeners.add(listener);
        return lastEvent;
    }
    removeListener(uri, listener) {
        const listeners = this.getListenersForURI(uri);
        listeners.delete(listener);
    }
    getLastURIEvent(uri) {
        const lastEvent = this.lastEvents.get(uri);
        if (!lastEvent) {
            this.initURIModel(uri);
        }
        return this.lastEvents.get(uri);
    }
    dispatchCommand(uri, commandType, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const reactor = this.reactors.get(commandType);
            const lastEvent = this.getLastURIEvent(uri);
            if (reactor) {
                yield reactor(lastEvent, (...args) => this.updateURIModel(uri, ...args), payload);
                return this.getLastURIEvent(uri);
            }
            return lastEvent;
        });
    }
    dispatchCommandToAll(commandType, payload, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            const properties = Object.getOwnPropertyNames(this.cacheStore.registry);
            let i = 0;
            for (const uri of properties) {
                const nextEvent = yield this.dispatchCommand(uri, commandType, payload);
                events.push(nextEvent);
                onProgress && onProgress(nextEvent, i, properties.length);
                i = i + 1;
            }
            return events;
        });
    }
    dispatchCommandWhen(commandType, predicate, payload, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            const applicableEvents = Array.from(this.lastEvents.values()).filter(e => predicate(e.nextState));
            let i = 0;
            for (const event of applicableEvents) {
                const nextEvent = yield this.dispatchCommand(event.nextModel.uri, commandType, payload);
                events.push(nextEvent);
                onProgress && onProgress(nextEvent, i, applicableEvents.length);
                i = i + 1;
            }
            return events;
        });
    }
    mount(initialRegistry) {
        return __awaiter(this, void 0, void 0, function* () {
            if (initialRegistry) {
                this.cacheStore.registry = initialRegistry;
                for (const uri of Object.getOwnPropertyNames(initialRegistry)) {
                    const model = initialRegistry[uri];
                    const state = getURIStateFromModel(model, this.cacheStore.networkAvailable);
                    const event = {
                        nextModel: model,
                        nextState: state,
                        type: 'URI_INIT'
                    };
                    this.lastEvents.set(uri, event);
                }
            }
        });
    }
    unmount() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [_uri, listener] of this.listeners) {
                listener.clear();
            }
            this.registryListeners.clear();
        });
    }
}
exports.State = State;
