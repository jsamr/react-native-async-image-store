// tslint:disable:no-string-literal
// tslint:disable:no-empty

import { State, Reactor, DEBOUNCE_DELAY } from '../'
import { URIEvent, URICacheRegistry, AsyncImageStoreConfig, FileSystemDriverInterface, DownloadManagerInterface, DownloadReport } from '@src/interfaces'
import { defaultConfig } from '@src/default-config'

class StupidFileSystemDriver implements FileSystemDriverInterface {
  nodeExists(nodeURI: string) {
    return Promise.resolve(false)
  }
  async delete(nodeURI: string) {
    console.info(`MOCKING DELETION OF ${nodeURI}.`)
  }
  async copy(sourceURI: string, destinationURI: string) {
    console.info(`MOCKING COPY OF ${sourceURI} TO ${destinationURI}.`)
  }
  async move(sourceURI: string, destinationURI: string) {
    console.info(`MOCKING MOVE OF ${sourceURI} TO ${destinationURI}.`)
  }
  async makeDirectory(nodeURI: string) {
    console.info(`MOCKING MKDIR OF ${nodeURI}.`)
  }
  getBaseDirURI() {
    return ''
  }
}

// tslint:disable-next-line: max-classes-per-file
class StupidDownloadManager implements DownloadManagerInterface {
  async downloadImage(remoteURI: string, localURI: string, headers: Record<string, string>): Promise<DownloadReport> {
    const report: DownloadReport = {
      isOK: true,
      headers: new Headers(),
      status: 200
    }
    return report
  }

}

const enhancedConfig: AsyncImageStoreConfig = {
  ...defaultConfig,
  FileSystemDriver: StupidFileSystemDriver,
  DownloadManager: StupidDownloadManager
}

function makeState() {
  return new State(enhancedConfig, 'ImageStore')
}

describe('State class', () => {
  describe('updateURIModel method', () => {
    it('should exactly update changed fields', async () => {
      const state = makeState()
      const uri = 'XXXX'
      state.getLastURIEvent(uri)
      await state.updateURIModel(uri, { fileExists: true })
      const event = state.getLastURIEvent(uri)
      expect(event.nextModel.fileExists).toEqual(true)
      expect(event.nextModel.fetching).toEqual(false)
    })
    it('should handle null values', async () => {
      const uri = 'XXXX'
      const state = makeState()
      await state.updateURIModel(uri, null)
      expect(state['cacheStore'].registry[uri]).toBeUndefined()
      expect(state['lastEvents'].get(uri)).toBeUndefined()
    })
  })
  describe('getLocalPathFromURI', () => {
    it('should return path from URI', async () => {
      const uri = 'XXXX'
      const localURI = 'file:///a/b/c/eeee.jpg'
      const state = makeState()
      await state.updateURIModel(uri, { localURI })
      expect(state.getLocalURIForRemoteURI(uri)).toEqual(localURI)
    })
  })
  describe('addListener method', () => {
    it('should initialize URI model', async () => {
      const uri = 'XXXX'
      const state = makeState()
      async function listener() {}
      state.addListener(uri, listener)
      const event = state.getLastURIEvent(uri)
      expect(event).not.toBeNull()
      expect(event.type).toEqual('URI_INIT')
    })
    it('should be called on URI update', async () => {
      const uri = 'XXXX'
      const spiedObject = {
        listener() {}
      }
      const spy = jest.spyOn(spiedObject, 'listener')
      const state = makeState()
      state.addListener(uri, spy as any)
      await state.updateURIModel(uri, { fileExists: true })
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('removeListener method', () => {
    it('should work', async () => {
      const uri = 'XXXX'
      const spiedObject = {
        listener() {}
      }
      const spy = jest.spyOn(spiedObject, 'listener')
      const state = makeState()
      state.addListener(uri, spy as any)
      state.removeListener(uri, spy as any)
      await state.updateURIModel(uri, { fileExists: true })
      expect(spy).toHaveBeenCalledTimes(0)
    })
  })
  describe('registerCommandReactor method', () => {
    it('should allow a reactor to be called when a Command is dispatched', async () => {
      const uri = 'XXXX'
      const spiedObject = {
        listener(event: URIEvent) {
          expect(event).toBeTruthy()
        }
      }
      const spy = jest.spyOn(spiedObject, 'listener')
      const state = makeState()
      state.registerCommandReactor('PRELOAD', spy as any)
      await state.dispatchCommand(uri, 'PRELOAD')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
  describe('registerRegistryUpdateListener method', () => {
    it('should register a callback which gets called each time the registry updates with a new registry', async () => {
      const uri = 'XXXX'
      const spiedObject = {
        async listener(registry: URICacheRegistry) {
          expect(registry[uri]).toBeDefined()
        }
      }
      const preloadCommandReactor: Reactor = async (event: URIEvent, propose) => {
        propose({ fileExists: true })
      }
      const spy = jest.spyOn(spiedObject, 'listener')
      const state = makeState()
      state.addRegistryUpdateListener(spy as any)
      expect(state['registryListeners'].size).toBe(1)
      async function listener() {}
      state.addListener(uri, listener)
      state.registerCommandReactor('PRELOAD', preloadCommandReactor)
      await state.dispatchCommand(uri, 'PRELOAD')
      await new Promise(res => setTimeout(res, DEBOUNCE_DELAY))
      expect(state['registryListeners'].size).toBe(1)
      expect(spy).toHaveBeenCalled()
    })
  })
})
