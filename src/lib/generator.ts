import { bestPicto } from './arasaac'
import { CATEGORY_ORDER, classify, isKnownWord, lemmatize } from './grammar'
import { layoutAt, layoutCells, type NewCell, ZONE_ORDER, zoneOf } from './layout'
import type { Board, Cell, CellKind, Library } from './types'
import { uid } from './types'

export interface ParsedItem {
  label: string
  kind: CellKind
  proper?: boolean // nombre propio (Mati, Lucía): persona, sin pictograma aproximado
  // Posición fija, solo en modo cuadrícula (cada línea es una fila)
  row?: number
  col?: number
}
export interface ParsedBoard {
  name: string
  items: ParsedItem[]
  gridRows?: number // modo cuadrícula: nº de filas (líneas) con posición fija
  gridCols?: number
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'con', 'y', 'o',
  'en', 'por', 'que', 'me', 'te', 'se', 'le', 'les', 'nos', 'os', 'lo', 'mi', 'mis', 'tu', 'tus',
  'su', 'sus', 'muy', 'es', 'este', 'esta', 'ese', 'esa', 'para',
])

/**
 * Formato:
 *   yo, querer, más, leche, "quiero ir al baño"
 *   Parque: quiero jugar en el columpio con mis amigos
 *   carpeta Animales: perro, gato, pájaro
 * - Las líneas que empiezan por "#" son comentarios.
 * - Por defecto TODO va al tablero principal. "Nombre:" es solo una etiqueta para organizar el texto
 *   (la primera da nombre al tablero principal).
 * - Solo "carpeta Nombre: ..." crea un tablero aparte, enlazado desde el principal.
 * - Con comas: cada elemento es una celda. Entre comillas: frase completa en una celda.
 * - Sin comas: texto libre; se quitan palabras vacías y se pasan los verbos a infinitivo.
 * - Con `grid: true` (mantener filas y columnas): cada línea es una fila y cada palabra entre
 *   comas, una columna, en ese orden; "_" es un hueco vacío y una línea "_" es una fila vacía.
 *   Así se transcribe la foto de otro tablero sin perder su distribución.
 * Devuelve el tablero principal en la posición 0 y después las carpetas.
 */
