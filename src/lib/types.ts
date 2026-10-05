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
  textOnly?: boolean // solo la palabra, en grande, sin pictograma (artículos, preposiciones...)
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
  dynamic?: DynamicConfig // solo el tablero principal: modo dinámico (por momentos de la frase)
  quickChat?: string // solo el principal: id del tablero de «Charla rápida» (botón fijo junto a Borrar y Todo)
}

/** Modo dinámico: el tablero principal muestra en cada momento de la frase solo lo que encaja */
export interface DynamicConfig {
  enabled: boolean
  fixed: string[] // palabras de la columna fija (siempre visibles): no, sí, más, ayuda
  chainVerbs: string[] // verbos que pueden llevar otro detrás: «quiero» comer, «puedo» jugar
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
  returnHome: boolean // tras elegir una ficha dentro de una carpeta, volver al tablero principal
  rate: number
  voiceURI: string
  showTapLog: boolean
  conjugateLabels: boolean // los verbos se ven conjugados según la persona elegida en la frase
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
  returnHome: true,
  rate: 1,
  voiceURI: '',
  showTapLog: true,
  conjugateLabels: true,
  clearAfterSpeak: true,
  autoClear: false,
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
