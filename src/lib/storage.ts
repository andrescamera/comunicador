import { restorePictoBounds } from './pictoBounds'
import type { Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

const SETTINGS_KEY = 'comunicador:settings:v2'
const OLD_SETTINGS_KEY = 'comunicador:settings:v1' // v2: el borrado automático pasa a estar desactivado por defecto

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

export const loadSettings = (): Settings => {
  const saved = read<Partial<Settings>>(SETTINGS_KEY)
  if (saved) return { ...DEFAULT_SETTINGS, ...saved }
  const old = read<Partial<Settings>>(OLD_SETTINGS_KEY)
  return { ...DEFAULT_SETTINGS, ...(old ?? {}), autoClear: false }
}
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)

const PICTO_BOUNDS_KEY = 'comunicador:picto-bounds:v1'

/** Las cajas de los pictos ya medidos: se guardan para no volver a descargarlos */
export function connectPictoBounds() {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PICTO_BOUNDS_KEY)
  } catch {
    // almacenamiento bloqueado: se miden en cada visita
  }
  restorePictoBounds(raw, (next) => {
    try {
      localStorage.setItem(PICTO_BOUNDS_KEY, next)
    } catch {
      // almacenamiento lleno o bloqueado: seguimos en memoria
    }
  })
}
