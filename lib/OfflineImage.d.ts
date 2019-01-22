import { ComponentType, PureComponent } from 'react';
import { ImageProps, ImageRequireSource } from 'react-native';
import { ImageSource, URICacheFileState, URICacheSyncState } from './AsyncImageStore';
export declare type OfflineImageProps<C extends ImageProps = ImageProps> = {
    /**
     * Remote source to be cached locally.
     * Headers are passed for request creation.
     */
    source: ImageSource;
    /**
     * The name of the Store this component will be bound to.
     *
     * **Warning**: This value will be read at construction-time and cannot be modified dynamically.
     * An invariant violation will be thrown on such attempt.
     */
    storeName: string;
    /**
     * React Component (class or SFC) to render image.
     * Remaining props will be passed to this component instance.
     *
     * **Default**: `Image`.
     */
    ImageComponent?: ComponentType<C>;
    /**
     * React Component (class or SFC) displayed while image is being fetched on network.
     * By default, `fallbackStaticSource` will be displayed during network requests, if provided.
     *
     * **Note**: Image props will be passed to this component instance.
     *
     * **Default**: `ActivityIndicator` or `ImageComponent` with `fallbackStaticSource` if present
     */
    LoadingIndicatorComponent?: ComponentType<C>;
    /**
     * The fallback image location.
     * Must be a local require to be accessed offline.
     */
    fallbackStaticSource?: ImageRequireSource;
} & C;
interface State {
    localURI: string;
    version: string;
    fileState: URICacheFileState;
    syncState: URICacheSyncState;
    networkAvailable: boolean;
}
export declare class OfflineImage<C extends ImageProps = ImageProps> extends PureComponent<OfflineImageProps<C>, State> {
    private store;
    private ref?;
    constructor(props: OfflineImageProps<C>);
    private onRef;
    private onCacheEvent;
    private registerListener;
    private unregisterListener;
    componentWillMount(): Promise<void>;
    componentWillUnmount(): void;
    componentWillReceiveProps(nextProps: OfflineImageProps<C>, nextState: State): Promise<void>;
    render(): JSX.Element;
}
export {};
