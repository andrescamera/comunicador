import { categoryFor, FOLDER_CATALOG } from './catalog'
import { computeZones, countZones } from './layout'
import { AFTER_NOUN, CONNECTORS, DESCRIBERS, frameFor, PERSONAS, TODO, VERBOS } from './semantics'
import type { Board, Cell, DynamicConfig, Library } from './types'

/**
 * Modo predictivo: el tablero principal muestra en cada momento solo lo que tiene sentido decir
 * a continuación, con fichas lo más grandes posible:
 *  - Empezar: personas, preguntas, verbos y frases sociales.
 *  - Tras persona, pregunta o «no»: verbos (se ven conjugados).
 *  - Tras un verbo: lo que encaja con él (comer → comidas; ir → lugares…), sacado también de
 *    dentro de las carpetas. Si el verbo lleva otro («quiero»), también los verbos.
 *  - Tras un nombre: lo que lo describe (colores, tamaño…) y enlaces («y», «con», «más»).
 *  - Tras un enlace: «y» → otra cosa del mismo tipo; «con» → personas…
 * Siempre: la columna fija (no, sí, más, ayuda) y «otras palabras» (el tablero completo).
 * Funciones puras (con tests).
 */

export const DEFAULT_DYNAMIC: DynamicConfig = {
  enabled: true,
  fixed: ['no', 'sí', 'más', 'ayuda'],
  chainVerbs: ['querer', 'poder', 'necesitar', 'ir', 'gustar', 'saber', 'tener que'],
}

export const PREV_PAGE = '__prev'
export const NEXT_PAGE = '__next'
export const OTHER_WORDS = '__other'

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

type Token = Pick<Cell, 'kind' | 'category' | 'label'>

// Palabra del catálogo → categorías a las que pertenece («naranja»: Frutas y Colores)
const CATALOG_TAGS = new Map<string, string[]>()
for (const [cat, words] of Object.entries(FOLDER_CATALOG))
  for (const w of words) CATALOG_TAGS.set(fold(w), [...(CATALOG_TAGS.get(fold(w)) ?? []), cat])

interface PoolCell {
  cell: Cell
  tags: Set<string>
  root: boolean // está en el tablero principal (no dentro de una carpeta)
}

/**
 * Todas las fichas del tablero y de sus carpetas (sin las carpetas en sí), cada una con sus
 * etiquetas: las del catálogo si la palabra está en él, más la de su carpeta («Comida» → Comidas).
 */
export function buildPool(lib: Library): PoolCell[] {
  const pool: PoolCell[] = []
  const seen = new Set<string>()
  const visit = (boardId: string, inherited: string[], depth: number, visited: Set<string>) => {
    const b = lib.boards[boardId]
    if (!b || visited.has(boardId) || depth > 3) return
    visited.add(boardId)
    const cells = b.cells.filter((c) => !c.hidden).sort((a, x) => a.col - x.col || a.row - x.row)
    for (const c of cells) {
      if (c.kind === 'folder') continue
      const key = `${c.kind}:${fold(c.label)}`
      if (seen.has(key)) continue
      seen.add(key)
      // Si la palabra está en el mapa manda su tipo real («agua» es bebida aunque esté en la carpeta Comida);
      // si no, hereda el de su carpeta («cruasán de chocolate» en Comida es comida)
      const known = CATALOG_TAGS.get(fold(c.label))
      const tags = new Set(known ?? inherited)
      if (c.category === 'person') tags.add(PERSONAS)
      if (c.category === 'verb') tags.add(VERBOS)
      pool.push({ cell: c, tags, root: depth === 0 })
    }
    for (const f of cells.filter((c) => c.kind === 'folder' && c.target)) {
      const sub = lib.boards[f.target!]
      const cat = sub ? categoryFor(sub.name || f.label, sub.cells.map((c) => c.label)) : null
      visit(f.target!, [...inherited, ...(cat ? [cat] : [])], depth + 1, visited)
    }
  }
  visit(lib.rootId, [], 0, new Set())
  return pool
}

const isWord = (t: Token) => t.kind === 'word' || t.kind === 'phrase'

