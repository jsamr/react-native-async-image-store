import ExtendableError from 'es6-error';
export declare class MissingContentTypeException extends ExtendableError {
    constructor(targetUrl: string);
}
