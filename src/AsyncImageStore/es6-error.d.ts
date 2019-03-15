declare module 'es6-error' {
    type ExtendableError = new(message?: string) => Error
    const ExtendableError: ExtendableError
    export = ExtendableError
}