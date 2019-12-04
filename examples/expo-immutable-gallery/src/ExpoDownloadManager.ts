
import { DownloadManagerInterface, DownloadReport } from 'react-native-async-image-store'
import * as FileSystem from 'expo-file-system'

export class ExpoDownloadManager implements DownloadManagerInterface {
  async downloadImage(remoteURI: string, localURI: string, headers: Record<string, string>): Promise<DownloadReport> {
    let respStatus = 0
    let responseHeader = new Headers()
    let isOK = false
    try {
      const resp = await FileSystem.downloadAsync(remoteURI, localURI, {
        headers,
      })
      isOK = resp.status < 400
      respStatus = resp.status
      responseHeader = new Headers(resp.headers)
    } catch (e) {
      console.error(e)
    }
    return {
        isOK,
        headers: responseHeader,
        status: respStatus,
      }
  }
}
