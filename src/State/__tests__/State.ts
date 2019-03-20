// tslint:disable:no-string-literal
// tslint:disable:no-empty

import { State, Reactor, DEBOUNCE_DELAY } from '../'
import { URIEvent, URICacheRegistry } from '@src/interfaces'
import { defaultConfig } from '../../default-config'

describe('State class', () => {
  describe('updateURIModel method', () => {
    it('should exactly update changed fields', async () => {
      const state = new State(defaultConfig)
      const uri = 'XXXX'
      state.getLastURIEvent(uri)
      await state.updateURIModel(uri, { fileExists: true })
      const event = state.getLastURIEvent(uri)
      expect(event.nextModel.fileExists).toEqual(true)
      expect(event.nextModel.fetching).toEqual(false)
    })
    it('should handle null values', async () => {
      const uri = 'XXXX'
      const state = new State(defaultConfig)
      await state.updateURIModel(uri, null)
      expect(state['cacheStore'].registry[uri]).toBeNull()
    })
  })
  describe('addListener method', () => {
    it('should initialize URI model', async () => {
      const uri = 'XXXX'
      const state = new State(defaultConfig)
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
      const state = new State(defaultConfig)
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
      const state = new State(defaultConfig)
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
      const state = new State(defaultConfig)
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
      const state = new State(defaultConfig)
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
