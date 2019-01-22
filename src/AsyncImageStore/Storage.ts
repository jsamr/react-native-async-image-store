import { AsyncStorage } from 'react-native'
import { StorageInstance, URICacheRegistry } from './types'

export class Storage implements StorageInstance {
  constructor(private name: string) {}

  public getKey(): string {
    return `AsyncImageStore-${this.name}`
  }

  public async load(): Promise<URICacheRegistry|null> {
    const registryStr: string|null = await AsyncStorage.getItem(this.getKey())
    if (!registryStr) {
      return null
    }
    try {
      const registry = JSON.parse(registryStr) as URICacheRegistry
      return registry
    } catch (e) {
      await this.clear()
    }
    return null
  }

  public async clear(): Promise<void> {
    return AsyncStorage.removeItem(this.getKey())
  }

  public async save(registry: URICacheRegistry): Promise<void> {
    return AsyncStorage.setItem(this.getKey(), JSON.stringify(registry))
  }
}