import ExtendableError from 'es6-error'

export class MissingContentTypeException extends ExtendableError {
  constructor(targetUrl: string) {
    super(`Download failed for image from origin ${targetUrl}. The response from origin doesn't contain any Content-Type header.`)
  }
}
