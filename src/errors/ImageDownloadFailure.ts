import ExtendableError from 'es6-error'

export class ImageDownloadFailure extends ExtendableError {
  constructor(targetUrl: string, status?: number, reason?: string) {
    const postfix = (status && `Received status code ${status}.`) || reason || ''
    super(`Download failed for image from origin ${targetUrl}. ${postfix}`)
  }
}
