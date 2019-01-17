import { ComponentType, PureComponent, } from 'react'
import { ImageProps, Image, ImageSourcePropType, ImageURISource } from 'react-native'
import invariant from 'invariant'
import { AsyncImageStore, getStoreByName, CacheEvent, SecuredImageSource } from './AsyncImageStore'

export type OfflineImageProps<C extends ImageProps> = {
    /**
     * Remote source to be cached locally.
     */
    source: SecuredImageSource
    /**
     * The name of the Store this component will be bound to.
     * 
     * **Warning**: This value will be read at construction-time and cannot be modified dynamically.
     * An invariant violation will be thrown on such attempt.
     */
    storeName: string
    /**
     * The image Component to render.
     * Remaining props will be passed to this component instance.
     * 
     * **Default**: `Image`.
     */
    ImageComponent?: ComponentType<C>
    /**
     * 
     */
    fallbackSource?: ImageSourcePropType
    /**
     * When network is unavailable or origin server unreachable, and the image is stale, show
     * the image anyway. Otherwise, show the fallback if exists.
     * 
     * **Defaults**: `true`
     */
    staleIfNetworkError?: boolean
    /**
     * Show the staled version while revalidation occurs, and rerenders
     * the image after download, if it has been invalidated (status !== `304`).
     * 
     * **Defaults**: `true`
     */
    staleWhileRevalidate?: boolean
} & C

interface State {
    version: string
}

export class OfflineImage<C extends ImageProps = ImageProps> extends PureComponent<OfflineImageProps<C>, State> {
    
    private store: AsyncImageStore

    constructor(props: OfflineImageProps<C>) {
        super(props)
        const store = getStoreByName(props.storeName)
        invariant(store !== null, `OfflineImage: no store named ${props.storeName} could be found.`)
        invariant(props.source.uri == null, 'OfflineImage: the source prop must contain a `uri` field.')
        this.store = store as AsyncImageStore
    }

    private onCacheEvent = (event: CacheEvent) => {
        console.info(event)
    }

    componentWillMount() {
        this.store.addCacheEventListener(this.props.source.uri, this.onCacheEvent)
    }

    componentWillUnmount() {
        this.store.removeCacheEventListener(this.props.source.uri, this.onCacheEvent)
    }

    componentWillReceiveProps(newProps: 
        
        <C>) {
        invariant(this.props.storeName === newProps.storeName, "OfflineImage: storeName prop cannot be set dynamically.")
        invariant(this.props.source.uri === newProps.source.uri, "OfflineImage: source prop cannot be set dynamically.")
    }
    
    render() {
        const { ImageComponent = Image, staleIfNetworkError, staleWhileRevalidate, ...imageProps } = this.props
        return <ImageComponent {...imageProps as C} />
    }
}