import { createStore } from "react-native-async-image-store"
import { ExpoDownloadManager } from "./ExpoDownloadManager"
import { FileSystemDriver } from "./FileSystemDriver"
import { AsyncStorageDriver } from "./AsyncStorageDriver"

export const imageStore = createStore('GoldenProject', {
    StorageDriver: AsyncStorageDriver,
    DownloadManager: ExpoDownloadManager,
    FileSystemDriver: FileSystemDriver,
    overrideMaxAge: Infinity,
    maxAttemptsBeforeAbort: 5,
    sleepBetweenAttempts: 800
  })