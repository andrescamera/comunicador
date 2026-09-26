import { lemmatize, normalizeText } from './grammar'

/** Línea de texto reconocida en la foto, en píxeles de la imagen. */
export interface TextLine {
  text: string
  x: number
  y: number
  width: number
  height: number
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
 * Paso de la cuadrícula a partir de los centros de filas o columnas: la distancia típica
 * entre vecinos. Un hueco de dos celdas cuenta como dos pasos, así que se usa la mediana
 * de las distancias pequeñas.
 */
function pitch(centers: number[]): number {
  if (centers.length < 2) return 0
  const diffs = centers.slice(1).map((c, i) => c - centers[i])
  const m = median(diffs)
  return median(diffs.filter((d) => d < m * 1.5))
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
 * Reconstruye la cuadrícula de un tablero fotografiado a partir de sus etiquetas:
 * filas y columnas por la posición de los textos, conservando los huecos vacíos.
 */
export function gridFromLines(lines: TextLine[]): PhotoGrid {
  let boxes: Box[] = lines
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
  const rowPitch = pitch(rowCenters) || h * 4

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
  const colPitch = median(colDiffs.filter((d) => d > minW).filter((d, _, all) => d < median(all) * 1.5)) || median(boxes.map((b) => b.w)) * 2

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

/** Texto para el creador: una línea por fila de la foto, palabras separadas por comas. */
export function gridToText(grid: PhotoGrid): string {
  const rows: string[][] = Array.from({ length: grid.rows }, () => [])
  for (const c of [...grid.cells].sort((a, b) => a.row - b.row || a.col - b.col)) {
    // 3 palabras o más = frase hecha (entre comillas); "otra vez" o "por favor" siguen siendo palabras
    rows[c.row].push(c.label.split(' ').length >= 3 ? `"${c.label}"` : c.label)
  }
  return rows
    .filter((r) => r.length)
    .map((r) => r.join(', '))
    .join('\n')
}
