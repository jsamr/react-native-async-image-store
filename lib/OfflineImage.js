"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const invariant_1 = __importDefault(require("invariant"));
const AsyncImageStore_1 = require("./AsyncImageStore");
class OfflineImage extends react_1.PureComponent {
    constructor(props) {
        super(props);
        this.onRef = (ref) => {
            this.ref = ref;
        };
        this.onCacheEvent = ({ nextState, nextModel }) => __awaiter(this, void 0, void 0, function* () {
            this.setState({
                fileState: nextState.fileState,
                syncState: nextState.syncState,
                networkAvailable: nextState.networkState === 'AVAILABLE',
                version: nextModel.versionTag && nextModel.versionTag.value || this.state.version,
                localURI: nextModel.localURI
            });
            if (nextState.fileState === 'UNAVAILABLE' && nextState.networkState === 'AVAILABLE' && nextState.syncState !== 'IDLE_ERROR') {
                yield this.store.preloadImage(this.props.source);
            }
            if (nextState.fileState === 'STALE' && nextState.networkState === 'AVAILABLE' && nextState.syncState !== 'IDLE_ERROR') {
                yield this.store.revalidateImage(this.props.source);
            }
            if (nextState.fileState === 'FRESH' && !this.props.reactive) {
                // Unsubscribe to release memory
                this.store.removeCacheUpdateListener(this.props.source.uri, this.onCacheEvent);
            }
        });
        const store = AsyncImageStore_1.getStoreByName(props.storeName);
        invariant_1.default(store !== null, `OfflineImage: no store named ${props.storeName} could be found.`);
        invariant_1.default(props.source && props.source.uri !== null, 'OfflineImage: the source prop must contain a `uri` field.');
        this.store = store;
        this.state = {
            fileState: 'UNAVAILABLE',
            syncState: 'IDLE_SUCCESS',
            networkAvailable: false,
            version: '',
            localURI: ''
        };
    }
    registerListener(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const event = this.store.addCacheUpdateListener(props.source.uri, this.onCacheEvent);
            yield this.onCacheEvent(event);
        });
    }
    unregisterListener(props) {
        this.store.removeCacheUpdateListener(props.source.uri, this.onCacheEvent);
    }
    componentWillMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.registerListener(this.props);
        });
    }
    componentWillUnmount() {
        this.unregisterListener(this.props);
    }
    componentWillReceiveProps(nextProps, nextState) {
        return __awaiter(this, void 0, void 0, function* () {
            invariant_1.default(this.props.storeName === nextProps.storeName, 'OfflineImage: storeName prop cannot be set dynamically.');
            invariant_1.default(nextProps.source && nextProps.source.uri !== null, 'OfflineImage: the source prop must contain a `uri` field.');
            if (this.props.source.uri !== nextProps.source.uri) {
                this.unregisterListener(this.props);
                yield this.registerListener(nextProps);
            }
            if (nextState.version !== this.state.version && nextState.syncState === 'IDLE_SUCCESS') {
                // Force update since local version has changed
                this.ref && this.ref.forceUpdate();
            }
        });
    }
    render() {
        const _a = this.props, { source, ImageComponent = react_native_1.Image, LoadingIndicatorComponent = react_native_1.ActivityIndicator, fallbackStaticSource, storeName, staleWhileRevalidate } = _a, imageProps = __rest(_a, ["source", "ImageComponent", "LoadingIndicatorComponent", "fallbackStaticSource", "storeName", "staleWhileRevalidate"]);
        const { fileState, syncState, localURI } = this.state;
        const loading = syncState === 'FETCHING' || (syncState === 'REFRESHING' && !staleWhileRevalidate);
        const displayFallback = fileState === 'UNAVAILABLE' && !loading;
        if (displayFallback && fallbackStaticSource) {
            return react_1.default.createElement(ImageComponent, Object.assign({ source: fallbackStaticSource }, imageProps));
        }
        if (loading || displayFallback) {
            return react_1.default.createElement(LoadingIndicatorComponent, Object.assign({}, imageProps));
        }
        return react_1.default.createElement(ImageComponent, Object.assign({ source: { uri: localURI }, ref: this.onRef }, imageProps));
    }
}
OfflineImage.defaultProps = {
    reactive: false,
    staleWhileRevalidate: false,
    ImageComponent: react_native_1.Image,
    LoadingIndicatorComponent: react_native_1.ActivityIndicator
};
exports.OfflineImage = OfflineImage;
