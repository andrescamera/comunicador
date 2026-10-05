import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_SETTINGS, type Settings } from './shared'

const SETTINGS_KEY = 'comunicador:settings:v2'
const OLD_SETTINGS_KEY = 'comunicador:settings:v1' // v2: el borrado automático pasa a estar desactivado por defecto

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

export const loadSettings = async (): Promise<Settings> => {
  const saved = await read<Partial<Settings>>(SETTINGS_KEY)
  if (saved) return { ...DEFAULT_SETTINGS, ...saved }
  const previous = await read<Partial<Settings>>(OLD_SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(previous ?? {}), autoClear: false }
}
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
