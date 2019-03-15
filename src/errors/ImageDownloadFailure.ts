import ExtendableError from 'es6-error'

export class ImageDownloadFailure extends ExtendableError {
  constructor(targetUrl: string, status: number) {
    super(`Download failed for image from origin ${targetUrl}. Received status code ${status}.`)
  }
}
