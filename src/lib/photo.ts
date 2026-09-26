import { lemmatize, normalizeText } from './grammar'

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

/** Agrupa valores cercanos (distancia < tol) y devuelve el centro de cada grupo. */
function clusterCenters(values: number[], tol: number): number[] {
  const s = [...values].sort((a, b) => a - b)
  const groups: number[][] = []
  for (const v of s) {
    const g = groups[groups.length - 1]
    if (g && v - g[g.length - 1] < tol) g.push(v)
    else groups.push([v])
  }
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length)
}

/**
 * Paso de la cuadrícula (distancia entre filas o columnas vecinas). Si hay filas o columnas
 * vacías, algunas distancias son múltiplos del paso: se toma la menor como referencia y cada
 * distancia se divide por el número de pasos que contiene.
 */
function pitch(diffs: number[], minGap: number): number {
  const ds = diffs.filter((d) => d > minGap)
  if (!ds.length) return 0
  const base = Math.min(...ds)
  return median(ds.map((d) => d / Math.max(1, Math.round(d / base))))
}

/**
 * Las celdas de un tablero son casi cuadradas: si un paso es casi el doble (o más) que el
 * otro, es que todas las filas (o columnas) medidas estaban separadas por huecos vacíos.
 */
function correctWithOther(p: number, other: number): number {
  if (!p || !other) return p
  const ratio = p / other
  return ratio >= 1.8 ? p / Math.round(ratio) : p
}

/**
 * Etiqueta final: verbos conjugados en infinitivo ("Quiero" -> "querer") y minúsculas.
 * Con `keepCapitals`, una palabra con mayúscula que no es un verbo conocido se conserva
 * tal cual (nombre propio: "Mati").
 */
export function cleanLabel(text: string, keepCapitals: boolean): string {
  const t = normalizeText(text).replace(/[.,;:!¡?¿"“”]+$/g, '').replace(/^["“¿¡]+/, '')
  const lower = t.toLowerCase()
  if (lower.includes(' ')) return lower
  const lemma = lemmatize(lower)
  if (lemma) return lemma
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
  const rowCenters = clusterCenters(
    boxes.map((b) => b.cy),
    h * 1.2,
  )

  // El paso de columna se estima dentro de cada fila (vecinos en la misma fila)
  const rowOf = (b: Box) => rowCenters.reduce((best, c, i) => (Math.abs(c - b.cy) < Math.abs(rowCenters[best] - b.cy) ? i : best), 0)
  const colDiffs: number[] = []
  rowCenters.forEach((_, r) => {
    const xs = boxes
      .filter((b) => rowOf(b) === r)
      .map((b) => b.cx)
      .sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) colDiffs.push(xs[i] - xs[i - 1])
  })
  const minW = median(boxes.map((b) => b.w)) * 0.5
  const rawCol = pitch(colDiffs, minW)
  const rawRow = pitch(
    rowCenters.slice(1).map((c, i) => c - rowCenters[i]),
    h,
  )
  const colPitch = correctWithOther(rawCol, rawRow) || median(boxes.map((b) => b.w)) * 2
  const rowPitch = correctWithOther(rawRow, rawCol) || h * 4

  // Si casi todas las etiquetas empiezan por mayúscula es el estilo del tablero, no nombres propios
  const capitalized = boxes.filter((b) => /^\p{Lu}/u.test(b.text)).length / boxes.length
  const keepCapitals = capitalized < 0.5

  const minCx = Math.min(...boxes.map((b) => b.cx))
  const firstRow = rowCenters[0]

  const cells: PhotoCell[] = []
  const taken = new Map<string, PhotoCell>()
  for (const b of boxes.sort((a, z) => a.cy - z.cy || a.cx - z.cx)) {
    const row = Math.max(0, Math.round((rowCenters[rowOf(b)] - firstRow) / rowPitch))
    const col = Math.max(0, Math.round((b.cx - minCx) / colPitch))
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

  // Sin duplicados: la misma palabra solo una vez
  const seen = new Set<string>()
  const unique = cells.filter((c) => (seen.has(c.label.toLowerCase()) ? false : (seen.add(c.label.toLowerCase()), true)))

  return {
    rows: Math.max(...unique.map((c) => c.row)) + 1,
    cols: Math.max(...unique.map((c) => c.col)) + 1,
    cells: unique,
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
