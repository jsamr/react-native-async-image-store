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
exports.DEBOUNCE_DELAY = 500;
class State {
    constructor(name) {
        this.name = name;
        this.reactors = new Map();
        this.listeners = new Map();
        this.lastEvents = new Map();
        this.registryListeners = new Set();
        this.cacheStore = {
            networkAvailable: true,
            registry: {}
        };
        this.updateURIModel = this.updateURIModel.bind(this);
        this.updateNetworkModel = this.updateNetworkModel.bind(this);
        // Throttle dispatch commands to prevent I/O and CPU obstruction
        // 10 operations / second seems like a sane limit
        this.dispatchCommand = p_throttle_1.default(this.dispatchCommand.bind(this), 10, 1000);
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
    /**
     *
     * @param uri Initialize the URI model if unregistered.
     */
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
    /**
     * Add a hook on registry updates.
     *
     * **Info**: updates are debounced every 400ms, and limitted to one running promise per listener.
     *
     * @param listener
     */
    addRegistryUpdateListener(listener) {
        const debouncedListener = p_debounce_1.default(listener, exports.DEBOUNCE_DELAY);
        this.registryListeners.add(debouncedListener);
    }
    /**
     * Asynchronously update the given URI model.
     *
     * @param uri
     * @param patch
     * @param type
     */
    updateURIModel(uri, patch) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = ['registry', uri];
            const uriLens = ramda_1.lensPath(path);
            const viewURI = ramda_1.view(uriLens);
            const next = patch ?
                ramda_adjunct_1.mergePath(path, patch, this.cacheStore) :
                ramda_1.assocPath(path, null, this.cacheStore);
            if (!ramda_1.equals(viewURI(next), viewURI(this.cacheStore))) {
                this.cacheStore = next;
                yield this.notifyURIListeners(uri, viewURI(next));
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
    /**
     * Register a function which will be called when an event is dispatched to a specific URI.
     *
     * @param commandName
     * @param reactor
     */
    registerCommandReactor(commandName, reactor) {
        this.reactors.set(commandName, reactor);
    }
    getURIModel(uri) {
        const lens = this.getURILens(uri);
        return ramda_1.view(lens, this.cacheStore);
    }
    /**
     * Asynchronously add a listener and return a promise resolving to the last event associated with the given URI.
     * If no URI has been registered yet, the returned event is of type `URI_INIT`.
     *
     * @param uri
     * @param listener
     * @return A `URIEvent` containing the last state and model associated with this URI.
     */
    addListener(uri, listener) {
        const listeners = this.getListenersForURI(uri);
        const lastEvent = this.getLastURIEvent(uri);
        listeners.add(listener);
        return lastEvent;
    }
    /**
     * Remove a listener.
     *
     * @param uri
     * @param listener
     */
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
    /**
     * Dispatch a command to be applied to given URI.
     * The returned promise resolves when the command has been applied.
     *
     * @param uri
     * @param commandType
     * @param payload
     */
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
    /**
     * Dispatch a command to all registered URIs.
     *
     * @param commandType
     * @param payload?
     */
    dispatchCommandToAll(commandType, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            for (const uri of Object.getOwnPropertyNames(this.cacheStore.registry)) {
                events.push(yield this.dispatchCommand(uri, commandType, payload));
            }
            return events;
        });
    }
    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandType
     * @param predicate
     */
    dispatchCommandWhen(commandType, predicate, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const events = [];
            for (const [uri, event] of this.lastEvents) {
                if (predicate(event.nextState)) {
                    events.push(yield this.dispatchCommand(uri, commandType));
                }
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
