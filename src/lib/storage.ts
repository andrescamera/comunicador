import type { Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

const SETTINGS_KEY = 'comunicador:settings:v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // almacenamiento lleno o bloqueado: seguimos en memoria
  }
}

export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) })
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
