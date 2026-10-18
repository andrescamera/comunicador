import type { Board, Category, Cell, Group, Zone, Zones } from './types'

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
export function placeCell<B extends Pick<Board, 'rows' | 'cols' | 'zones' | 'cells'> & { groups?: Group[] }>(board: B, cell: NewCell): B {
  // Con grupos: el primer hueco del grupo de su categoría (las carpetas, en el de carpetas)
  const group = board.groups?.find((g) => (cell.kind === 'folder' ? g.folders : g.color === (cell.kind === 'phrase' ? 'social' : cell.category)))
  if (group) {
    const taken = new Set(board.cells.map((c) => key(c.row, c.col)))
    const slot = groupSlots(group).find((s) => !taken.has(key(s.row, s.col)) && s.row < board.rows && s.col < board.cols)
    if (slot) return { ...board, cells: [...board.cells, { ...cell, ...slot }] }
  }
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
  const anchored = anchorFolders({ ...lib, boards })
  if (anchored !== boards) return { ...lib, boards: anchored }
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
  // Con grupos guardados, la zona es el grupo de carpetas en el que está
  if (root.groups) return root.groups.find((g) => g.folders && inside(g.area, open))?.area ?? null
  return adjacentFolderBlock(root, open)
}

/** Sin grupos guardados: el bloque de carpetas pegadas a `open` (al menos 4 casillas) */
function adjacentFolderBlock(root: Board, open: Cell): Area | null {
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
export const insideArea = (a: Area, row: number, col: number) => inside(a, { row, col })

/**
 * El tablero principal con una carpeta abierta dentro de su zona: fuera de la zona todo sigue igual;
 * dentro, las fichas de la carpeta (siempre en el mismo orden, por columnas). Si no caben, páginas
 * con flechas en las últimas casillas de la zona.
 */
export function inlineFolder(root: Board, folder: Board, area: Area, page = 0): { board: Board; pages: number } {
  const rows = area.r1 - area.r0 + 1
  const capacity = rows * (area.c1 - area.c0 + 1)
  const contents = folder.cells.filter((c) => !c.hidden).sort((a, b) => a.col - b.col || a.row - b.row)
  // Colocada en la zona: cada ficha en su sitio, aunque queden huecos (como en edición)
  if (folder.inZone && contents.length <= capacity && contents.every((c) => inside(area, c)))
    return { board: { ...root, name: folder.name, cells: [...root.cells.filter((c) => !inside(area, c)), ...contents] }, pages: 1 }
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

/** Casillas de la zona en el orden en que se rellenan (por columnas) */
function areaSlots(area: Area): { row: number; col: number }[] {
  const slots = []
  for (let col = area.c0; col <= area.c1; col++) for (let row = area.r0; row <= area.r1; row++) slots.push({ row, col })
  return slots
}

/** Zona en la que se ve cada carpeta (y sus subcarpetas) al abrirla desde el principal */
export function folderAreas(lib: Lib): Map<string, Area> {
  const root = lib.boards[lib.rootId]
  const areas = new Map<string, Area>()
  if (!root) return areas
  for (const cell of root.cells) {
    if (cell.kind !== 'folder' || !cell.target) continue
    const area = folderArea(root, cell.id)
    if (!area) continue
    const queue = [cell.target]
    while (queue.length) {
      const id = queue.shift()!
      const b = lib.boards[id]
      if (!b || id === lib.rootId || id === root.quickChat || areas.has(id)) continue
      areas.set(id, area)
      for (const c of b.cells) if (c.kind === 'folder' && c.target) queue.push(c.target)
    }
  }
  return areas
}

/**
 * Coloca las fichas de una carpeta dentro de su zona, para que en edición se vean donde se usan.
 * La primera vez, en el mismo orden en que ya se veían; después cada ficha conserva su sitio y solo
 * las que quedan fuera (p. ej. si se mueve la zona) pasan a un hueco libre. Si no cabe, se deja igual.
 */
export function anchorFolder(folder: Board, area: Area): Board {
  const slots = areaSlots(area)
  if (folder.cells.length > slots.length) return folder
  const key = (c: { row: number; col: number }) => `${c.row},${c.col}`
  const placed = new Map<string, { row: number; col: number }>()
  const taken = new Set<string>()
  const order = [...folder.cells].sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden) || a.col - b.col || a.row - b.row)
  if (folder.inZone)
    for (const c of order)
      if (inside(area, c) && !taken.has(key(c))) {
        placed.set(c.id, { row: c.row, col: c.col })
        taken.add(key(c))
      }
  const free = slots.filter((s) => !taken.has(key(s)))
  for (const c of order) if (!placed.has(c.id)) placed.set(c.id, free.shift()!)
  const moved = folder.cells.some((c) => key(c) !== key(placed.get(c.id)!))
  if (folder.inZone && !moved) return folder
  return { ...folder, inZone: true, cells: folder.cells.map((c) => ({ ...c, ...placed.get(c.id)! })) }
}

