# The image async store for react native

**Pros**:

- methods return promises (usage with async / await)
- cache validation is fully compatible with `Cache-Control`, `Expires`, `Last-Modified`, and `ETag` HTTP headers for an optimal bandwidth consumption

## Constructor params

### `defaultMaxAge` and `overrideMaxAge` parameters

`max-age` is a `Cache-Control` directive defining the default duration for which images will be fresh (contrary to stale).

- `defaultMaxAge` will be the default freshness duration when no `Cache-control: max-age` directive or `Expires` header has been given in the image response.
- `overrideMaxAge` will override any freshness duration specified in a `Cache-control: max-age` directive or `Expires` header.
- **You can use `Infinity` to enforce a never-expire policy**

### `defaultCacheControl` and `overrideCacheControl` parameters

## Cache policy derived from HTTP response headers

The Store will try to behave as a HTTP cache, **deriving its caching policy  from both HTTP headers in the image response and user-provided parameters.**

But contrary to a browser cache:

- when offline, any stored image will be served to components, even if it's stale and [`must-revalidate` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Revalidation_and_reloading) should be enforced. This is equivalent to request cache with [`Cache-Control: stale-if-error` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#Expiration).
- library user can add, revalidate, redownload or remove an image programatically
- library user can revalidate all stale images from the store
- library user can remove all stale images from the store

### `Cache-Control`

Because `no-store` directive defies the purpose of this library, it will be ignored unless `followNoStore` parameter is provided.

#### Followed directives

- `must-revalidate`: force Store to revalidate image every time it is requested and stale;
- `max-age=<seconds>`: Specifies the maximum amount of time a resource will be considered fresh. Contrary to `Expires`, this directive is relative to the time of the request;
- `no-cache`: equivalent to `must-revalidate, max-age=0`.

#### Sensible defaults

- If no `Cache-Control` while `Expires` header was provided, the Store will behave equivalently to `Cache-Control: must-revalidate, max-age=<inferredMaxAge>`
- If no `Cache-Control` and no `Expires` headers were provided in response, the Store will behave following `defaultCacheControl` directives parameter, which defaults to `must-revalidate, max-age=<defaultMaxAge>`.

### `Expires`

`Expires` will be used to determine resource freshness when `Cache-Control: max-age=<...>` directive is missing.

### `ETag` and `Last-Modified`

When `Etag` or `Last-Modified` are present in an image response, there value will be used to revalidate stale resources. By providing `If-None-Match` and `If-Modified-Since` headers when requesting origin server, the Store will receive `304 Unmodified` status when images haven't changed, **sparing valuable bandwidth to the end users of your product**.

If both headers are present, `ETag` will prevail.

### Corner cases


- If revalidation cannot be operated because the network or origin server is unavailable, the Store will serve the stale resource in the meanwhile, ignoring strict revalidation directives.