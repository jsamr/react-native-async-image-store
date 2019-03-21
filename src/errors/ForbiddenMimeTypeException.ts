import ExtendableError from 'es6-error'

export class ForbiddenMimeTypeException extends ExtendableError {
  constructor(targetUrl: string, mime: string) {
    super(`Download failed for image from origin ${targetUrl}. The response from origin contains a Content-Type header which doesn't describe an image mime type.`)
  }
}
