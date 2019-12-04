import { FileSystemDriverInterface, joinUri } from 'react-native-async-image-store'
import * as FileSystem from 'expo-file-system'

export class FileSystemDriver implements FileSystemDriverInterface {
  private baseDir: string

  public constructor(storeName: string) {
    this.baseDir = joinUri(FileSystem.documentDirectory + 'Store', storeName)
  }

  async nodeExists(fileURI: string) {
    const info = await FileSystem.getInfoAsync(fileURI)
    return info.exists
  }

  async delete(fileURI: string) {
    return FileSystem.deleteAsync(fileURI)
  }

  async copy(sourceURI: string, destinationURI: string) {
    return FileSystem.copyAsync({ from: sourceURI, to: destinationURI })
  }

  async move(sourceURI: string, destinationURI: string) {
    return FileSystem.moveAsync({ from: sourceURI, to: destinationURI })
  }

  async makeDirectory(dirURI: string) {
    return FileSystem.makeDirectoryAsync(dirURI, { intermediates: true })
  }

  getBaseDirURI() {
    return this.baseDir
  }
}
