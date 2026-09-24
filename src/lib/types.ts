export type Category =
  | 'pronoun' // pronombres personales (sujeto)
  | 'person' // personas: mamá, papá, profe...
  | 'verb'
  | 'noun'
  | 'adjective'
  | 'social'
  | 'question'
  | 'negation'
  | 'misc'

export type CellKind = 'word' | 'phrase' | 'folder'

export interface Cell {
  id: string
  kind: CellKind
  label: string
  category: Category
  picto?: number // id de pictograma ARASAAC
  target?: string // id del tablero destino (solo carpetas)
}

export interface Board {
  id: string
  name: string
  cols: number
  cells: Cell[]
}

export interface Library {
  rootId: string
  boards: Record<string, Board>
}

export interface Settings {
  activateOn: 'release' | 'press'
  lockoutMs: number // tiempo tras una activación en el que se ignoran nuevos toques
  minHoldMs: number // duración mínima de la pulsación
  moveTolerancePx: number // si el puntero se mueve más que esto, se cancela
  speakOnTap: boolean
  rate: number
  voiceURI: string
  showTapLog: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  activateOn: 'release',
  lockoutMs: 600,
  minHoldMs: 0,
  moveTolerancePx: 14,
  speakOnTap: true,
  rate: 1,
  voiceURI: '',
  showTapLog: true,
}

export const CATEGORY_LABELS: Record<Category, string> = {
  pronoun: 'Pronombre',
  person: 'Persona',
  verb: 'Verbo',
  noun: 'Nombre',
  adjective: 'Descriptivo',
  social: 'Social',
  question: 'Pregunta',
  negation: 'Negación',
  misc: 'Otros',
}

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
