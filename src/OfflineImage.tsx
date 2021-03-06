import React, { ComponentType, PureComponent } from 'react'
import { ImageProps, Image, ImageRequireSource, ActivityIndicator, ImageSourcePropType, StyleProp } from 'react-native'
import invariant from 'invariant'
import { AsyncImageStore, getStoreByName } from './AsyncImageStore'
import { URIEvent, ImageSource, URICacheFileState, URICacheSyncState } from './interfaces'

export interface MinimalImageComponentProps {
  source?: ImageSourcePropType
  style?: StyleProp<any>
}

export type OfflineImageProps<C extends MinimalImageComponentProps> = {
  /**
   * Remote source to be cached locally.
   * Headers are passed for request creation.
   */
  source: ImageSource
  /**
   * The name of the Store this component will be bound to.
   * 
   * **Warning**: This value will be read at construction-time and cannot be modified dynamically.
   * An invariant violation will be thrown on such attempt.
   */
  storeName: string
  /**
   * React Component (class or SFC) to render image.
   * Remaining props will be passed to this component instance.
   * 
   * **Default**: `Image`.
   */
  ImageComponent?: ComponentType<MinimalImageComponentProps>
  /**
   * React Component (class or SFC) displayed while image is being fetched on network.
   * By default, `fallbackStaticSource` will be displayed during network requests, if provided.
   * 
   * **Note**: Image props will be passed to this component instance.
   * 
   * **Default**: `ActivityIndicator` or `ImageComponent` with `fallbackStaticSource` if present
   */
  LoadingIndicatorComponent?: ComponentType<MinimalImageComponentProps>
  /**
   * The fallback image location.
   * Must be a local require to be accessed offline.
   */
  fallbackStaticSource?: ImageRequireSource
  /**
   * When set to true, the image will stay in sync with the store state, after successful rendering.
   * Which means that if you revalidate the image, the loading component will show instead, unless you
   * set `staleWhileRevalidate` to true.
   * 
   * **Default**: `false`
   * 
   */
  reactive?: boolean
  /**
   * Show the old image during revalidation instead of the loading component.
   * This only work with `reactive` set to true.
   * 
   * **Default**: `false`
   */
  staleWhileRevalidate?: boolean
  /**
   * The style prop send to the `ImageComponent`.
   */
  style?: StyleProp<any>
} & Pick<C, Exclude<keyof C, 'source' | 'style'>>

interface State {
  localFileName: string
  version: string
  fileState: URICacheFileState
  syncState: URICacheSyncState
  networkAvailable: boolean
}

export class OfflineImage<C extends MinimalImageComponentProps = ImageProps> extends PureComponent<OfflineImageProps<C>, State> {

  public static defaultProps: Partial<OfflineImageProps<ImageProps>> = {
    reactive: false,
    staleWhileRevalidate: false,
    ImageComponent: Image as any,
    LoadingIndicatorComponent: ActivityIndicator as any
  }

  private store: AsyncImageStore

  constructor(props: OfflineImageProps<C>) {
    super(props)
    const store = getStoreByName(props.storeName)
    invariant(store !== null, `OfflineImage: no store named ${props.storeName} could be found.`)
    invariant(props.source && props.source.uri !== null, 'OfflineImage: the source prop must contain a `uri` field.')
    this.store = store as AsyncImageStore
    this.state = {
      fileState: 'UNAVAILABLE',
      syncState: 'IDLE_SUCCESS',
      networkAvailable: false,
      version: '',
      localFileName: ''
    }
  }

  private onCacheEvent = async ({ nextState, nextModel }: URIEvent) => {
    this.setState({
      fileState: nextState.fileState,
      syncState: nextState.syncState,
      networkAvailable: nextState.networkState === 'AVAILABLE',
      version: nextModel.versionTag && nextModel.versionTag.value || this.state.version,
      localFileName: nextModel.localFileName
    })
    if (nextState.fileState === 'UNAVAILABLE' && nextState.networkState === 'AVAILABLE' && nextState.syncState !== 'IDLE_ERROR') {
      await this.store.preloadImage(this.props.source)
    }
    if (nextState.fileState === 'STALE' && nextState.networkState === 'AVAILABLE' && nextState.syncState !== 'IDLE_ERROR') {
      await this.store.revalidateImage(this.props.source)
    }
    if (nextState.fileState === 'FRESH' && !this.props.reactive) {
            // Unsubscribe to release memory
      this.store.removeCacheUpdateListener(this.props.source.uri, this.onCacheEvent)
    }
  }

  private async registerListener(props: OfflineImageProps<any>): Promise<void> {
    const event = this.store.addCacheUpdateListener(props.source.uri, this.onCacheEvent)
    return this.onCacheEvent(event)
  }

  private unregisterListener(props: OfflineImageProps<any>) {
    this.store.removeCacheUpdateListener(props.source.uri, this.onCacheEvent)
  }

  async componentDidMount(): Promise<void> {
    return this.registerListener(this.props)
  }

  componentWillUnmount() {
    this.unregisterListener(this.props)
  }

  async componentDidUpdate(oldProps: OfflineImageProps<C>/*, oldState: State*/): Promise<void> {
    const nextProps = this.props
    invariant(oldProps.storeName === nextProps.storeName, 'OfflineImage: storeName prop cannot be set dynamically.')
    invariant(nextProps.source && nextProps.source.uri !== null, 'OfflineImage: the source prop must contain a `uri` field.')
    if (oldProps.source.uri !== nextProps.source.uri) {
      this.unregisterListener(oldProps)
      await this.registerListener(nextProps)
    }
  }

  render() {
    const {
      source,
      ImageComponent = Image as ComponentType<any>,
      LoadingIndicatorComponent = ActivityIndicator as ComponentType<any>,
      fallbackStaticSource,
      storeName,
      staleWhileRevalidate,
      reactive,
      ...imageProps
    } = this.props
    const { fileState, syncState, localFileName, version } = this.state
    const loading = syncState === 'FETCHING' || (syncState === 'REFRESHING' && !staleWhileRevalidate)
    // tslint:disable-next-line: no-string-literal
    const localURI = this.store['getLocalURIFromLocalFileName'](localFileName)
    const displayFallback = fileState === 'UNAVAILABLE' && !loading
    if (displayFallback && fallbackStaticSource) {
      return <ImageComponent {...imageProps} source={fallbackStaticSource} />
    }
    if (loading || displayFallback) {
      return <LoadingIndicatorComponent {...imageProps} />
    }
    const imageKey = reactive && version ? `${source.uri}-${version}` : source.uri
    return <ImageComponent {...imageProps} source={{ uri: localURI }} key={imageKey} />
  }
}
