/** Píxeles RGBA como los da un canvas (`ctx.getImageData`). */
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface CellRect {
  row: number
  col: number
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedGrid {
  rows: number
  cols: number
  cells: CellRect[]
}

interface Band {
  start: number
  end: number // exclusivo
}

// Color reducido (4 bits por canal): el ruido de la compresión JPEG no rompe la uniformidad
const quant = (d: Uint8ClampedArray, i: number) => ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4)

/**
 * Parte de la línea de píxeles que tiene su color más frecuente. En el hueco entre dos filas
 * (o columnas) de casillas es casi toda; una línea que atraviesa casillas cruza colores,
 * dibujos y bordes.
 */
function uniformity(d: Uint8ClampedArray, start: number, step: number, count: number): number {
  const freq = new Map<number, number>()
  let best = 0
  for (let k = 0; k < count; k++) {
    const q = quant(d, start + k * step)
    const n = (freq.get(q) ?? 0) + 1
    freq.set(q, n)
    if (n > best) best = n
  }
  return best / count
}

/**
 * Qué líneas son hueco. El umbral se adapta a la imagen: a medio camino entre una línea
 * típica (la mayoría cruzan casillas) y la más uniforme. Las sombras y las pestañas de
 * carpeta hacen que un hueco no sea del todo de un color.
 */
function gapLines(values: number[]): boolean[] {
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const threshold = Math.min(0.9, (median + sorted[sorted.length - 1]) / 2)
  return values.map((v) => v >= threshold)
}

/** Tramos seguidos de líneas "no uniformes": cada tramo es una fila (o columna) de casillas. */
function bands(isGap: boolean[], minSize: number): Band[] {
  const out: Band[] = []
  let start = -1
  for (let i = 0; i <= isGap.length; i++) {
    const gap = i === isGap.length || isGap[i]
    if (!gap && start < 0) start = i
    if (gap && start >= 0) {
      if (i - start >= minSize) out.push({ start, end: i })
      start = -1
    }
  }
  return out
}

const size = (b: Band) => b.end - b.start

/**
 * Se queda con la serie más larga de tramos seguidos de tamaño parecido (las casillas miden
 * todas lo mismo): descarta pestañas, barras de frase y otros elementos de la pantalla.
 */
function regularRun(list: Band[]): Band[] {
  let best: Band[] = []
  for (const ref of list) {
    const similar = (b: Band) => Math.abs(size(b) - size(ref)) <= size(ref) * 0.25
    let run: Band[] = []
    for (const b of list) {
      if (similar(b)) {
        const prev = run[run.length - 1]
        // Una separación mucho mayor que una casilla corta la serie (otra zona de la pantalla)
        if (prev && b.start - prev.end > size(ref) * 0.6) run = []
        run.push(b)
        if (run.length > best.length) best = [...run]
      } else run = []
    }
  }
  return best
}

const EDGE = 60 // salto de brillo (suma RGB, 0–765) que cuenta como borde

/**
 * Tramos de columnas de casillas: se cuenta, para cada x, en cuántas filas de píxeles de las
 * casillas hay un borde vertical. Los lados de las casillas lo tienen en casi todas; los
 * dibujos y las letras, solo en alguna. Entre dos lados seguidos queda una casilla (ancha)
 * o un hueco (estrecho, se descarta después por tamaño).
 */
function edgeBands(img: Pixels, rowBands: Band[]): Band[] {
  const { width, data } = img
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i] + data[i + 1] + data[i + 2]
  }
  const counts = new Array<number>(width).fill(0)
  let total = 0
  for (const r of rowBands) {
    for (let y = r.start; y < r.end; y++) {
      total++
      for (let x = 1; x < width - 1; x++) if (Math.abs(lum(x + 1, y) - lum(x - 1, y)) > EDGE) counts[x]++
    }
  }
  const isSide = counts.map((n) => n >= total * 0.45)
  // Los bordes de la imagen también cierran casillas (una columna cortada por la captura)
  isSide[0] = isSide[width - 1] = true
  const out: Band[] = []
  let last = -1
  for (let x = 0; x < width; x++) {
    if (!isSide[x]) continue
    if (last >= 0 && x - last > 1) out.push({ start: last + 1, end: x })
    last = x
  }
  return out.filter((b) => size(b) >= Math.max(8, width * 0.02))
}

/**
 * Busca la cuadrícula de casillas de una captura o foto de tablero a partir de los huecos
 * de color uniforme que las separan. Devuelve null si no hay una cuadrícula clara.
 */
export function detectGrid(img: Pixels): DetectedGrid | null {
  const { width, height, data } = img
  const rowValues: number[] = []
  for (let y = 0; y < height; y++) rowValues.push(uniformity(data, y * width * 4, 4, width))
  const rowBands = regularRun(bands(gapLines(rowValues), Math.max(8, height * 0.03)))
  if (rowBands.length < 2) return null

  // Columnas: por los bordes verticales que se repiten en todas las filas. No sirve buscar
  // huecos de un color, porque una columna entera de casillas puede ser del mismo color.
  const colBands = regularRun(edgeBands(img, rowBands))
  if (colBands.length < 2) return null

  const cells: CellRect[] = []
  rowBands.forEach((r, row) =>
    colBands.forEach((c, col) =>
      cells.push({ row, col, x: c.start, y: r.start, width: size(c), height: size(r) }),
    ),
  )
  return { rows: rowBands.length, cols: colBands.length, cells }
}
