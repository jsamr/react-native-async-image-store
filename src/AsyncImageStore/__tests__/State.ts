// tslint:disable:no-string-literal
// tslint:disable:no-empty

import { State, getInitialURICacheModel } from '../State'
import { URIEvent } from '../types'

describe('State class', () => {
  describe('updateURIModel method', () => {
    it('should update internal model', () => {
      const uri = 'XXXX'
      const initialModel = getInitialURICacheModel(uri)
      const state = new State()
      state.updateURIModel(uri, initialModel)
      const model = state['cacheStore'].uriStates[uri]
      expect(model).not.toBeNull()
      expect(model).toEqual(initialModel)
    })
    it('should not override', () => {
      const state = new State()
      const uri = 'XXXX'
      state.getLastURIEvent(uri)
      state.updateURIModel(uri, { fileExists: true })
      const event = state.getLastURIEvent(uri)
      expect(event.nextModel.fileExists).toEqual(true)
      expect(event.nextModel.fetching).toEqual(false)
    })
  })
  describe('addListener method', () => {
    it('should initialize URI model', async () => {
      const uri = 'XXXX'
      const state = new State()
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
      const state = new State()
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
      const state = new State()
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
      const state = new State()
      state.registerCommandReactor('PRELOAD', spy as any)
      await state.dispatchCommand(uri, 'PRELOAD')
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })
})
