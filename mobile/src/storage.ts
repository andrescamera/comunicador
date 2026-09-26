import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_SETTINGS, type Library, type Settings } from './shared'

const LIB_KEY = 'comunicador:library:v3'
const SETTINGS_KEY = 'comunicador:settings:v1'

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {})
}

export const loadLibrary = () => read<Library>(LIB_KEY)
export const saveLibrary = (lib: Library) => write(LIB_KEY, lib)
export const loadSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...((await read<Partial<Settings>>(SETTINGS_KEY)) ?? {}) })
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
