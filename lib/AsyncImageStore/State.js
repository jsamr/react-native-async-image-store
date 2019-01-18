"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ramda_adjunct_1 = require("ramda-adjunct");
const ramda_1 = require("ramda");
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
        fileState: deriveFileStateFromModel(model),
        syncState: deriveSyncStateFromModel(model),
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
class State {
    constructor() {
        this.reactors = new Map();
        this.listeners = new Map();
        this.lastEvents = new Map();
        this.cacheStore = {
            networkAvailable: true,
            uriStates: {}
        };
        this.updateURIModel = this.updateURIModel.bind(this);
        this.updateNetworkModel = this.updateNetworkModel.bind(this);
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
        });
    }
    getURILens(uri) {
        const path = ['uriStates', uri];
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
     * Asynchronously update the given URI model.
     *
     * @param uri
     * @param patch
     * @param type
     */
    updateURIModel(uri, patch) {
        return __awaiter(this, void 0, void 0, function* () {
            const path = ['uriStates', uri];
            const uriLens = ramda_1.lensPath(path);
            const next = ramda_adjunct_1.mergePath(path, patch, this.cacheStore);
            const viewURI = ramda_1.view(uriLens);
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
                // tslint:disable-next-line:forin
                for (const uri in Object.keys(this.cacheStore.uriStates)) {
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
                yield reactor(lastEvent, ramda_1.partial(this.updateURIModel, [uri]), payload);
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
            for (const uri of Object.getOwnPropertyNames(this.cacheStore.uriStates)) {
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
    mount() {
        return __awaiter(this, void 0, void 0, function* () {
            //
        });
    }
    unmount() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const [_uri, listener] of this.listeners) {
                listener.clear();
            }
        });
    }
}
exports.State = State;
