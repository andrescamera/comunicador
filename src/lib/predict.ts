import { categoryFor, FOLDER_CATALOG } from './catalog'
import { AFTER_NOUN, CONNECTORS, DESCRIBERS, frameFor, PERSONAS, TODO, VERBOS } from './semantics'
import type { Cell, DynamicConfig, Library } from './types'

/**
 * Modo predictivo: en cada momento se resalta solo lo que tiene sentido decir a continuación y el
 * resto se atenúa (sigue en su sitio y se puede tocar). Las fichas NUNCA cambian de sitio: la mano
 * aprende un único lugar para cada palabra (memoria motora).
 *  - Empezar: personas, preguntas, verbos y frases sociales.
 *  - Tras persona, pregunta o «no»: verbos (se ven conjugados).
 *  - Tras un verbo: lo que encaja con él (comer → comidas; ir → lugares…), sacado también de
 *    dentro de las carpetas. Si el verbo lleva otro («quiero»), también los verbos.
 *  - Tras un nombre: lo que lo describe (colores, tamaño…) y enlaces («y», «con», «más»).
 *  - Tras un enlace: «y» → otra cosa del mismo tipo; «con» → personas…
 * Siempre resaltadas: las palabras fijas (no, sí, más, ayuda). Si lo que encaja tras un verbo está
 * todo en una carpeta, se abre sola. Funciones puras (con tests).
 */

export const DEFAULT_DYNAMIC: DynamicConfig = {
  enabled: true,
  fixed: ['no', 'sí', 'más', 'ayuda'],
  // Verbos que llevan otro detrás: en los datos de CHILDES, ir (30 %), volver (28 %), querer (23 %), ayudar (13 %)…
  chainVerbs: ['querer', 'poder', 'necesitar', 'ir', 'volver', 'gustar', 'saber', 'tener que', 'dejar', 'empezar', 'ayudar'],
}


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
  folder?: string // carpeta del tablero principal en la que está (id del tablero de la carpeta)
}

/**
 * Todas las fichas del tablero y de sus carpetas (sin las carpetas en sí), cada una con sus
 * etiquetas: las del catálogo si la palabra está en él, más la de su carpeta («Comida» → Comidas).
 */
export function buildPool(lib: Library): PoolCell[] {
  const pool: PoolCell[] = []
  const seen = new Set<string>()
  const visit = (boardId: string, inherited: string[], depth: number, visited: Set<string>, folder?: string) => {
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
      pool.push({ cell: c, tags, root: depth === 0, folder })
    }
    for (const f of cells.filter((c) => c.kind === 'folder' && c.target)) {
      const sub = lib.boards[f.target!]
      const cat = sub ? categoryFor(sub.name || f.label, sub.cells.map((c) => c.label)) : null
      visit(f.target!, [...inherited, ...(cat ? [cat] : [])], depth + 1, visited, folder ?? f.target)
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

export interface Highlights {
  /** Fichas que se ven normal (el resto, atenuadas). Incluye las carpetas con algo que encaja. */
  lit: Set<string>
  /** Si todo lo que encaja está en una sola carpeta del principal: abrirla sola */
  autoOpen: string | null
}

/** Qué resaltar ahora (en el principal y en las carpetas) y si hay que abrir una carpeta sola */
export function predictiveHighlights(lib: Library, cfg: DynamicConfig, sentence: Token[]): Highlights {
  const pool = buildPool(lib)
  const predicted = predictCells(lib, cfg, sentence, pool)
  const ids = new Set(predicted.map((c) => c.id))
  const lit = new Set(ids)
  const fixed = new Set(cfg.fixed.map(fold))
  for (const p of pool) if (fixed.has(fold(p.cell.label))) lit.add(p.cell.id)

  // Carpetas del principal que contienen algo que encaja
  const folders = new Map<string, number>()
  let atRoot = 0
  for (const p of pool) {
    if (!ids.has(p.cell.id)) continue
    if (p.folder) folders.set(p.folder, (folders.get(p.folder) ?? 0) + 1)
    else if (p.cell.category !== 'verb') atRoot++
  }
  const root = lib.boards[lib.rootId]
  for (const c of root?.cells ?? []) if (c.kind === 'folder' && c.target && folders.has(c.target)) lit.add(c.id)
  const onlyFolder = sentence.length > 0 && atRoot === 0 && folders.size === 1 && !predicted.some((c) => c.category === 'verb')
  return { lit, autoOpen: onlyFolder ? [...folders.keys()][0] : null }
}

/** Clave de la frase en curso: cambia cada vez que se añade o quita una palabra */
export function predictionKey(sentence: Token[]): string {
  return sentence.map((t) => fold(t.label)).join('|')
}
