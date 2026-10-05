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

/** Quita una columna vacía: las celdas de su derecha se desplazan una columna a la izquierda. */
function removeColumn(board: Board, c: number): Board {
  const zones = { ...board.zones }
  for (const z of ZONE_ORDER) {
    const [s, e] = zones[z]
    if (s > c) zones[z] = [s - 1, e - 1]
    else if (e >= c) zones[z] = [s, e - 1] // la columna quitada era de esta zona
  }
  return {
    ...board,
    cols: board.cols - 1,
    zones,
    cells: board.cells.map((cell) => (cell.col > c ? { ...cell, col: cell.col - 1 } : cell)),
  }
}

/** Quita una fila vacía: las celdas de debajo suben una fila. */
function removeRow(board: Board, r: number): Board {
  return { ...board, rows: board.rows - 1, cells: board.cells.map((cell) => (cell.row > r ? { ...cell, row: cell.row - 1 } : cell)) }
}

/**
 * Cambia el tamaño. Al crecer se añaden filas/columnas al final sin mover nada.
 * Al reducir se quita la columna (o fila) vacía más a la derecha (o más abajo), aunque esté en
 * medio: es una acción explícita del terapeuta. Devuelve null si no hay ninguna vacía que quitar.
 */
export function resizeBoard(board: Board, rows: number, cols: number): Board | null {
  if (rows < 1 || cols < 1) return null
  let b: Board = board
  while (b.cols > cols) {
    const used = new Set(b.cells.map((c) => c.col))
    let empty = -1
    for (let c = b.cols - 1; c >= 0; c--) if (!used.has(c)) { empty = c; break }
    if (empty < 0) return null
    b = removeColumn(b, empty)
  }
  while (b.rows > rows) {
    const used = new Set(b.cells.map((c) => c.row))
    let empty = -1
    for (let r = b.rows - 1; r >= 0; r--) if (!used.has(r)) { empty = r; break }
    if (empty < 0) return null
    b = removeRow(b, empty)
  }
  if (cols > b.cols) {
    // La última zona se estira con el borde derecho
    const zones = { ...b.zones, E: [Math.min(b.zones.E[0], b.cols), cols - 1] as [number, number] }
    b = { ...b, cols, zones }
  }
  if (rows > b.rows) b = { ...b, rows }
  return b
}

// ---------- Cuadrícula común a todos los tableros ----------
// Todas las fichas tienen el mismo tamaño en todos los tableros (también dentro de las carpetas):
// todos los tableros de una biblioteca comparten las filas y columnas del tablero principal.

type Lib = { rootId: string; boards: Record<string, Board> }

/** Ajusta un tablero a la cuadrícula común sin mover celdas si caben; si no, lo recoloca por zonas. */
export function fitBoard(board: Board, rows: number, cols: number): Board {
  if (board.rows === rows && board.cols === cols) return board
  const fits = board.cells.every((c) => c.row < rows && c.col < cols)
  if (fits) {
    const zones = { ...board.zones }
    for (const z of ZONE_ORDER) zones[z] = [Math.min(zones[z][0], cols), Math.min(zones[z][1], cols - 1)]
    zones.E = [Math.min(zones.E[0], cols), cols - 1] // la última zona llega hasta el borde derecho
    return { ...board, rows, cols, zones }
  }
  const cells = board.cells.map(({ row: _r, col: _c, ...c }) => c)
  return { ...board, ...layoutCells(cells, { rows, cols }) }
}

/**
 * Todos los tableros con las filas y columnas del principal. Si una carpeta no cabe (una
 * plantilla con más palabras que casillas), crecen todos a la vez: las fichas siguen midiendo
 * lo mismo en todas partes.
 */
export function normalizeLibrary<L extends Lib>(lib: L): L {
  const root = lib.boards[lib.rootId]
  if (!root) return lib
  const all = Object.values(lib.boards)
  const cells = all.flatMap((b) => b.cells)
  const rows = Math.max(root.rows, ...cells.map((c) => c.row + 1))
  const cols = Math.max(root.cols, ...cells.map((c) => c.col + 1))
  let changed = false
  const boards: Record<string, Board> = {}
  for (const [id, b] of Object.entries(lib.boards)) {
    const fitted = fitBoard(b, rows, cols)
    if (fitted !== b) changed = true
    boards[id] = fitted
  }
  return changed ? { ...lib, boards } : lib
}

