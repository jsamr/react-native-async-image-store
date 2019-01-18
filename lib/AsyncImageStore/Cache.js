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
const xstream_1 = __importDefault(require("xstream"));
const dropRepeats_1 = __importDefault(require("xstream/extra/dropRepeats"));
const sampleCombine_1 = __importDefault(require("xstream/extra/sampleCombine"));
const react_native_1 = require("react-native");
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
            return "FETCHING";
        }
        if (!model.expired) {
            return 'REFRESHING';
        }
    }
    return model.error ? 'IDLE_SUCCESS' : 'IDLE_ERROR';
}
exports.deriveSyncStateFromModel = deriveSyncStateFromModel;
function defaultURIModel(uri, networkAvailable) {
    return {
        uri,
        networkAvailable,
        registered: false,
        expired: true,
        fetching: false,
        fileExists: false,
        path: '',
        localURI: '',
        versionTag: null,
        error: null
    };
}
function applyPatch(model, patch) {
    return ramda_1.mergeDeepRight(model, Object.assign({}, patch, { uri: model.uri }));
}
class Cache {
    constructor(initialModels) {
        this.initialModels = initialModels;
        this.lastEvents = new Map();
        this.pendingSubs = [];
        // Streams
        this.networkAvailable$ = xstream_1.default.createWithMemory();
        this.commands = new Map();
        this.events = new Map();
        // Callbacks
        this.callbacks = new Map();
        this.reactors = new Map();
        this.networkAvailable = true;
        this.mapModelToUpdateEvent = this.mapModelToUpdateEvent.bind(this);
        this.onNetinfo = this.onNetinfo.bind(this);
    }
    mapModelToUpdateEvent(model) {
        const nextEvent = {
            model,
            fileState: deriveFileStateFromModel(model),
            syncState: deriveSyncStateFromModel(model)
        };
        this.lastEvents.set(model.uri, nextEvent);
        return nextEvent;
    }
    onNetinfo({ type }) {
        const networkAvailable = type.toLowerCase() !== 'none';
        this.networkAvailable = networkAvailable;
        this.networkAvailable$.shamefullySendNext({ networkAvailable });
    }
    getEventsForURI(uri) {
        let events$ = this.events.get(uri);
        if (!events$) {
            const eventsProxy$ = xstream_1.default.create();
            const initialModel = this.initialModels.get(uri) || defaultURIModel(uri, this.networkAvailable);
            const commands$ = this.getCommandsForURI(uri);
            const listeners = new Set();
            const patchProducer = {
                start: listener => listeners.add(listener),
                stop: () => ({})
            };
            const userPatches$ = xstream_1.default.create(patchProducer);
            const networkPatches$ = this.networkAvailable$;
            const allPatches$ = xstream_1.default.merge(userPatches$, networkPatches$);
            const sub = commands$.compose(sampleCombine_1.default(eventsProxy$)).subscribe({
                next: ([cmd, model]) => {
                    const reactor = this.reactors.get(cmd.name);
                    if (reactor) {
                        const promise = reactor(model, (patch => { for (const li of listeners) {
                            li.next(patch);
                        } }), cmd.payload);
                        if (promise) {
                            promise.then(cmd.onResolve);
                        }
                    }
                    return null;
                }
            });
            allPatches$.debug();
            const models$ = allPatches$.fold(applyPatch, initialModel);
            events$ = models$.compose(dropRepeats_1.default()).map(this.mapModelToUpdateEvent);
            eventsProxy$.imitate(events$);
            this.events.set(uri, events$);
            this.pendingSubs.push(sub);
        }
        events$.debug();
        return events$;
    }
    getCommandsForURI(uri) {
        let commands$ = this.commands.get(uri);
        if (!commands$) {
            commands$ = xstream_1.default.create();
            this.commands.set(uri, commands$);
        }
        return commands$;
    }
    attach() {
        return __awaiter(this, void 0, void 0, function* () {
            const type = yield react_native_1.NetInfo.getConnectionInfo();
            this.onNetinfo(type);
            react_native_1.NetInfo.addEventListener('connectionChange', this.onNetinfo);
        });
    }
    detach() {
        return __awaiter(this, void 0, void 0, function* () {
            react_native_1.NetInfo.removeEventListener('connectionChange', this.onNetinfo);
            for (const sub of this.pendingSubs) {
                sub.unsubscribe();
            }
        });
    }
    addListener(uri, callback) {
        let events$ = this.getEventsForURI(uri);
        const listener = {
            next: (v) => callback(v).then()
        };
        events$.addListener(listener);
        this.callbacks.set(callback, listener);
    }
    removeListener(uri, callback) {
        let events$ = this.getEventsForURI(uri);
        const listener = this.callbacks.get(callback);
        if (listener) {
            events$.removeListener(listener);
        }
        this.callbacks.delete(callback);
    }
    registerCommandReactor(commandName, reactor) {
        this.reactors.set(commandName, reactor);
    }
    /**
     * Dispatch a command to be applied to given URI.
     * The returned promise resolves when the command has been applied.
     *
     * @param uri
     * @param commandName
     * @param payload
     */
    dispatchCommand(uri, commandName, payload) {
        const commands$ = this.getCommandsForURI(uri);
        this.getEventsForURI(uri);
        return new Promise((resolve) => {
            commands$.shamefullySendNext({
                payload,
                name: commandName,
                onResolve: () => resolve(this.getLastModelUpdateEvent(uri))
            });
        });
    }
    /**
     * Dispatch a command to all registered URIs.
     *
     * @param commandName The name of the command to dispatch.
     */
    dispatchCommandToAll(commandName) {
        return __awaiter(this, void 0, void 0, function* () {
            const states = [];
            for (const [uri] of this.lastEvents) {
                states.push(yield this.dispatchCommand(uri, commandName));
            }
            return states;
        });
    }
    /**
     * Dispatch a command to all URIs models satisfying the given predicate.
     * @param commandName
     * @param predicate
     */
    dispatchCommandWhen(commandName, predicate) {
        return __awaiter(this, void 0, void 0, function* () {
            const states = [];
            for (const [uri, state] of this.lastEvents) {
                if (predicate(state)) {
                    states.push(yield this.dispatchCommand(uri, commandName));
                }
            }
            return states;
        });
    }
    /**
     *
     * @param uri The URI to test.
     * @returns null if the URI has never been registered, CacheModelUpdateEvent otherwise
     */
    getLastModelUpdateEvent(uri) {
        return this.lastEvents.get(uri) || null;
    }
    /**
     * Free all resources associated with URI.
     *
     * @param uri
     */
    detatchURI(uri) {
        const command$ = this.commands.get(uri);
        command$ && command$.shamefullySendComplete();
        this.commands.delete(uri);
        const events$ = this.events.get(uri);
        events$ && events$.shamefullySendComplete();
        this.events.delete(uri);
        this.lastEvents.delete(uri);
    }
}
exports.Cache = Cache;
