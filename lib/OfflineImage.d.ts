import { ComponentType, PureComponent } from 'react';
import { ImageProps, ImageRequireSource, ImageSourcePropType } from 'react-native';
import { ImageSource, URICacheFileState, URICacheSyncState } from './AsyncImageStore';
export interface MinimalImageComponentProps {
    source?: ImageSourcePropType;
}
export declare type OfflineImageProps<C extends MinimalImageComponentProps = ImageProps> = {
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
    /**
     * When set to true, the image will stay in sync with the store state, after successful rendering.
     * Which means that if you revalidate the image, the loading component will show instead, unless you
     * set `staleWhileRevalidate` to true.
     *
     * **Default**: `false`
     *
     */
    reactive?: boolean;
    /**
     * Show the old image during revalidation instead of the loading component.
     * This only work with `reactive` set to true.
     *
     * **Default**: `false`
     */
    staleWhileRevalidate?: boolean;
} & C;
interface State {
    localURI: string;
    version: string;
    fileState: URICacheFileState;
    syncState: URICacheSyncState;
    networkAvailable: boolean;
}
export declare class OfflineImage<C extends MinimalImageComponentProps = ImageProps> extends PureComponent<OfflineImageProps<C>, State> {
    static defaultProps: Partial<OfflineImageProps>;
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