/** Palabras que se ven en cada momento (sin la columna fija) */
export function predictCells(lib: Library, cfg: DynamicConfig, sentence: Token[], pool = buildPool(lib)): Cell[] {
  const fixed = new Set(cfg.fixed.map(fold))
  const usable = pool.filter((p) => !fixed.has(fold(p.cell.label)))
  const verbs = sentence.filter((t) => t.kind === 'word' && t.category === 'verb')
  const last = sentence[sentence.length - 1]

  const start = () =>
    usable
      .filter((p) => p.root && (['pronoun', 'person', 'question', 'verb', 'social'].includes(p.cell.category) || p.cell.kind === 'phrase'))
      .map((p) => p.cell)
  const allVerbs = () => usable.filter((p) => p.cell.category === 'verb').map((p) => p.cell)
  /** Lo que tiene alguna de estas etiquetas (TODO: cualquier cosa que no sea persona/verbo/pregunta) */
  const complements = (tags: string[]) => {
    const any = tags.includes(TODO)
    return usable
      .filter((p) => {
        const c = p.cell
        if (c.category === 'verb') return tags.includes(VERBOS)
        if (['pronoun', 'question', 'social', 'negation'].includes(c.category) || c.kind === 'phrase') return false
        if (any && ['noun', 'adjective', 'person'].includes(c.category)) return true
        return [...p.tags].some((t) => tags.includes(t))
      })
      .map((p) => p.cell)
  }

  if (!sentence.length) return start()
  if (!verbs.length) {
    // Tras persona, pregunta o «no»: verbos. Tras una palabra social suelta: como al empezar.
    return sentence.some((t) => ['pronoun', 'person', 'question', 'negation'].includes(t.category)) ? allVerbs() : start()
  }

  const verb = verbs[verbs.length - 1]
  let frame = frameFor(verb.label)
  // Pregunta («¿dónde está…?»): cualquier cosa
  if (sentence.some((t) => t.category === 'question')) frame = [...frame, TODO]
  const modal = new Set(cfg.chainVerbs.map(fold))
  const firstVerb = verbs[0]

  // Justo tras el verbo
  if (last === verb) {
    const canChain = verbs.length === 1 && modal.has(fold(firstVerb.label))
    const tags = canChain ? [...frame, VERBOS] : frame.filter((t) => t !== VERBOS)
    const out = complements(tags)
    return out.length ? out : complements([TODO])
  }

  const lastFold = fold(last.label)
  // Tras un enlace: «y» → más del mismo tipo; «con» → personas…
  const link = CONNECTORS[lastFold]
  if (link) {
    const tags = link === 'same' ? frame.filter((t) => t !== VERBOS) : link
    const out = complements(tags)
    return out.length ? out : complements([TODO])
  }

  // Tras un nombre o un descriptivo: lo que lo describe y palabras de enlace
  if (isWord(last)) {
    const lastTags = pool.find((p) => fold(p.cell.label) === lastFold)?.tags ?? new Set<string>()
    const describe = [...lastTags].flatMap((t) => DESCRIBERS[t] ?? [])
    const links = new Set(AFTER_NOUN.map(fold))
    const out = [
      ...usable.filter((p) => p.cell.category !== 'verb' && [...p.tags].some((t) => describe.includes(t)) && fold(p.cell.label) !== lastFold),
      ...usable.filter((p) => links.has(fold(p.cell.label))),
    ].map((p) => p.cell)
    const unique = [...new Map(out.map((c) => [c.id, c])).values()]
    return unique.length ? unique : complements(frame.filter((t) => t !== VERBOS))
  }
  return start()
}

/**
 * Cuadrícula para las fichas de un momento: la más pequeña (fichas más grandes) en la que caben,
 * sin pasar del tamaño del tablero; a la derecha, la columna fija y «otras palabras».
 * Si no caben todas, páginas con flechas. `aspect` = ancho / alto del espacio disponible.
 */
export function layoutPrediction(root: Board, cells: Cell[], fixed: Cell[], page = 0, aspect = 1.6): { board: Board; pages: number } {
  const other: Cell = { id: OTHER_WORDS, kind: 'word', label: 'otras palabras', category: 'misc', textOnly: true, row: 0, col: 0 }
  const side = [...fixed, other]
  const maxRows = Math.max(1, root.rows)
  const maxCols = Math.max(2, root.cols) - 1
  const capacity = maxRows * maxCols
  const pages = Math.max(1, Math.ceil(cells.length / capacity))
  const current = Math.min(Math.max(0, page), pages - 1)
  const shown = cells.slice(current * capacity, (current + 1) * capacity)
  const needRows = Math.min(maxRows, side.length + (pages > 1 ? 2 : 0))

  let best = { rows: maxRows, size: 0 }
  for (let r = Math.max(1, needRows); r <= maxRows; r++) {
    const c = Math.max(1, Math.ceil(shown.length / r))
    if (c > maxCols) continue
    const size = Math.min(aspect / (c + 1), 1 / r)
    if (size > best.size + 1e-9) best = { rows: r, size }
  }
  const rows = best.rows
  const cols = Math.max(1, Math.ceil(shown.length / rows))

  // Por columnas: cada tipo de palabra queda junto, como en el tablero estático
  const placed: Cell[] = shown.map((c, i) => ({ ...c, row: i % rows, col: Math.floor(i / rows) }))
  const sideCol = cols
  const nav: Cell[] = []
  if (pages > 1) {
    const mk = (id: string, label: string): Cell => ({ id, kind: 'word', label, category: 'misc', textOnly: true, row: 0, col: 0 })
    if (current > 0) nav.push(mk(PREV_PAGE, '◂'))
    if (current < pages - 1) nav.push(mk(NEXT_PAGE, 'más ▸'))
  }
  // «otras palabras» y las flechas, abajo; la columna fija, arriba
  const bottom = [other, ...nav].slice(0, rows)
  const top = fixed.slice(0, Math.max(0, rows - bottom.length))
  top.forEach((c, i) => placed.push({ ...c, row: i, col: sideCol }))
  bottom.forEach((c, i) => placed.push({ ...c, row: rows - bottom.length + i, col: sideCol }))
  const board: Board = { ...root, rows, cols: cols + 1, cells: placed, zones: computeZones(countZones(placed), rows, cols + 1) }
  return { board, pages }
}

/** Todo junto: lo que se ve ahora en el tablero principal en modo predictivo */
export function predictiveView(lib: Library, cfg: DynamicConfig, sentence: Token[], page = 0, aspect = 1.6): { board: Board; pages: number } {
  const root = lib.boards[lib.rootId]
  const pool = buildPool(lib)
  const fixed = cfg.fixed.map((w) => pool.find((p) => fold(p.cell.label) === fold(w))?.cell).filter((c): c is Cell => !!c)
  return layoutPrediction(root, predictCells(lib, cfg, sentence, pool), fixed, page, aspect)
}

/** Clave del momento actual: cambia de página a la primera cuando cambia */
export function predictionKey(sentence: Token[]): string {
  return sentence.map((t) => fold(t.label)).join('|')
}
