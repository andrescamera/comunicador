import type { Board, Category, Cell, Zone, Zones } from './types'

/**
 * Colocación de celdas siguiendo los patrones de las aplicaciones SAAC de referencia
 * (TD Snap Core First, Proloquo2Go Crescendo, LAMP WFL, Grid 3):
 *  - Cada categoría ocupa un bloque de columnas fijo, de izquierda a derecha en orden sintáctico.
 *  - Una celda, una vez colocada, no se mueve sola nunca: las nuevas ocupan huecos libres.
 *  - Tamaño de cuadrícula fijo con huecos de reserva para que el vocabulario crezca.
 */

export type NewCell = Omit<Cell, 'row' | 'col'>

export const ZONE_ORDER: Zone[] = ['A', 'B', 'C', 'D', 'E']

export const ZONE_LABELS: Record<Zone, string> = {
  A: 'Personas y preguntas',
  B: 'Verbos',
  C: 'Descriptivos y palabras pequeñas',
  D: 'Nombres',
  E: 'Social, frases y carpetas',
}

export function zoneLabel(board: Pick<Board, 'zoneLabels'>, zone: Zone): string {
  return board.zoneLabels?.[zone]?.trim() || ZONE_LABELS[zone]
}

const CATEGORY_ZONE: Record<Category, Zone> = {
  pronoun: 'A',
  person: 'A',
  question: 'A',
  verb: 'B',
  negation: 'C',
  adjective: 'C',
  misc: 'C',
  noun: 'D',
  social: 'E',
}

export function zoneOf(cell: Pick<Cell, 'kind' | 'category'>): Zone {
  return cell.kind === 'word' ? CATEGORY_ZONE[cell.category] : 'E'
}

export const GRID_SIZES = [
  { rows: 3, cols: 4 },
  { rows: 4, cols: 5 },
  { rows: 4, cols: 6 },
  { rows: 5, cols: 8 },
  { rows: 6, cols: 10 },
  { rows: 7, cols: 12 },
  { rows: 8, cols: 14 },
]

type Counts = Record<Zone, number>

export function countZones(cells: Pick<Cell, 'kind' | 'category'>[]): Counts {
  const counts: Counts = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  for (const c of cells) counts[zoneOf(c)] += 1
  return counts
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Tamaño más pequeño en el que cabe cada zona y queda ~25 % de huecos para crecer. */
export function pickSize(cells: Pick<Cell, 'kind' | 'category'>[]): { rows: number; cols: number } {
  const counts = countZones(cells)
  const n = cells.length
  return (
    GRID_SIZES.find(
      (s) => s.rows * s.cols >= Math.ceil(n * 1.25) && sum(ZONE_ORDER.map((z) => Math.ceil(counts[z] / s.rows))) <= s.cols,
    ) ?? GRID_SIZES[GRID_SIZES.length - 1]
  )
}

/** Reparte `total` en enteros proporcionales a `weights` (método del mayor resto). */
function proportional(weights: number[], total: number): number[] {
  const w = sum(weights)
  if (w === 0 || total <= 0) return weights.map(() => 0)
  const exact = weights.map((x) => (x / w) * total)
  const out = exact.map(Math.floor)
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  const remaining = total - sum(out)
  for (let k = 0; k < remaining; k++) out[order[k % order.length].i] += 1
  return out
}

const DEFAULT_WEIGHTS: Counts = { A: 2, B: 2, C: 2, D: 3, E: 1 }

/** Anchura de cada zona: lo que necesita + las columnas libres repartidas en proporción. */
export function computeZones(counts: Counts, rows: number, cols: number): Zones {
  const weights = sum(ZONE_ORDER.map((z) => counts[z])) > 0 ? counts : DEFAULT_WEIGHTS
  const need = ZONE_ORDER.map((z) => (counts[z] > 0 ? Math.ceil(counts[z] / rows) : 0))
  let widths: number[]
  if (sum(need) > cols) {
    widths = proportional(ZONE_ORDER.map((z) => weights[z]), cols)
  } else {
    const extra = proportional(ZONE_ORDER.map((z) => weights[z]), cols - sum(need))
    widths = need.map((n, i) => n + extra[i])
  }
  const zones = {} as Zones
  let start = 0
  ZONE_ORDER.forEach((z, i) => {
    zones[z] = [start, start + widths[i] - 1] // anchura 0 => rango vacío
    start += widths[i]
  })
  return zones
}

const key = (r: number, c: number) => `${r},${c}`

export function cellAt(board: Board, row: number, col: number): Cell | undefined {
  return board.cells.find((c) => c.row === row && c.col === col)
}

/**
 * Primer hueco libre de la zona, por columnas: de arriba abajo y luego la columna siguiente,
 * para que cada categoría se lea como una columna. Si la zona está llena, el hueco más cercano.
 */
export function findSlot(board: Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'>, zone: Zone): { row: number; col: number } | null {
  const occupied = new Set(board.cells.map((c) => key(c.row, c.col)))
  const [s, e] = board.zones[zone]
  for (let c = Math.max(0, s); c <= Math.min(e, board.cols - 1); c++) {
    for (let r = 0; r < board.rows; r++) {
      if (!occupied.has(key(r, c))) return { row: r, col: c }
    }
  }
  const distance = (c: number) => (c < s ? s - c : c > e ? c - e : 0)
  const cols = Array.from({ length: board.cols }, (_, c) => c).sort((a, b) => distance(a) - distance(b) || b - a)
  for (const c of cols) {
    for (let r = 0; r < board.rows; r++) {
      if (!occupied.has(key(r, c))) return { row: r, col: c }
    }
  }
  return null
}

/** Coloca una celda nueva sin mover ninguna existente. Si no hay sitio, añade una fila. */
export function placeCell<B extends Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'>>(board: B, cell: NewCell): B {
  const zone = zoneOf(cell)
  let target = board
  let slot = findSlot(target, zone)
  if (!slot) {
    target = { ...target, rows: target.rows + 1 }
    slot = findSlot(target, zone)!
  }
  return { ...target, cells: [...target.cells, { ...cell, row: slot.row, col: slot.col }] }
}

