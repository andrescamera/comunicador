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
export function uniformity(d: Uint8ClampedArray, start: number, step: number, count: number): number {
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
export function gapLines(values: number[]): boolean[] {
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const threshold = Math.min(0.9, (median + sorted[sorted.length - 1]) / 2)
  return values.map((v) => v >= threshold)
}

/** Tramos seguidos de líneas "no uniformes": cada tramo es una fila (o columna) de casillas. */
export function bands(isGap: boolean[], minSize: number): Band[] {
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
export function regularRun(list: Band[]): Band[] {
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
export function edgeBands(img: Pixels, rowBands: Band[]): Band[] {
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
  // Dos métodos: por los huecos de un color y por la repetición de los bordes. Cada uno falla en
  // imágenes distintas (sombras, fondos claros, casillas que faltan): gana el que encuentra más casillas.
  const byGaps = detectByGaps(img)
  const byPeriod = detectByPeriod(img)
  if (!byGaps || !byPeriod) return byGaps ?? byPeriod
  return byPeriod.cells.length > byGaps.cells.length ? byPeriod : byGaps
}

export function detectByGaps(img: Pixels): DetectedGrid | null {
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

// ---------- Por repetición: casillas con sombra, huecos vacíos, fondos de varios colores ----------

/**
 * Cuántos bordes hay en cada línea: para las filas, saltos de brillo en vertical (los lados de
 * arriba y abajo de las casillas); para las columnas, en horizontal.
 */
function edgeProfile(img: Pixels, along: 'y' | 'x'): number[] {
  const { width, height, data } = img
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return data[i] + data[i + 1] + data[i + 2]
  }
  const n = along === 'y' ? height : width
  const out = new Array<number>(n).fill(0)
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const d = along === 'y' ? Math.abs(lum(x, y + 1) - lum(x, y - 1)) : Math.abs(lum(x + 1, y) - lum(x - 1, y))
      if (d > EDGE) out[along === 'y' ? y : x]++
    }
  return out
}

/** Distancia a la que se repite el perfil (alto o ancho de casilla + hueco), por autocorrelación */
export function period(p: number[]): number | null {
  const n = p.length
  const mean = p.reduce((a, b) => a + b, 0) / n
  const q = p.map((v) => v - mean)
  const minK = Math.max(12, Math.round(n * 0.05))
  const maxK = Math.round(n * 0.5)
  const r: number[] = []
  let top = 0
  for (let k = minK; k <= maxK; k++) {
    let acc = 0
    for (let i = 0; i + k < n; i++) acc += q[i] * q[i + k]
    r[k] = acc / (n - k)
    if (r[k] > top) top = r[k]
  }
  if (top <= 0) return null
  // El primer máximo local fuerte (los múltiplos del periodo también correlan)
  for (let k = minK + 1; k < maxK; k++) if (r[k] >= top * 0.8 && r[k] >= r[k - 1] && r[k] >= r[k + 1]) return k
  return null
}

/**
 * Casillas a lo largo de un eje con periodo `k`: plegando el perfil sobre sí mismo salen dos picos
 * (el borde de entrada y el de salida de cada casilla); entre ellos, el tramo largo es la casilla y
 * el corto, el hueco. Solo se cuentan las casillas que tienen bordes de verdad (no la pantalla vacía).
 */
export function periodicBands(p: number[], k: number): Band[] {
  const n = p.length
  const max = Math.max(...p)
  // Lados claros (muchos bordes en esa línea) y los tramos entre ellos que miden casi un periodo:
  // esos son casillas enteras. Votan dónde empieza cada casilla (su posición módulo el periodo).
  const sides: number[] = []
  for (let i = 0; i < n; i++) if (p[i] >= max * 0.35) sides.push(i)
  const votes = new Map<number, { weight: number; lens: number[] }>()
  for (let j = 1; j < sides.length; j++) {
    const len = sides[j] - sides[j - 1]
    if (len < k * 0.55 || len > k * 0.97) continue
    const phase = Math.round(((sides[j - 1] % k) + k) % k / 3) * 3 // con un margen de ±3 px
    const v = votes.get(phase) ?? { weight: 0, lens: [] }
    v.weight += p[sides[j - 1]] + p[sides[j]]
    v.lens.push(len)
    votes.set(phase, v)
  }
  const best = [...votes.entries()].sort((x, y) => y[1].weight - x[1].weight)[0]
  if (!best) return []
  const lens = best[1].lens.sort((x, y) => x - y)
  const len = lens[Math.floor(lens.length / 2)]
  const strength = (i: number) => Math.max(p[i] ?? 0, p[i - 1] ?? 0, p[i + 1] ?? 0, p[i - 2] ?? 0, p[i + 2] ?? 0)
  const out: Band[] = []
  for (let s = best[0] % k; s < n; s += k) {
    const band = { start: s + 1, end: Math.min(n, s + len) }
    if (size(band) < len * 0.8) continue
    // Una casilla de verdad tiene un borde marcado al menos a un lado (no la pantalla vacía)
    if (Math.max(strength(s), strength(s + len)) >= max * 0.2) out.push(band)
  }
  return out
}

export function detectByPeriod(img: Pixels): DetectedGrid | null {
  const py = edgeProfile(img, 'y')
  const px = edgeProfile(img, 'x')
  const ky = period(py)
  const kx = period(px)
  if (!ky || !kx) return null
  const rowBands = periodicBands(py, ky)
  const colBands = periodicBands(px, kx)
  if (rowBands.length < 2 || colBands.length < 2) return null
  const cells: CellRect[] = []
  rowBands.forEach((r, row) => colBands.forEach((c, col) => cells.push({ row, col, x: c.start, y: r.start, width: size(c), height: size(r) })))
  return { rows: rowBands.length, cols: colBands.length, cells }
}
