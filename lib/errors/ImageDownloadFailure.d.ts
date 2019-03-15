import ExtendableError from 'es6-error';
export declare class ImageDownloadFailure extends ExtendableError {
    constructor(targetUrl: string, status: number);
}
