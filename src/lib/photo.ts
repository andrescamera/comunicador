import { isKnownWord, isLexiconWord, lemmatize, normalizeText } from './grammar'

/** Línea de texto reconocida en la foto, en píxeles de la imagen. */
export interface TextBox {
  text: string
  x: number
  y: number
  width: number
  height: number
}

/** Línea reconocida; `elements` son sus palabras con su propia posición (si el motor las da). */
export interface TextLine extends TextBox {
  elements?: TextBox[]
}

export interface PhotoCell {
  label: string
  row: number
  col: number
}

export interface PhotoGrid {
  rows: number
  cols: number
  cells: PhotoCell[]
}

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface Box {
  text: string
  cx: number
  cy: number
  w: number
  h: number
}

/** Limpia lo que no parece la etiqueta de una celda (títulos largos, números, símbolos sueltos). */
function isLabel(text: string): boolean {
  const t = text.trim()
  if (t.length < 1 || t.length > 28) return false
  if (!/\p{L}/u.test(t)) return false // sin letras: números, flechas, ruido
  return t.split(/\s+/).length <= 4
}

/**
 * Una etiqueta partida en dos líneas ("por" / "favor") se une si las líneas están
 * centradas una sobre otra y muy juntas.
 */
function mergeStacked(boxes: Box[]): Box[] {
  const sorted = [...boxes].sort((a, b) => a.cy - b.cy)
  const out: Box[] = []
  for (const b of sorted) {
    const above = out.find(
      (o) => Math.abs(o.cx - b.cx) < Math.max(o.w, b.w) * 0.35 && b.cy - o.cy > 0 && b.cy - o.cy < Math.max(o.h, b.h) * 1.35,
    )
    if (above) {
      above.text = `${above.text} ${b.text}`
      const top = above.cy - above.h / 2
      const bottom = b.cy + b.h / 2
      above.cy = (top + bottom) / 2
      above.h = bottom - top
      above.w = Math.max(above.w, b.w)
    } else out.push({ ...b })
  }
  return out
}


/** Agrupa valores cercanos; devuelve cada grupo con su centro y nº de miembros. */
function clusters(values: number[], tol: number): { center: number; count: number }[] {
  return clusterGroups(values, tol).map((g) => ({ center: g.reduce((a, b) => a + b, 0) / g.length, count: g.length }))
}

function clusterGroups(values: number[], tol: number): number[][] {
  const s = [...values].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const v of s) {
    const g = groups[groups.length - 1]
    if (g && v - g[g.length - 1] < tol) g.push(v)
    else groups.push([v])
  }
  return groups
}

/**
 * Líneas de la cuadrícula (filas o columnas) a partir de los centros de las etiquetas.
 * - Una fila/columna real tiene varias etiquetas alineadas ("fuerte"); un texto suelto que no
 *   cae sobre la cuadrícula (p. ej. "STOP" dentro de un dibujo) es ruido y se descarta.
 * - El paso es la mediana de las distancias entre líneas fuertes; una distancia que es
 *   múltiplo del paso significa que hay filas/columnas vacías en medio.
 * Devuelve el origen, el paso y una función que da el índice (o null si es ruido).
 */
function gridAxis(values: number[], tol: number, fallbackPitch: number) {
  const cs = clusters(values, tol)
  const strongMin = cs.length > 2 ? 2 : 1
  const strong = cs.filter((c) => c.count >= strongMin)
  // Con menos de dos líneas fuertes no hay con qué medir: se usan todas
  const base = strong.length >= 2 ? strong : cs
  const diffs = base.slice(1).map((c, i) => c.center - base[i].center)
  const axis = { step: bestStep(diffs, tol) ?? fallbackPitch, evidence: diffs.length, origin: base[0].center }
  const indexOf = (v: number): number | null => {
    const k = (v - axis.origin) / axis.step
    const idx = Math.round(k)
    // Fuera de la cuadrícula (más de un 30 % del paso lejos de una línea): ruido
    return Math.abs(k - idx) > 0.3 ? null : idx
  }
  return Object.assign(axis, { indexOf })
}

/**
 * Mayor paso del que todas las distancias sean (casi) múltiplos exactos: con huecos vacíos
 * en medio, 200 y 600 dan un paso de 200, no la media.
 */
