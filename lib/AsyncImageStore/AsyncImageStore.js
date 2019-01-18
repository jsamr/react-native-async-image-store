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
const invariant_1 = __importDefault(require("invariant"));
const Fetcher_1 = require("./Fetcher");
const react_native_1 = require("react-native");
const State_1 = require("./State");
const storesMap = new Map();
const defaultConfig = {
    debug: false,
    defaultMaxAge: 86000
};
const FILE_PREFIX = react_native_1.Platform.OS === 'ios' ? '' : 'file://';
function getSourceFromUri(target) {
    if (typeof target === 'string') {
        return { uri: target };
    }
    return target;
}
function reportToProposal(report) {
    const { path, versionTag, expires } = report;
    return {
        path,
        versionTag,
        localURI: FILE_PREFIX + path,
        expired: expires < new Date().getTime(),
        fetching: false,
        error: report.error,
        fileExists: report.error === null
    };
}
class AsyncImageStore {
    constructor(name, userConfig) {
        this.name = name;
        this.mounted = false;
        invariant_1.default(name !== '', 'AsyncImageStore: store name cannot be empty.');
        invariant_1.default(!storesMap.has(name), 'AsyncImageStore: only one instance per storeName is allowed.');
        storesMap.set(name, this);
        const config = Object.assign({}, defaultConfig, userConfig);
        this.config = config;
        this.fetcher = new Fetcher_1.Fetcher(name, config);
        this.state = new State_1.State();
        this.state.registerCommandReactor('PRELOAD', this.onPreload.bind(this));
        this.state.registerCommandReactor('REVALIDATE', this.onRevalidate.bind(this));
        this.state.registerCommandReactor('DELETE', this.onDelete.bind(this));
    }
    onPreload(event, propose, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const { nextModel: model, nextState: state } = event;
            const { uri } = model;
            if (state.fileState === 'FRESH') {
                this.log(`File from origin ${uri} is FRESH; ignoring preloading.`);
                return;
            }
            if (state.fileState === 'STALE') {
                return this.onRevalidate(event, propose, headers);
            }
            if (state.networkState === 'UNAVAILABLE') {
                this.log(`File from origin ${uri} cannot be preloaded: network is unavailable.`);
                propose({ error: new Error('Network is unavailable.') });
                return;
            }
            const preloadProposal = { fetching: true, registered: true, error: null };
            if (headers) {
                preloadProposal.headers = headers;
            }
            propose(preloadProposal);
            const report = yield this.fetcher.saveImage(model);
            propose(reportToProposal(report));
            this.logReport(report, uri);
        });
    }
    onRevalidate(event, propose, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            const { nextModel: model, nextState: state } = event;
            let revalidate = false;
            if (!model.registered) {
                this.log(`File with origin ${model.uri} is unregistered; preload must be invoked first; ignoring revalidation.`);
                return;
            }
            const exists = yield this.fetcher.imageExists(model);
            if (exists === false) {
                propose({ fileExists: false });
                if (state.networkState === 'AVAILABLE') {
                    this.log(`File from origin ${model.uri} does not exists anymore. Revalidating...`);
                    revalidate = true;
                }
                else {
                    this.log(`File from origin ${model.uri} does not exists anymore but network is unavailable. ignoring revalidation.`);
                }
            }
            else {
                if (state.fileState === 'FRESH') {
                    this.log(`File from origin ${model.uri} is FRESH, ignoring revalidation.`);
                }
                if (state.fileState === 'STALE' && state.networkState === 'UNAVAILABLE') {
                    this.log(`File from origin ${model.uri} is STALE but network is not available; ignoring revalidation.`);
                }
            }
            revalidate = revalidate && (state.fileState === 'UNAVAILABLE' || state.fileState === 'STALE');
            if (revalidate) {
                const preloadProposal = { fetching: true, error: null };
                if (headers) {
                    preloadProposal.headers = headers;
                }
                propose(preloadProposal);
                const report = model.versionTag && exists ?
                    yield this.fetcher.revalidateImage(model, model.versionTag) :
                    yield this.fetcher.saveImage(model);
                propose(reportToProposal(report));
                this.logReport(report, model.uri);
            }
        });
    }
    onDelete(event, propose) {
        return __awaiter(this, void 0, void 0, function* () {
            propose({ fileExists: false });
            yield this.fetcher.deleteImage(event.nextModel);
        });
    }
    logReport(report, uri) {
        if (report.error) {
            this.log(`File download from origin ${uri} failed.\n${report.error.message}`);
        }
        else {
            this.log(`File download from origin ${uri} succeeded.`);
        }
    }
    log(info) {
        if (this.config.debug) {
            console.log(`AsyncImageStore ${this.name}: ${info}`);
        }
    }
    dispatchCommandToURI(uri, name, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.state.dispatchCommand(uri, name, payload);
        });
    }
    dispatchCommandToAll(name) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.state.dispatchCommandToAll(name);
        });
    }
    dispatchCommandWhen(name, when) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.state.dispatchCommandWhen(name, when);
        });
    }
    assertMountInvariant() {
        invariant_1.default(this.mounted, `${this.constructor.name} actions must be invoked after mounting occurs, but Store \`${this.name}' is unmounted.`);
    }
    /**
     * Mount the Store, restoring cache metadata from storage.
     *
     * **Suggestion**: Mount this Store during your application initialization, ideally in the root component, where you can display a splashscreen or an activity indicator while
     * it happens.
     */
    mount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.state.mount();
            this.mounted = true;
        });
    }
    /**
     * Release the Store.
     *
     * **Suggestion**: Unmount the Store in your root component, in `componentWillUnmount` method, **which you can declare `async`**.
     *
     * **Info**: Carefully consuming lifecycle methods is mandatory to prevent memory leaks. Note that cache metadata is persisted on change.
     */
    unmount() {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            this.mounted = false;
            yield this.state.unmount();
        });
    }
    /**
     * Inform if Store is mounted
     */
    isMounted() {
        return this.mounted;
    }
    /**
     * Add a listener which gets called every time the cache model associated with the given
     * uri resource change.
     *
     * @param uri
     * @param listener
     * @return The most-recent `URIEvent` associated with the given URI.
     * If this URI has not been registered yet, the return event will be of type `URI_INIT`.
     */
    addCacheUpdateListener(uri, listener) {
        this.assertMountInvariant();
        return this.state.addListener(uri, listener);
    }
    /**
     * Remove a previously registered listener.
     *
     * @param uri
     * @param listener
     */
    removeCacheUpdateListener(uri, listener) {
        this.state.removeListener(uri, listener);
    }
    /**
     * Asynchronously preload the provided image to Store.
     *
     * **Info** This function will revalidate an image which has already been preloaded, and download unconditionnaly otherwise.
     *
     * @param target string URI or React `ImageURISource` prop
     * @return A Promise resolving to the next `URIEvent`
     */
    preloadImage(target) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            const source = getSourceFromUri(target);
            return this.dispatchCommandToURI(source.uri, 'PRELOAD', source.headers);
        });
    }
    /**
     * Asynchronously preload the list of images to Store.
     *
     * **Info** This function will revalidate images which are already preloaded, and download the others.
     *
     * @param targets an array of string URI or React `ImageURISource` prop
     * @return A Promise resolving to an array of `URIEvent`
     */
    preloadImages(targets) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            const events = [];
            for (const target of targets) {
                events.push(yield this.preloadImage(target));
            }
            return events;
        });
    }
    /**
     * Delete an existing image from the Store.
     * Does nothing if the provided URI have no matching entry in Store.
     *
     * @param target
     */
    deleteImage(target) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            const source = getSourceFromUri(target);
            return this.dispatchCommandToURI(source.uri, 'DELETE');
        });
    }
    /**
     * Delete all images from the Store.
     */
    deleteAllImages() {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            return this.dispatchCommandToAll('DELETE');
        });
    }
    /**
     * Delete all image which are stale from the Store.
     */
    deleteAllStaleImages() {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            return this.dispatchCommandWhen('DELETE', (s => s.fileState === 'STALE'));
        });
    }
    /**
     * Asynchronously revalidate a stored image:
     *
     * - **if it was previously registered** and
     * - **if it is staled**
     *
     * **Info**: Revalidation is done with:
     *
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     *
     * **Warning** This method does nothing on a resource which has not been registered,
     * i.e. to which `preload` has not been called at least once.
     *
     * @param target string URI or React `ImageURISource` prop
     * @return A Promise resolving to the next `URIEvent`
     */
    revalidateImage(target) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            const source = getSourceFromUri(target);
            return this.dispatchCommandToURI(source.uri, 'REVALIDATE', source.headers);
        });
    }
    /**
     * Revalidate all stale images in the store.
     *
     * **Info**: Revalidation is done with:
     *
     * - file existence checking;
     * - conditionnal HTTP requests, with `If-None-Match` or `If-Modified-Since` headers.
     */
    revalidateAllStaleImages() {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertMountInvariant();
            return this.dispatchCommandWhen('REVALIDATE', (s => s.fileState === 'STALE'));
        });
    }
}
exports.AsyncImageStore = AsyncImageStore;
function getStoreByName(name) {
    return storesMap.get(name) || null;
}
exports.getStoreByName = getStoreByName;
function createStore(name, userConfig) {
    return new AsyncImageStore(name, userConfig || {});
}
exports.createStore = createStore;
