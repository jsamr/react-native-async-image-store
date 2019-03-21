"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const async_storage_1 = __importDefault(require("@react-native-community/async-storage"));
class AsyncStorageDriver {
    constructor(name) {
        this.name = name;
    }
    getKey() {
        return `AsyncImageStore-${this.name}`;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            const registryStr = yield async_storage_1.default.getItem(this.getKey());
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
            return async_storage_1.default.removeItem(this.getKey());
        });
    }
    save(registry) {
        return __awaiter(this, void 0, void 0, function* () {
            return async_storage_1.default.setItem(this.getKey(), JSON.stringify(registry));
        });
    }
}
exports.AsyncStorageDriver = AsyncStorageDriver;