function bestStep(diffs: number[], minStep: number): number | null {
  if (!diffs.length) return null
  const candidates = diffs.flatMap((d) => [1, 2, 3, 4, 5].map((k) => d / k)).filter((c) => c > minStep)
  candidates.sort((a, b) => b - a)
  for (const c of candidates) {
    if (diffs.every((d) => Math.abs(d / c - Math.round(d / c)) < 0.2)) {
      // Afinar con la media de las distancias divididas entre su nº de pasos
      return median(diffs.map((d) => d / Math.round(d / c)))
    }
  }
  return median(diffs)
}

/**
 * Con muy poca información (una sola distancia) no se sabe si hay filas vacías en medio:
 * las celdas son casi cuadradas, así que un paso casi doble que el otro eje se divide.
 */
function crossCheck(a: { step: number; evidence: number }, b: { step: number }) {
  if (a.evidence > 1) return
  const ratio = a.step / b.step
  if (ratio >= 1.8) a.step /= Math.round(ratio)
}

// Botones de control de otros comunicadores (Verbo, etc.) que aparecen en la fila superior
const CONTROL_WORDS = new Set([
  'leer', 'limpiar', 'borrar', 'género', 'número', 'hablar', 'decir frase', 'borrar todo', 'todo', 'atrás', 'teclado',
])

/**
 * Corrige confusiones típicas del reconocimiento de texto en palabras cortas del léxico:
 * "vo" -> "yo", "nc" -> "no", "cquién" -> "quién" (el "¿" leído como letra), "donde" -> "dónde".
 * Solo se acepta la corrección si da una palabra conocida.
 */
export function fixOcrWord(word: string): string {
  if (isKnownWord(word)) return word
  const candidates: string[] = []
  const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
  // "¿" o "¡" leídos como letra al principio
  if (/^[cilz¿¡]/.test(word)) candidates.push(word.slice(1))
  // Tildes que faltan
  const accented = LEXICON_ACCENTED.find((w) => strip(w) === word)
  if (accented) candidates.push(accented)
  // Letras que se confunden
  const swaps: [string, string][] = [['v', 'y'], ['c', 'o'], ['c', 'e'], ['0', 'o'], ['1', 'l'], ['rn', 'm'], ['i', 'l'], ['l', 'i']]
  for (const [from, to] of swaps) {
    let i = word.indexOf(from)
    while (i >= 0) {
      candidates.push(word.slice(0, i) + to + word.slice(i + from.length))
      i = word.indexOf(from, i + 1)
    }
  }
  return candidates.find((c) => c.length > 0 && isKnownWord(c)) ?? word
}

const LEXICON_ACCENTED = ['qué', 'quién', 'dónde', 'cuándo', 'cómo', 'cuál', 'cuánto', 'tú', 'él', 'sí', 'más', 'adiós', 'mamá', 'papá', 'aquí', 'allí', 'también']

/**
 * Etiqueta final: verbos conjugados en infinitivo ("Quiero" -> "querer") y minúsculas.
 * Con `keepCapitals`, una palabra con mayúscula que no es un verbo conocido se conserva
 * tal cual (nombre propio: "Mati").
 */
export function cleanLabel(text: string, keepCapitals: boolean): string {
  const t = normalizeText(text).replace(/[.,;:!¡?¿"“”]+$/g, '').replace(/^["“¿¡]+/, '')
  const lower = t.toLowerCase()
  if (lower.includes(' ')) return lower
  const fixed = fixOcrWord(lower)
  // "ayuda" es una palabra en sí misma (no "ayudar"): solo se pasa a infinitivo si no lo es
  const lemma = isLexiconWord(fixed) ? null : lemmatize(fixed)
  if (lemma) return lemma
  if (fixed !== lower) return fixed
  return keepCapitals && /^\p{Lu}\p{Ll}+$/u.test(t) ? t : lower
}

/**
 * El reconocedor a veces junta en una línea las etiquetas de celdas vecinas ("yo      tú").
 * Se parte la línea donde la separación entre palabras es mucho mayor que un espacio.
 */
export function splitLine(line: TextLine): TextBox[] {
  const words = [...(line.elements ?? [])].sort((a, b) => a.x - b.x)
  if (words.length < 2) return [line]
  const gapLimit = median(words.map((w) => w.height)) * 1.1
  const groups: TextBox[][] = [[words[0]]]
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1]
    const gap = words[i].x - (prev.x + prev.width)
    if (gap > gapLimit) groups.push([words[i]])
    else groups[groups.length - 1].push(words[i])
  }
  if (groups.length === 1) return [line]
  return groups.map((g) => {
    const x = Math.min(...g.map((w) => w.x))
    const y = Math.min(...g.map((w) => w.y))
    const right = Math.max(...g.map((w) => w.x + w.width))
    const bottom = Math.max(...g.map((w) => w.y + w.height))
    return { text: g.map((w) => w.text).join(' '), x, y, width: right - x, height: bottom - y }
  })
}