/** Distribución inicial de un tablero nuevo: celdas ordenadas y colocadas por zonas. */
export function layoutCells(
  cells: NewCell[],
  size?: { rows: number; cols: number },
): Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'> {
  const { rows, cols } = size ?? pickSize(cells)
  let board: Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'> = {
    rows,
    cols,
    zones: computeZones(countZones(cells), rows, cols),
    cells: [],
  }
  for (const cell of cells) board = placeCell(board, cell)
  return board
}

/** Reorganización explícita (la pide el terapeuta): vuelve a colocar todo por zonas, con el mismo tamaño. */
export function relayoutBoard(board: Board, order: (cells: NewCell[]) => NewCell[]): Board {
  const cells = order(board.cells.map(({ row: _r, col: _c, ...c }) => c))
  return { ...board, ...layoutCells(cells, { rows: board.rows, cols: board.cols }) }
}

/**
 * Distribución copiada de un tablero fotografiado: cada celda va a la casilla donde estaba
 * su palabra en la foto (así se conserva la memoria motora del tablero anterior).
 * Las que no aparecen en la foto ocupan huecos libres de su zona.
 */
export function layoutAt(
  cells: NewCell[],
  grid: { rows: number; cols: number; cells: { id?: string; label: string; row: number; col: number }[] },
): Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'> {
  // Por id (exacto, admite palabras repetidas) o, si no hay id, por la palabra
  const byId = new Map(grid.cells.filter((c) => c.id).map((c) => [c.id!, c]))
  const byLabel = new Map(grid.cells.map((c) => [c.label.toLowerCase(), c]))
  const used = new Set<string>()
  const placed: Cell[] = []
  const rest: NewCell[] = []
  for (const cell of cells) {
    const p = byId.get(cell.id) ?? byLabel.get(cell.label.toLowerCase())
    const k = p && `${p.row},${p.col}`
    if (p && k && !used.has(k)) {
      used.add(k)
      placed.push({ ...cell, row: p.row, col: p.col })
    } else rest.push(cell)
  }
  let board: Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'> = {
    rows: Math.max(1, grid.rows),
    cols: Math.max(1, grid.cols),
    zones: computeZones(countZones(cells), Math.max(1, grid.rows), Math.max(1, grid.cols)),
    cells: placed,
  }
  for (const cell of rest) board = placeCell(board, cell)
  return board
}

/** Mueve una celda a otra casilla; si está ocupada, las intercambia. */
export function moveCellTo(board: Board, id: string, row: number, col: number): Board {
  const moving = board.cells.find((c) => c.id === id)
  if (!moving) return board
  const other = cellAt(board, row, col)
  return {
    ...board,
    cells: board.cells.map((c) => {
      if (c.id === id) return { ...c, row, col }
      if (other && c.id === other.id) return { ...c, row: moving.row, col: moving.col }
      return c
    }),
  }
}

/** Cambia el tamaño sin mover celdas. Devuelve null si alguna quedaría fuera. */
export function resizeBoard(board: Board, rows: number, cols: number): Board | null {
  if (rows < 1 || cols < 1) return null
  if (board.cells.some((c) => c.row >= rows || c.col >= cols)) return null
  const zones = { ...board.zones }
  // La última zona se estira o encoge con el borde derecho
  zones.E = [Math.min(zones.E[0], cols), cols - 1]
  for (const z of ZONE_ORDER) zones[z] = [Math.min(zones[z][0], cols), Math.min(zones[z][1], cols - 1)]
  return { ...board, rows, cols, zones }
}
