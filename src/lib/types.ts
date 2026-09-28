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
  // Posición fija: una celda nunca cambia de sitio sola (planificación motora)
  row: number
  col: number
  hidden?: boolean // oculta pero conservando su hueco
  singular?: string // solo en la frase: la palabra antes de pasarla a plural
}

/**
 * Zonas de columnas (clave de Fitzgerald, de izquierda a derecha, en orden sintáctico):
 * A personas y preguntas · B verbos · C descriptivos y palabras pequeñas · D nombres · E social, frases y carpetas
 */
export type Zone = 'A' | 'B' | 'C' | 'D' | 'E'
export type Zones = Record<Zone, [number, number]> // [primera, última] columna, ambas incluidas

export interface Board {
  id: string
  name: string
  rows: number
  cols: number
  zones: Zones
  zoneLabels?: Partial<Record<Zone, string>> // nombres personalizados de los grupos de columnas
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
  pluralWaitMs: number // espera antes de decir un nombre/descriptivo, por si se pulsa Plural
  rate: number
  voiceURI: string
  showTapLog: boolean
  clearAfterSpeak: boolean // al decir la frase entera (tocando la barra), borrarla en cuanto termina
  autoClear: boolean // borrar la frase tras autoClearSeconds sin tocar nada
  autoClearSeconds: number
}

export const DEFAULT_SETTINGS: Settings = {
  activateOn: 'release',
  lockoutMs: 600,
  minHoldMs: 0,
  moveTolerancePx: 14,
  speakOnTap: true,
  pluralWaitMs: 800,
  rate: 1,
  voiceURI: '',
  showTapLog: true,
  clearAfterSpeak: true,
  autoClear: true,
  autoClearSeconds: 3,
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
