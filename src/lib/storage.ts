import { layoutCells } from './layout'
import type { Board, Library, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

const LIB_KEY = 'comunicador:library:v3'
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

/** Tableros de versiones anteriores (sin posiciones fijas): se colocan una vez y ya no se mueven. */
function migrate(lib: Library): Library {
  const boards: Record<string, Board> = {}
  for (const [id, b] of Object.entries(lib.boards)) {
    const ok = b.rows && b.zones && b.cells.every((c) => Number.isInteger(c.row) && Number.isInteger(c.col))
    boards[id] = ok ? b : { id: b.id, name: b.name, ...layoutCells(b.cells) }
  }
  return { ...lib, boards }
}

export const loadLibrary = () => {
  const lib = read<Library>(LIB_KEY)
  return lib ? migrate(lib) : null
}
export const saveLibrary = (lib: Library) => write(LIB_KEY, lib)
export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(SETTINGS_KEY) ?? {}) })
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
