"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const urlRegex = new RegExp('^\\/|\\/$', 'g');
function joinUrlElements(rootURI, ...uris) {
    const args = Array.prototype.slice.call([rootURI, ...uris]);
    return args.map((element) => {
        return element.replace(urlRegex, '');
    }).join('/');
}
function joinUri(url, ...args) {
    return joinUrlElements(url, ...args);
}
exports.joinUri = joinUri;
