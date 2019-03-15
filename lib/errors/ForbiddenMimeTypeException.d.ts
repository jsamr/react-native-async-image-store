import ExtendableError from 'es6-error';
export declare class ForbiddenMimeTypeException extends ExtendableError {
    constructor(targetUrl: string, mime: string);
}
