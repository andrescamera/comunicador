import { bestPicto } from './arasaac'
import { CATEGORY_ORDER, classify, lemmatize } from './grammar'
import type { Board, Cell, CellKind, Library } from './types'
import { uid } from './types'

export interface ParsedItem {
  label: string
  kind: CellKind
}
export interface ParsedBoard {
  name: string
  items: ParsedItem[]
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'con', 'y', 'o',
  'en', 'por', 'que', 'me', 'te', 'se', 'le', 'les', 'nos', 'os', 'lo', 'mi', 'mis', 'tu', 'tus',
  'su', 'sus', 'muy', 'es', 'este', 'esta', 'ese', 'esa', 'para',
])

/**
 * Formato:
 *   desayuno: yo, querer, más, leche, "quiero ir al baño"
 *   parque: quiero jugar en el columpio con mis amigos
 * - Cada línea es un tablero. La primera es el principal; las demás se enlazan como carpetas.
 * - Con comas: cada elemento es una celda. Entre comillas: frase completa en una celda.
 * - Sin comas: texto libre; se quitan palabras vacías y se pasan los verbos a infinitivo.
 */
export function parseText(text: string): ParsedBoard[] {
  const boards: ParsedBoard[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const m = line.match(/^([^:"]{1,40}):\s*(.*)$/)
    const name = m ? m[1].trim() : boards.length === 0 ? 'Inicio' : `Tablero ${boards.length + 1}`
    const body = m ? m[2] : line
    const items = body.includes(',') ? parseList(body) : parseFreeText(body)
    // Dos líneas con el mismo nombre se juntan en un tablero
    const existing = boards.find((b) => b.name.toLowerCase() === name.toLowerCase())
    if (existing) existing.items.push(...items)
    else boards.push({ name, items })
  }
  for (const b of boards) {
    const seen = new Set<string>()
    b.items = b.items.filter((it) => {
      const k = it.label.toLowerCase()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  return boards
}

function parseList(body: string): ParsedItem[] {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s): ParsedItem[] => {
      const quoted = s.match(/^["“'](.+)["”']$/)
      if (quoted) return [{ label: quoted[1].trim(), kind: 'phrase' }]
      // "otra vez", "por favor" son una celda; un trozo más largo es texto libre
      if (s.split(/\s+/).length >= 3) return parseFreeText(s)
      return [{ label: s.toLowerCase(), kind: 'word' }]
    })
}

function parseFreeText(body: string): ParsedItem[] {
  const items: ParsedItem[] = []
  // Las frases entre comillas se conservan enteras
  const rest = body.replace(/["“]([^"”]+)["”]/g, (_, phrase: string) => {
    items.push({ label: phrase.trim(), kind: 'phrase' })
    return ' '
  })
  for (const raw of rest.toLowerCase().split(/[\s.;¿?¡!]+/)) {
    const word = raw.trim()
    if (!word || STOPWORDS.has(word)) continue
    items.push({ label: lemmatize(word) ?? word, kind: 'word' })
  }
  return items
}

export function autoCols(n: number): number {
  if (n <= 3) return Math.max(n, 1)
  return Math.min(8, Math.max(3, Math.ceil(Math.sqrt(n * 1.6))))
}

export function sortCells(cells: Cell[]): Cell[] {
  const rank = (c: Cell) => (c.kind === 'folder' ? 99 : c.kind === 'phrase' ? 50 : CATEGORY_ORDER.indexOf(c.category))
  return cells
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c)
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export async function buildCell(item: ParsedItem): Promise<Cell> {
  let picto = await bestPicto(item.label)
  if (!picto && item.kind === 'phrase') {
    // Frase sin pictograma propio: probamos con la palabra más larga
    const longest = item.label.split(/\s+/).sort((a, b) => b.length - a.length)[0]
    picto = await bestPicto(longest)
  }
  return {
    id: uid('c'),
    kind: item.kind,
    label: item.label,
    // El tipo de ARASAAC solo vale si el pictograma es de esta misma palabra
    category: item.kind === 'phrase' ? 'social' : classify(item.label, picto?.keyword.toLowerCase() === item.label ? picto.type : undefined),
    picto: picto?.id,
  }
}

/** Celda-carpeta que enlaza a `board`. Sin pictograma propio, usa el de uno de sus nombres. */
export async function folderCell(board: Board): Promise<Cell> {
  const own = await bestPicto(board.name.toLowerCase())
  const fallback = board.cells.find((c) => c.picto && c.category === 'noun') ?? board.cells.find((c) => c.picto)
  return { id: uid('c'), kind: 'folder', label: board.name, category: 'misc', picto: own?.id ?? fallback?.picto, target: board.id }
}

/** Genera los tableros (con pictogramas y colores) a partir del texto. */
export async function generateLibrary(parsed: ParsedBoard[], onProgress?: (done: number, total: number) => void): Promise<Library> {
  const total = parsed.reduce((n, b) => n + b.items.length + 1, 0)
  let done = 0
  const tick = () => onProgress?.(++done, total)

  const boards: Board[] = await Promise.all(
    parsed.map(async (pb) => {
      const cells = await mapLimit(pb.items, 6, async (it) => {
        const c = await buildCell(it)
        tick()
        return c
      })
      const sorted = sortCells(cells)
      return { id: uid('b'), name: pb.name, cols: autoCols(sorted.length + (pb === parsed[0] ? parsed.length - 1 : 0)), cells: sorted }
    }),
  )

  const [root, ...subs] = boards
  for (const sub of subs) {
    root.cells.push(await folderCell(sub))
    tick()
  }
  tick()
  return { rootId: root.id, boards: Object.fromEntries(boards.map((b) => [b.id, b])) }
}

export const SAMPLE_TEXT = `Inicio: yo, tú, él, ella, nosotros, mamá, papá, querer, ir, tener, gustar, estar, poder, no, sí, más, ayuda, hola, adiós, gracias
Comida: comer, beber, agua, leche, zumo, galletas, pan, fruta, manzana, plátano, pizza, rico, caliente, frío, terminado
Sentimientos: estar, contento, triste, enfadado, cansado, asustado, doler, cabeza, tripa, bien, mal
Lugares: ir, casa, colegio, parque, baño, playa, médico, tienda, "quiero ir al baño"
Jugar: jugar, pelota, columpio, tobogán, puzle, dibujar, música, otra vez, mi turno`