/**
 * Reconstruye la cuadrícula de un tablero fotografiado a partir de sus etiquetas:
 * filas y columnas por la posición de los textos, conservando los huecos vacíos.
 */
export function gridFromLines(lines: TextLine[]): PhotoGrid {
  let boxes: Box[] = lines
    .flatMap(splitLine)
    .filter((l) => isLabel(l.text))
    .map((l) => ({ text: l.text.trim(), cx: l.x + l.width / 2, cy: l.y + l.height / 2, w: l.width, h: l.height }))
  if (!boxes.length) return { rows: 0, cols: 0, cells: [] }

  // Textos mucho más altos que la mayoría suelen ser títulos, no etiquetas de celda
  const typicalH = median(boxes.map((b) => b.h))
  boxes = boxes.filter((b) => b.h < typicalH * 2.2)
  boxes = mergeStacked(boxes)

  const h = median(boxes.map((b) => b.h))
  const w = median(boxes.map((b) => b.w))
  const rowAxis = gridAxis(
    boxes.map((b) => b.cy),
    h * 1.2,
    h * 5,
  )
  const colAxis = gridAxis(
    boxes.map((b) => b.cx),
    Math.max(h * 1.5, w * 0.4),
    w * 2,
  )

  crossCheck(rowAxis, colAxis)
  crossCheck(colAxis, rowAxis)

  // Si casi todas las etiquetas empiezan por mayúscula es el estilo del tablero, no nombres propios
  const capitalized = boxes.filter((b) => /^\p{Lu}/u.test(b.text)).length / boxes.length
  const keepCapitals = capitalized < 0.5

  let cells: PhotoCell[] = []
  const taken = new Map<string, PhotoCell>()
  for (const b of boxes.sort((a, z) => a.cy - z.cy || a.cx - z.cx)) {
    const row = rowAxis.indexOf(b.cy)
    const col = colAxis.indexOf(b.cx)
    if (row === null || col === null) continue // texto dentro de un dibujo, no una etiqueta
    const label = cleanLabel(b.text, keepCapitals)
    if (!label) continue
    const key = `${row},${col}`
    const prev = taken.get(key)
    if (prev) {
      // Dos trozos en la misma casilla: probablemente una etiqueta partida
      if (!prev.label.split(' ').includes(label)) prev.label = `${prev.label} ${label}`
      continue
    }
    const cell = { label, row, col }
    taken.set(key, cell)
    cells.push(cell)
  }
  if (!cells.length) return { rows: 0, cols: 0, cells: [] }

  // Fila superior de controles del comunicador original (leer, borrar, género...): se omite
  const topRow = Math.min(...cells.map((c) => c.row))
  const controls = cells.filter((c) => c.row === topRow && CONTROL_WORDS.has(c.label.toLowerCase())).length
  if (controls >= 2) cells = cells.filter((c) => c.row !== topRow)

  // Índices desde 0 (la primera fila y la primera columna con etiquetas)
  const minRow = Math.min(...cells.map((c) => c.row))
  const minCol = Math.min(...cells.map((c) => c.col))
  cells = cells.map((c) => ({ ...c, row: c.row - minRow, col: c.col - minCol }))

  return {
    rows: Math.max(...cells.map((c) => c.row)) + 1,
    cols: Math.max(...cells.map((c) => c.col)) + 1,
    cells,
  }
}

/**
 * Texto para el creador, fiel a la foto (para leerlo con "mantener filas y columnas"):
 * una línea por fila, palabras separadas por comas en su orden, "_" en los huecos
 * y "_" para una fila vacía.
 */
export function gridToText(grid: PhotoGrid): string {
  const table: string[][] = Array.from({ length: grid.rows }, () => Array.from({ length: grid.cols }, () => '_'))
  for (const c of grid.cells) table[c.row][c.col] = c.label.split(' ').length >= 3 ? `"${c.label}"` : c.label
  return table
    .map((r) => {
      // Los huecos del final de la fila sobran: el ancho lo marca la fila más larga
      const last = r.reduce((acc, cell, i) => (cell !== '_' ? i : acc), -1)
      return last < 0 ? '_' : r.slice(0, last + 1).join(', ')
    })
    .join('\n')
}
