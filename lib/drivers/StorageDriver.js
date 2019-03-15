"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
class StorageDriver {
    constructor(name) {
        this.name = name;
    }
    getKey() {
        return `AsyncImageStore-${this.name}`;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            const registryStr = yield react_native_1.AsyncStorage.getItem(this.getKey());
            if (!registryStr) {
                return null;
            }
            try {
                return JSON.parse(registryStr);
            }
            catch (e) {
                yield this.clear();
            }
            return null;
        });
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            return react_native_1.AsyncStorage.removeItem(this.getKey());
        });
    }
    save(registry) {
        return __awaiter(this, void 0, void 0, function* () {
            return react_native_1.AsyncStorage.setItem(this.getKey(), JSON.stringify(registry));
        });
    }
}
exports.StorageDriver = StorageDriver;
