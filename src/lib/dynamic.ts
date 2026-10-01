import { computeZones, countZones } from './layout'
import type { Board, Cell, DynamicConfig } from './types'

/**
 * Tablero dinámico: el principal muestra en cada momento de la frase solo lo que encaja con
 * cómo la seguimos en español (persona → acción → lo demás), con fichas más grandes cuando caben.
 *  1 · Empezar: personas, preguntas, verbos y frases sociales
 *  2 · Tras persona, pregunta o «no»: verbos (se ven conjugados)
 *  3 · Tras el verbo: nombres, carpetas, descriptivos, palabras pequeñas y personas; si el verbo lleva
 *      otro detrás («quiero», «puedo», «voy a»), también todos los verbos («quiero comer»)
 * Una columna fija a la derecha (no, sí, más, ayuda) no cambia nunca. Funciones puras (con tests).
 */

export type Stage = 1 | 2 | 3

export const DEFAULT_DYNAMIC: DynamicConfig = {
  enabled: true,
  fixed: ['no', 'sí', 'más', 'ayuda'],
  chainVerbs: ['querer', 'poder', 'necesitar', 'ir', 'gustar', 'saber', 'tener que'],
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

type Token = Pick<Cell, 'kind' | 'category' | 'label'>

/**
 * ¿Lo último elegido es un verbo que puede llevar otro detrás («quiero» + comer)? Solo el primero:
 * tras «quiero comer» ya no se ofrecen más verbos.
 */
export function wantsVerb(sentence: Token[], cfg: DynamicConfig): boolean {
  const verbs = sentence.filter((t) => t.kind === 'word' && t.category === 'verb')
  const modal = new Set(cfg.chainVerbs.map(fold))
  return verbs.length === 1 && modal.has(fold(verbs[0].label)) && sentence[sentence.length - 1] === verbs[0]
}

/** Momento de la frase según lo que ya se ha elegido */
export function sentenceStage(sentence: Token[]): Stage {
  const words = sentence.filter((t) => t.kind === 'word')
  if (words.some((t) => t.category === 'verb')) return 3
  if (words.some((t) => ['pronoun', 'person', 'question', 'negation'].includes(t.category))) return 2
  return 1
}

function inStage(c: Cell, stage: Stage, withVerbs: boolean): boolean {
  if (c.kind === 'folder') return stage === 3
  if (c.kind === 'phrase') return stage === 1
  switch (c.category) {
    case 'pronoun':
    case 'question':
      return stage === 1
    case 'person':
      return stage === 1 || stage === 3 // «mamá quiere…» y «quiero ir con mamá»
    case 'verb':
      return stage === 1 || stage === 2 || (stage === 3 && withVerbs)
    case 'negation':
      return stage === 1 || stage === 2
    case 'social':
      return stage === 1
    default:
      return stage === 3 // nombres, descriptivos, palabras pequeñas
  }
}

/** Fichas de un momento, en el orden del tablero (por columnas, como en la vista estática) */
export function stageCells(root: Board, cfg: DynamicConfig, stage: Stage, withVerbs = false): { cells: Cell[]; fixed: Cell[] } {
  const fixedSet = new Set(cfg.fixed.map(fold))
  const visible = root.cells.filter((c) => !c.hidden).sort((a, b) => a.col - b.col || a.row - b.row)
  // La columna fija sigue el orden de la configuración
  const fixed = cfg.fixed.map((w) => visible.find((c) => fold(c.label) === fold(w))).filter((c): c is Cell => !!c)
  const cells = visible.filter((c) => !fixedSet.has(fold(c.label)) && inStage(c, stage, withVerbs))
  return { cells, fixed }
}

export const PREV_PAGE = '__prev'
export const NEXT_PAGE = '__next'

/**
 * Cuadrícula de un momento: la más pequeña (fichas más grandes) en la que caben sus fichas,
 * sin pasar del tamaño del tablero. `aspect` = ancho / alto del espacio disponible.
 * Si no caben todas, páginas con flechas en la columna fija.
 */
export function dynamicView(
  root: Board,
  cfg: DynamicConfig,
  stage: Stage,
  page = 0,
  aspect = 1.6,
  withVerbs = false,
): { board: Board; pages: number } {
  let { cells, fixed } = stageCells(root, cfg, stage, withVerbs)
  if (!cells.length && stage !== 1) cells = stageCells(root, cfg, 1).cells // nada que mostrar: como al empezar
  const maxRows = Math.max(1, root.rows)
  const maxCols = Math.max(2, root.cols) - 1 // la última columna es la fija
  const capacity = maxRows * maxCols
  const pages = Math.max(1, Math.ceil(cells.length / capacity))
  const current = Math.min(Math.max(0, page), pages - 1)
  const shown = cells.slice(current * capacity, (current + 1) * capacity)
  const needRows = fixed.length + (pages > 1 ? 2 : 0)

  // Tamaño que hace las fichas más grandes (ancho y alto relativos al espacio)
  let best = { rows: maxRows, cols: maxCols, size: 0 }
  for (let r = Math.max(1, Math.min(maxRows, needRows)); r <= maxRows; r++) {
    const c = Math.ceil(shown.length / r)
    if (c < 1 || c > maxCols) continue
    const size = Math.min(aspect / (c + 1), 1 / r)
    if (size > best.size + 1e-9) best = { rows: r, cols: c, size }
  }
  const rows = Math.max(best.rows, Math.min(needRows, maxRows))
  const cols = Math.max(1, Math.ceil(shown.length / rows))

  // Por columnas: cada categoría queda junta, como en el tablero estático
  const placed: Cell[] = shown.map((c, i) => ({ ...c, row: i % rows, col: Math.floor(i / rows) }))
  const fixedCol = cols
  fixed.slice(0, rows).forEach((c, i) => placed.push({ ...c, row: i, col: fixedCol }))
  if (pages > 1) {
    const nav = (id: string, label: string, row: number): Cell => ({ id, kind: 'word', label, category: 'misc', textOnly: true, row, col: fixedCol })
    if (current > 0) placed.push(nav(PREV_PAGE, '◂', rows - 2))
    if (current < pages - 1) placed.push(nav(NEXT_PAGE, 'más ▸', rows - 1))
  }
  const board: Board = { ...root, rows, cols: cols + 1, cells: placed, zones: computeZones(countZones(placed), rows, cols + 1) }
  return { board, pages }
}