/** Todas las carpetas colocadas en su zona. Devuelve el mismo objeto si no cambia nada. */
function anchorFolders(lib: Lib): Record<string, Board> {
  let boards = lib.boards
  for (const [id, area] of folderAreas(lib)) {
    const b = anchorFolder(boards[id], area)
    if (b !== boards[id]) boards = { ...boards, [id]: b }
  }
  return boards
}

// ---------- Grupos ----------

/** Casillas de un rectángulo en orden de llenado: por columnas (de arriba abajo) o por filas */
export function fillOrder(area: Area, byRows = false): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = []
  if (byRows) for (let row = area.r0; row <= area.r1; row++) for (let col = area.c0; col <= area.c1; col++) out.push({ row, col })
  else for (let col = area.c0; col <= area.c1; col++) for (let row = area.r0; row <= area.r1; row++) out.push({ row, col })
  return out
}
export const groupSlots = (g: Group) => fillOrder(g.area, g.byRows)
export const groupAt = (groups: Group[], row: number, col: number) => groups.find((g) => insideArea(g.area, row, col))

// Nombre de cada grupo deducido, por el color de sus fichas (persona y pronombre comparten color)
const GROUP_NAMES: Partial<Record<Category, string>> = {
  pronoun: 'Personas',
  verb: 'Verbos',
  noun: 'Nombres',
  adjective: 'Descriptivos',
  social: 'Social',
  question: 'Preguntas',
  negation: 'Negación',
  misc: 'Otras palabras',
}
const colorKey = (c: Pick<Cell, 'kind' | 'category'>): Category => (c.kind === 'phrase' ? 'social' : c.category === 'person' ? 'pronoun' : c.category)
const overlaps = (a: Area, b: Area) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1
const bbox = (cells: Pick<Cell, 'row' | 'col'>[]): Area => ({
  r0: Math.min(...cells.map((c) => c.row)),
  c0: Math.min(...cells.map((c) => c.col)),
  r1: Math.max(...cells.map((c) => c.row)),
  c1: Math.max(...cells.map((c) => c.col)),
})

/**
 * Grupos de un tablero: los guardados o, en el principal sin grupos, los que se deducen de cómo
 * están colocadas las fichas: cada bloque de fichas del mismo color pegadas entre sí es un
 * rectángulo (si no entra nada de otro color), y cada bloque de carpetas, la zona de carpetas.
 * Una carpeta suelta (p. ej. «más ▸») va con el grupo en el que está o al que está pegada.
 */