/** Cambiar filas/columnas de todos los tableros a la vez. Null si alguno no tiene filas/columnas vacías que quitar. */
export function resizeLibrary<L extends Lib>(lib: L, rows: number, cols: number): L | null {
  const boards: Record<string, Board> = {}
  for (const [id, b] of Object.entries(lib.boards)) {
    const r = resizeBoard(b, rows, cols)
    if (!r) return null
    boards[id] = r
  }
  return { ...lib, boards }
}

// ---------- Carpetas dentro de su zona ----------

export interface Area {
  r0: number
  c0: number
  r1: number
  c1: number
}

export const FOLDER_PREV = '__folder_prev'
export const FOLDER_NEXT = '__folder_next'

/**
 * Zona de carpetas del tablero principal: el bloque de carpetas pegadas entre sí (también en
 * diagonal) que incluye la carpeta abierta, p. ej. el bloque de 4 × 5 de «Nombres». Ahí se ve el
 * contenido de la carpeta; el resto del tablero no se mueve. null si es demasiado pequeño (< 4 casillas).
 */
export function folderArea(root: Board, folderCellId: string): Area | null {
  const open = root.cells.find((c) => c.id === folderCellId)
  if (!open) return null
  const folders = root.cells.filter((c) => c.kind === 'folder')
  const block = [open]
  for (let k = 0; k < block.length; k++) {
    const c = block[k]
    for (const f of folders)
      if (!block.includes(f) && Math.abs(f.row - c.row) <= 1 && Math.abs(f.col - c.col) <= 1) block.push(f)
  }
  const area = {
    r0: Math.min(...block.map((c) => c.row)),
    c0: Math.min(...block.map((c) => c.col)),
    r1: Math.max(...block.map((c) => c.row)),
    c1: Math.max(...block.map((c) => c.col)),
  }
  return (area.r1 - area.r0 + 1) * (area.c1 - area.c0 + 1) >= 4 ? area : null
}

const inside = (a: Area, c: Pick<Cell, 'row' | 'col'>) => c.row >= a.r0 && c.row <= a.r1 && c.col >= a.c0 && c.col <= a.c1

/**
 * El tablero principal con una carpeta abierta dentro de su zona: fuera de la zona todo sigue igual;
 * dentro, las fichas de la carpeta (siempre en el mismo orden, por columnas). Si no caben, páginas
 * con flechas en las últimas casillas de la zona.
 */
export function inlineFolder(root: Board, folder: Board, area: Area, page = 0): { board: Board; pages: number } {
  const rows = area.r1 - area.r0 + 1
  const capacity = rows * (area.c1 - area.c0 + 1)
  const contents = folder.cells.filter((c) => !c.hidden).sort((a, b) => a.col - b.col || a.row - b.row)
  const perPage = contents.length > capacity ? capacity - 2 : capacity
  const pages = Math.max(1, Math.ceil(contents.length / perPage))
  const current = Math.min(Math.max(0, page), pages - 1)
  const at = (i: number) => ({ row: area.r0 + (i % rows), col: area.c0 + Math.floor(i / rows) })
  const placed: Cell[] = contents.slice(current * perPage, (current + 1) * perPage).map((c, i) => ({ ...c, ...at(i) }))
  if (pages > 1) {
    const nav = (id: string, label: string, i: number): Cell => ({ id, kind: 'word', label, category: 'misc', textOnly: true, ...at(i) })
    if (current > 0) placed.push(nav(FOLDER_PREV, '◂', capacity - 2))
    if (current < pages - 1) placed.push(nav(FOLDER_NEXT, 'más ▸', capacity - 1))
  }
  return { board: { ...root, name: folder.name, cells: [...root.cells.filter((c) => !inside(area, c)), ...placed] }, pages }
}