export function parseText(text: string, opts: { grid?: boolean } = {}): ParsedBoard[] {
  const main: ParsedBoard = { name: '', items: [] }
  const folders: ParsedBoard[] = []
  for (const rawLine of text.normalize('NFC').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue // "# ..." = comentario
    const folder = line.match(/^carpeta\s+([^:"]{1,40}):\s*(.*)$/i)
    const labeled = folder ? null : line.match(/^([^:",]{1,40}):\s*(.*)$/)
    const body = folder ? folder[2] : labeled ? labeled[2] : line

    let target = main
    if (folder) {
      const name = folder[1].trim()
      // Dos líneas con la misma carpeta se juntan
      target = folders.find((b) => b.name.toLowerCase() === name.toLowerCase()) ?? { name, items: [] }
      if (!folders.includes(target)) folders.push(target)
    } else if (labeled && !main.name) main.name = labeled[1].trim()

    if (opts.grid) {
      const row = target.gridRows ?? 0
      const cells = parseGridRow(body, row)
      target.items.push(...cells.items)
      target.gridRows = row + 1
      target.gridCols = Math.max(target.gridCols ?? 0, cells.width)
    } else {
      target.items.push(...(body.includes(',') ? parseList(body) : parseFreeText(body)))
    }
  }
  main.name ||= 'Inicio'
  const boards = [main, ...folders]
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

/** Una fila de la cuadrícula: cada trozo entre comas es una celda en su columna; "_" o vacío = hueco. */
function parseGridRow(body: string, row: number): { items: ParsedItem[]; width: number } {
  const parts = body.split(',').map((p) => p.trim())
  const items: ParsedItem[] = []
  parts.forEach((p, col) => {
    if (!p || /^_+$/.test(p)) return
    const quoted = p.match(/^["“'](.+)["”']$/)
    const text = (quoted ? quoted[1] : p).trim()
    // En una cuadrícula cada trozo es UNA celda: 3 palabras o más es una frase hecha
    const kind = quoted || text.split(/\s+/).length >= 3 ? 'phrase' : 'word'
    if (kind === 'word' && isProperName(text)) items.push({ label: text, kind, proper: true, row, col })
    else items.push({ label: kind === 'phrase' ? text : text.toLowerCase(), kind, row, col })
  })
  return { items, width: parts.length }
}

function parseList(body: string): ParsedItem[] {
  return body
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^_+$/.test(s)) // "_" = hueco: solo tiene sentido en modo cuadrícula
    .flatMap((s): ParsedItem[] => {
      const quoted = s.match(/^["“'](.+)["”']$/)
      if (quoted) return [{ label: quoted[1].trim(), kind: 'phrase' }]
      // "otra vez", "por favor" son una celda; un trozo más largo es texto libre
      if (s.split(/\s+/).length >= 3) return parseFreeText(s)
      if (isProperName(s)) return [{ label: s, kind: 'word', proper: true }]
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
  for (const raw of rest.split(/[\s.;¿?¡!]+/)) {
    const original = raw.trim()
    const word = original.toLowerCase()
    if (!word || STOPWORDS.has(word) || /^_+$/.test(word)) continue
    if (isProperName(original)) items.push({ label: original, kind: 'word', proper: true })
    else items.push({ label: lemmatize(word) ?? word, kind: 'word' })
  }
  return items
}

/** "Mati", "Lucía": empieza por mayúscula y no es una palabra que conozcamos. */
function isProperName(word: string): boolean {
  return /^\p{Lu}\p{Ll}+$/u.test(word) && !isKnownWord(word) && !STOPWORDS.has(word.toLowerCase())
}

/** Orden inicial: por zona de columnas y, dentro de ella, por categoría y orden de escritura. */
export function sortCells<T extends Pick<Cell, 'kind' | 'category'>>(cells: T[]): T[] {
  const rank = (c: T) =>
    ZONE_ORDER.indexOf(zoneOf(c)) * 100 + (c.kind === 'folder' ? 90 : c.kind === 'phrase' ? 50 : CATEGORY_ORDER.indexOf(c.category))
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

export async function buildCell(item: ParsedItem): Promise<NewCell> {
  if (item.proper) {
    // Nombre propio: solo un pictograma si existe con ese nombre exacto (si no, mejor una foto)
    const exact = await bestPicto(item.label, { exactOnly: true })
    return { id: uid('c'), kind: 'word', label: item.label, category: 'person', picto: exact?.id }
  }
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
export async function folderCell(board: Pick<Board, 'id' | 'name'> & { cells: NewCell[] }): Promise<NewCell> {
  const own = await bestPicto(board.name.toLowerCase())
  const fallback = board.cells.find((c) => c.picto && c.category === 'noun') ?? board.cells.find((c) => c.picto)
  return { id: uid('c'), kind: 'folder', label: board.name, category: 'misc', picto: own?.id ?? fallback?.picto, target: board.id }
}

export type GridSize = { rows: number; cols: number } | 'auto'

/** Genera los tableros (pictogramas, colores y posiciones) a partir del texto. */
export async function generateLibrary(
  parsed: ParsedBoard[],
  onProgress?: (done: number, total: number) => void,
  size: GridSize = 'auto',
): Promise<Library> {
  const total = parsed.reduce((n, b) => n + b.items.length + 1, 0)
  let done = 0
  const tick = () => onProgress?.(++done, total)

  const drafts = await Promise.all(
    parsed.map(async (pb) => ({
      id: uid('b'),
      name: pb.name,
      cells: await mapLimit(pb.items, 6, async (it) => {
        const c = await buildCell(it)
        tick()
        return c
      }),
    })),
  )

  const [root, ...subs] = drafts
  for (const sub of subs) {
    root.cells.push(await folderCell(sub))
    tick()
  }
  tick()

  const boards: Board[] = drafts.map((d, i) => {
    const pb = parsed[i]
    if (pb.gridRows) {
      // Cuadrícula escrita con "|": cada celda en su fila y columna exactas
      const positions = pb.items
        .map((it, k) => ({ it, cell: d.cells[k] }))
        .filter(({ it }) => it.row !== undefined && it.col !== undefined)
        .map(({ it, cell }) => ({ label: cell.label, row: it.row!, col: it.col! }))
      return { id: d.id, name: d.name, ...layoutAt(d.cells, { rows: pb.gridRows, cols: pb.gridCols ?? 1, cells: positions }) }
    }
    return { id: d.id, name: d.name, ...layoutCells(sortCells(d.cells), i === 0 && size !== 'auto' ? size : undefined) }
  })
  return { rootId: root.id, boards: Object.fromEntries(boards.map((b) => [b.id, b])) }
}

// Vocabulario núcleo: las palabras más frecuentes, que sirven en cualquier situación.
// Las líneas con "#" son comentarios; todo va al tablero principal.
export const SAMPLE_TEXT = `# Personas y preguntas
yo, tú, él, ella, nosotros, ellos, mamá, papá, qué, quién, dónde, cuándo, por qué, cómo
# Verbos
querer, ir, tener, ser, estar, gustar, poder, hacer, ver, mirar, dar, poner, jugar, comer, beber, abrir, parar, ayudar, venir, necesitar
# Descriptivos y palabras pequeñas
no, más, eso, esto, aquí, otra vez, todo, ya, también, bien, mal, grande, pequeño, bonito, caliente, frío
# Cosas y lugares
agua, comida, baño, casa, colegio, parque, música, tele
# Social
hola, adiós, sí, gracias, por favor, vale`