export function boardGroups(board: Board, isRoot: boolean): Group[] {
  if (board.groups) return board.groups
  if (!isRoot) return []
  const blocks: Area[] = []
  for (const f of board.cells.filter((c) => c.kind === 'folder')) {
    if (blocks.some((b) => inside(b, f))) continue
    const b = adjacentFolderBlock(board, f)
    if (b) blocks.push(b)
  }
  const rects: { area: Area; color?: Category; folders?: boolean }[] = blocks.map((area) => ({ area, folders: true }))
  const at = new Map(board.cells.map((c) => [key(c.row, c.col), c]))
  const free = (c: Cell) => !blocks.some((b) => inside(b, c))
  const words = board.cells.filter((c) => c.kind !== 'folder' && free(c))
  // Un rectángulo vale si no pisa otro grupo y lo que hay dentro es de su color (o carpetas sueltas)
  const fits = (area: Area, color: Category, except?: Area) => {
    if (rects.some((r) => r.area !== except && overlaps(r.area, area))) return false
    for (let r = area.r0; r <= area.r1; r++)
      for (let c = area.c0; c <= area.c1; c++) {
        const cell = at.get(key(r, c))
        if (cell && !(cell.kind === 'folder' ? free(cell) : colorKey(cell) === color)) return false
      }
    return true
  }
  // Bloques del mismo color (vecinos arriba, abajo, izquierda y derecha), de más grande a más pequeño
  const seen = new Set<string>()
  const components: Cell[][] = []
  for (const start of words) {
    if (seen.has(start.id)) continue
    const comp = [start]
    seen.add(start.id)
    for (let k = 0; k < comp.length; k++)
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at.get(key(comp[k].row + dr, comp[k].col + dc))
        if (n && n.kind !== 'folder' && !seen.has(n.id) && free(n) && colorKey(n) === colorKey(start)) {
          seen.add(n.id)
          comp.push(n)
        }
      }
    components.push(comp)
  }
  components.sort((a, b) => b.length - a.length)
  for (const comp of components) {
    const color = colorKey(comp[0])
    const whole = bbox(comp)
    if (fits(whole, color)) {
      rects.push({ area: whole, color })
      continue
    }
    // No cabe como un solo rectángulo: un trozo por cada tramo seguido de cada columna
    for (const col of [...new Set(comp.map((c) => c.col))]) {
      const rows = comp.filter((c) => c.col === col).map((c) => c.row).sort((a, b) => a - b)
      let r0 = rows[0]
      rows.forEach((r, i) => {
        if (i === rows.length - 1 || rows[i + 1] !== r + 1) {
          const area = { r0, r1: r, c0: col, c1: col }
          if (fits(area, color)) rects.push({ area, color })
          r0 = rows[i + 1]
        }
      })
    }
  }
  // Carpetas sueltas pegadas a un grupo: el grupo crece para incluirlas, si sigue siendo válido
  for (const f of board.cells.filter((c) => c.kind === 'folder' && free(c))) {
    if (rects.some((r) => inside(r.area, f))) continue
    for (const r of rects) {
      if (r.folders || !r.color) continue
      const near = f.row >= r.area.r0 - 1 && f.row <= r.area.r1 + 1 && f.col >= r.area.c0 - 1 && f.col <= r.area.c1 + 1
      if (!near) continue
      const grown = bbox([f, { row: r.area.r0, col: r.area.c0 }, { row: r.area.r1, col: r.area.c1 }])
      if (fits(grown, r.color, r.area)) {
        r.area = grown
        break
      }
    }
  }
  rects.sort((a, b) => a.area.c0 - b.area.c0 || a.area.r0 - b.area.r0) // en el orden en que se leen
  const used = new Map<string, number>()
  return rects.map((r, i) => {
    const base = r.folders ? 'Carpetas' : (GROUP_NAMES[r.color!] ?? 'Grupo')
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    return { id: `auto-${i}`, name: n > 1 ? `${base} ${n}` : base, area: r.area, ...(r.color ? { color: r.color } : {}), ...(r.folders ? { folders: true } : {}) }
  })
}

/** Color con el que se ve una carpeta: el suyo, el de su grupo o el marrón */
export function groupColorAt(groups: Group[], cell: Pick<Cell, 'row' | 'col'>): Category | undefined {
  return groupAt(groups, cell.row, cell.col)?.color
}
