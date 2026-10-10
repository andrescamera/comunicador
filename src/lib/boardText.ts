import { bestPicto } from './arasaac'
import { buildCell, isProperName } from './generator'
import { classify, normalizeText } from './grammar'
import { type Area, boardGroups, fillOrder, folderAreas, groupAt, groupSlots, insideArea } from './layout'
import type { Board, Category, Cell, Group, Library } from './types'
import { CATEGORY_LABELS, uid } from './types'

/**
 * Tablero escrito: el tablero entero (principal, carpetas y subcarpetas, con sus grupos) como texto.
 *
 *   # Inicio [7 filas, 11 columnas]
 *   @ Pronombre [filas 1-7, columna 1, color: pronombre]
 *   yo
 *   más
 *   	vosotros          ← más metido: dentro de la carpeta «más»
 *
 * Una ficha por línea; dentro de un grupo, el orden de las líneas es su posición («_» = hueco).
 * El lector es estricto: si algo no encaja, error con su número de línea y no se aplica nada.
 */

export interface TextError {
  line: number // desde 1
  message: string
}

// ---------- Texto → estructura ----------

type FolderColor = Category | 'folder'

interface TGroup {
  name: string
  line: number
  rect?: Area
  color?: FolderColor
  byRows?: boolean
  folders?: boolean
}

interface TCellOpts {
  folder?: boolean
  picto?: string
  textOnly?: boolean
  hidden?: boolean
  kind?: 'word' | 'phrase'
  category?: Category
  color?: FolderColor
  row?: number
  col?: number
}

type TItem =
  | { type: 'gap'; line: number; group: number }
  | { type: 'cell'; line: number; group: number; label: string; opts: TCellOpts; children?: TBoard }

interface TBoard {
  name: string
  line: number
  groups: TGroup[]
  items: TItem[]
}

export interface TDoc {
  root: TBoard
  size?: { rows: number; cols: number }
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const CATEGORY_BY_NAME: Record<string, Category> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([k, v]) => [fold(v), k as Category]),
)
const categoryName = (c: Category) => CATEGORY_LABELS[c].toLowerCase()
const colorName = (c: FolderColor) => (c === 'folder' ? 'carpeta' : categoryName(c))

const CELL_KEYS = ['carpeta', 'picto', 'solo texto', 'oculta', 'frase', 'palabra', 'categoria', 'color', 'fila', 'columna']
const GROUP_KEYS = ['filas', 'fila', 'columnas', 'columna', 'color', 'por filas', 'por columnas', 'carpetas']

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}
function unknownOption(key: string, known: string[]): string {
  const prefix = known.find((k) => key.startsWith(k) || k.startsWith(key))
  const best = prefix ?? [...known].sort((a, b) => distance(key, a) - distance(key, b))[0]
  const hint = best && (prefix || distance(key, best) <= Math.max(2, best.length / 2)) ? ` ¿Querías decir «${best}»?` : ''
  return `opción desconocida «${key}».${hint}`
}

/** «texto [a, b: c]» → texto y opciones */
function splitOptions(text: string): { body: string; options: string[] | null; bad?: string } {
  const m = text.match(/^(.*?)\s*\[([^[\]]*)\]\s*$/)
  if (!m) {
    if (/[[\]]/.test(text)) return { body: text, options: null, bad: 'corchetes sin cerrar o fuera de sitio (las opciones van al final: «texto [opción]»).' }
    return { body: text, options: null }
  }
  return { body: m[1].trim(), options: m[2].split(',').map((o) => o.trim()).filter(Boolean) }
}

/** «2-5» o «3» (desde 1) → [desde, hasta] desde 0 */
function parseRange(v: string): [number, number] | null {
  const m = v.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
  if (!m) return null
  const a = Number(m[1]), b = Number(m[2] ?? m[1])
  if (a < 1 || b < a) return null
  return [a - 1, b - 1]
}

function parseCategory(v: string): Category | null {
  return CATEGORY_BY_NAME[fold(v)] ?? null
}
function parseColor(v: string): FolderColor | null {
  return fold(v) === 'carpeta' ? 'folder' : parseCategory(v)
}

function parseGroupOptions(options: string[], err: (m: string) => void): Omit<TGroup, 'name' | 'line'> {
  const g: Omit<TGroup, 'name' | 'line'> = {}
  let rows: [number, number] | null = null
  let cols: [number, number] | null = null
  for (const raw of options) {
    const o = fold(raw)
    const m = o.match(/^(filas?|columnas?|color)\b\s*:?\s*(.+)$/)
    if (o === 'por filas') g.byRows = true
    else if (o === 'por columnas') g.byRows = false
    else if (o === 'carpetas') g.folders = true
    else if (m && m[1] === 'color') {
      const c = parseColor(m[2])
      if (c && c !== 'folder') g.color = c
      else if (!c) err(`color «${m[2]}» desconocido. Usa: ${Object.values(CATEGORY_LABELS).join(', ').toLowerCase()}.`)
    } else if (m) {
      const r = parseRange(m[2])
      if (!r) err(`«${raw}»: escribe un número o un rango, p. ej. «${m[1].startsWith('fila') ? 'filas 2-5' : 'columnas 4-5'}».`)
      else if (m[1].startsWith('fila')) rows = r
      else cols = r
    } else err(unknownOption(o.split(':')[0].trim(), GROUP_KEYS))
  }
  if (rows && cols) g.rect = { r0: rows[0], r1: rows[1], c0: cols[0], c1: cols[1] }
  else if (rows || cols) err('el grupo necesita filas y columnas, p. ej. «[filas 2-5, columnas 4-5]».')
  return g
}

function parseCellOptions(options: string[], err: (m: string) => void): TCellOpts {
  const o: TCellOpts = {}
  for (const raw of options) {
    const f = fold(raw)
    const m = f.match(/^(picto|categoria|color|fila|columna)\b\s*:?\s*(.+)$/)
    if (f === 'carpeta') o.folder = true
    else if (f === 'solo texto') o.textOnly = true
    else if (f === 'oculta' || f === 'oculto') o.hidden = true
    else if (f === 'frase') o.kind = 'phrase'
    else if (f === 'palabra') o.kind = 'word'
    else if (m && m[1] === 'picto') o.picto = raw.replace(/^\s*picto\s*:?\s*/i, '').trim()
    else if (m && m[1] === 'categoria') {
      const c = parseCategory(m[2])
      if (c) o.category = c
      else err(`categoría «${m[2]}» desconocida. Usa: ${Object.values(CATEGORY_LABELS).join(', ').toLowerCase()}.`)
    } else if (m && m[1] === 'color') {
      const c = parseColor(m[2])
      if (c) o.color = c
      else err(`color «${m[2]}» desconocido. Usa una categoría o «carpeta» (marrón).`)
    } else if (m) {
      const n = Number(m[2])
      if (!Number.isInteger(n) || n < 1) err(`«${raw}»: tiene que ser un número desde 1.`)
      else if (m[1] === 'fila') o.row = n - 1
      else o.col = n - 1
    } else err(unknownOption(f.split(':')[0].trim(), CELL_KEYS))
  }
  if ((o.row === undefined) !== (o.col === undefined)) err('la posición necesita fila y columna, p. ej. «[fila 7, columna 11]».')
  return o
}

/** Lee el texto. Solo comprueba la forma; lo que depende del tablero se comprueba al aplicar. */
export function parseBoardText(text: string): { doc: TDoc | null; errors: TextError[] } {
  const errors: TextError[] = []
  const lines = text.normalize('NFC').replace(/\r\n?/g, '\n').split('\n')
  let doc: TDoc | null = null
  let indentChar: '\t' | ' ' | null = null
  // Pila de niveles: sangría (en caracteres) y tablero de ese nivel
  type Level = { indent: number; board: TBoard; group: number }
  const stack: Level[] = []
  let lastCell: { item: Extract<TItem, { type: 'cell' }>; level: Level } | null = null

  lines.forEach((raw, i) => {
    const line = i + 1
    const err = (message: string) => errors.push({ line, message })
    const content = raw.replace(/\s+$/, '')
    const trimmed = content.trim()
    if (!trimmed || trimmed.startsWith('//')) return
    const indentStr = content.slice(0, content.length - content.trimStart().length)
    if (indentStr.includes('\t') && indentStr.includes(' ')) return err('mezcla tabuladores y espacios en la sangría; usa solo tabuladores.')
    if (indentStr) {
      const ch = indentStr[0] as '\t' | ' '
      if (indentChar && ch !== indentChar) return err('mezcla tabuladores y espacios en el texto; usa solo tabuladores.')
      indentChar = ch
    }
    const indent = indentStr.length

    // Cabecera: «# Nombre [7 filas, 11 columnas]»
    if (trimmed.startsWith('#')) {
      if (doc) return err('solo puede haber un tablero principal («# …»). Las carpetas se escriben dentro, con sangría.')
      if (indent) return err('el tablero principal («# …») va sin sangría.')
      const { body, options, bad } = splitOptions(trimmed.replace(/^#+\s*/, ''))
      if (bad) return err(bad)
      if (!body) return err('falta el nombre del tablero, p. ej. «# Inicio».')
      const root: TBoard = { name: body, line, groups: [], items: [] }
      doc = { root }
      let rows: number | undefined, cols: number | undefined
      for (const o of options ?? []) {
        const m = fold(o).match(/^(\d+)\s*(filas?|columnas?)$/)
        if (!m) err(`«${o}»: en el tablero principal solo va su tamaño, p. ej. «[7 filas, 11 columnas]».`)
        else if (m[2].startsWith('fila')) rows = Number(m[1])
        else cols = Number(m[1])
      }
      if (rows || cols) {
        if (!rows || !cols) err('el tamaño necesita filas y columnas, p. ej. «[7 filas, 11 columnas]».')
        else doc.size = { rows, cols }
      }
      stack.splice(0, stack.length, { indent: 0, board: root, group: -1 })
      lastCell = null
      return
    }
    if (!doc) return err('el texto tiene que empezar por el tablero principal, p. ej. «# Inicio».')

    // Nivel: igual que uno anterior, o uno nuevo dentro de la última ficha (que pasa a ser carpeta)
    const top = stack[stack.length - 1]
    if (indent > top.indent) {
      if (!lastCell || lastCell.level !== top) return err('esta línea está más metida, pero no va debajo de una ficha (solo el contenido de una carpeta va con sangría).')
      const folder: TBoard = { name: lastCell.item.label, line: lastCell.item.line, groups: [], items: [] }
      lastCell.item.children = folder
      stack.push({ indent, board: folder, group: -1 })
    } else if (indent < top.indent) {
      const at = stack.findIndex((l) => l.indent === indent)
      if (at < 0) return err('la sangría no coincide con ningún nivel anterior.')
      stack.splice(at + 1)
    }
    const level = stack[stack.length - 1]
    const board = level.board

    // Grupo: «@ Nombre [filas 2-5, columnas 4-5, …]» o «@ -» (fuera de grupos)
    if (trimmed.startsWith('@')) {
      lastCell = null
      const { body, options, bad } = splitOptions(trimmed.slice(1).trim())
      if (bad) return err(bad)
      if (body === '-' || body === '') {
        if (options?.length) err('«@ -» (fichas fuera de grupos) no lleva opciones.')
        level.group = -1
        return
      }
      if (board.groups.some((g) => fold(g.name) === fold(body))) return err(`el grupo «${body}» ya está definido en este tablero.`)
      board.groups.push({ name: body, line, ...parseGroupOptions(options ?? [], err) })
      level.group = board.groups.length - 1
      return
    }

    // Hueco
    if (/^_+$/.test(trimmed)) {
      lastCell = null
      board.items.push({ type: 'gap', line, group: level.group })
      return
    }

    // Ficha
    const { body, options, bad } = splitOptions(trimmed.replace(/^[-*•]\s+/, ''))
    if (bad) return err(bad)
    const label = normalizeText(body.replace(/^["“'](.+)["”']$/, '$1'))
    if (!label) return err('falta el texto de la ficha.')
    const item: Extract<TItem, { type: 'cell' }> = { type: 'cell', line, group: level.group, label, opts: parseCellOptions(options ?? [], err) }
    board.items.push(item)
    lastCell = { item, level }
  })
  if (!doc && !errors.length) errors.push({ line: 1, message: 'el texto está vacío. Empieza por el tablero principal, p. ej. «# Inicio».' })
  return { doc, errors }
}

// ---------- Tablero → texto ----------

export const TEXT_HEADER = '// Tablero escrito v1 · una ficha por línea · lo que va dentro de una carpeta, debajo y con un tabulador más'

const isFolderOf = (lib: Library, c: Cell) => c.kind === 'folder' && !!c.target && !!lib.boards[c.target]

function defaultKind(label: string): 'word' | 'phrase' {
  return label.split(/\s+/).length >= 3 ? 'phrase' : 'word'
}
function defaultCategory(label: string, kind: Cell['kind']): Category {
  return kind === 'phrase' ? 'social' : classify(label)
}

/** Zona en la que se llena el contenido sin grupo de cada tablero: la de carpetas o el tablero entero */
function streamArea(board: Board, zone: Area | undefined): Area {
  return board.inZone && zone ? zone : { r0: 0, c0: 0, r1: board.rows - 1, c1: board.cols - 1 }
}

export function boardToText(lib: Library): string {
  const root = lib.boards[lib.rootId]
  const zones = folderAreas(lib)
  const out = [TEXT_HEADER, `# ${root.name} [${root.rows} filas, ${root.cols} columnas]`]
  const seen = new Set<string>([lib.rootId])

  const cellLine = (c: Cell, depth: number, groupColor: Category | undefined) => {
    const opts: string[] = []
    const folder = isFolderOf(lib, c)
    if (folder) {
      const sub = lib.boards[c.target!]
      if (!sub.cells.length) opts.push('carpeta')
      if (c.folderColor && c.folderColor !== groupColor) opts.push(`color: ${colorName(c.folderColor)}`)
    } else {
      const kind = c.kind === 'phrase' ? 'phrase' : 'word'
      if (kind !== defaultKind(c.label)) opts.push(kind === 'phrase' ? 'frase' : 'palabra')
      if (c.category !== defaultCategory(c.label, kind)) opts.push(`categoría: ${categoryName(c.category)}`)
      if (c.textOnly) opts.push('solo texto')
    }
    if (c.hidden) opts.push('oculta')
    out.push('\t'.repeat(depth) + c.label + (opts.length ? ` [${opts.join(', ')}]` : ''))
    if (folder && !seen.has(c.target!)) {
      seen.add(c.target!)
      writeBoard(lib.boards[c.target!], depth + 1, false)
    }
  }

  const writeSlots = (b: Board, slots: { row: number; col: number }[], depth: number, groupColor: Category | undefined) => {
    const at = new Map(b.cells.map((c) => [`${c.row},${c.col}`, c]))
    const cells = slots.map((s) => at.get(`${s.row},${s.col}`))
    const last = cells.reduce((k, c, i) => (c ? i : k), -1)
    cells.slice(0, last + 1).forEach((c) => (c ? cellLine(c, depth, groupColor) : out.push('\t'.repeat(depth) + '_')))
  }

  function writeBoard(b: Board, depth: number, isRoot: boolean) {
    const pad = '\t'.repeat(depth)
    const groups = boardGroups(b, isRoot)
    const area = streamArea(b, zones.get(b.id))
    const inGroup = (s: { row: number; col: number }) => !!groupAt(groups, s.row, s.col)
    const withPosition = (c: Cell) => {
      const before = out.length
      cellLine(c, depth, undefined)
      out[before] = out[before].replace(/( \[(.*)\])?$/, (_m, _a, inner) => ` [${inner ? `${inner}, ` : ''}fila ${c.row + 1}, columna ${c.col + 1}]`)
    }
    if (isRoot) {
      // En el principal, las fichas sueltas (fuera de grupos) llevan su casilla
      for (const c of [...b.cells].sort((x, y) => x.col - y.col || x.row - y.row)) if (!inGroup(c)) withPosition(c)
    } else {
      // En una carpeta, lo que no está en un grupo llena su zona por orden (con «_» en los huecos)
      writeSlots(b, fillOrder(area).filter((s) => !inGroup(s)), depth, undefined)
      for (const c of b.cells) if (!insideArea(area, c.row, c.col) && !inGroup(c)) withPosition(c)
    }
    for (const g of groups) {
      const opts = [rangeText('fila', g.area.r0, g.area.r1), rangeText('columna', g.area.c0, g.area.c1)]
      if (g.color) opts.push(`color: ${categoryName(g.color)}`)
      if (g.byRows) opts.push('por filas')
      if (g.folders) opts.push('carpetas')
      out.push('', `${pad}@ ${g.name} [${opts.join(', ')}]`)
      writeSlots(b, groupSlots(g), depth, g.color)
    }
  }
  writeBoard(root, 0, true)
  return out.join('\n') + '\n'
}

const rangeText = (what: 'fila' | 'columna', a: number, b: number) => (a === b ? `${what} ${a + 1}` : `${what}s ${a + 1}-${b + 1}`)

// ---------- Aplicar ----------

export interface BoardChange {
  path: string // «Inicio», «Inicio › más › otros»
  added: string[]
  removed: string[]
  changed: string[]
  moved: number
  groups: string[] // «+ Social», «− Nombres», «Social: rectángulo»
  removedFolders: { label: string; cells: number; folders: number }[]
}

export interface PictoJob {
  boardId: string
  cellId: string
  query: string
  exact: boolean // el texto de [picto: …]: buscar ese; si no, el de la ficha
  folder: boolean
  kind: Cell['kind']
  categoryGiven: boolean
}

export interface TextPlan {
  errors: TextError[]
  lib: Library | null
  changes: BoardChange[]
  jobs: PictoJob[]
}

const key = (r: number, c: number) => `${r},${c}`
const groupKey = (g: Group) => [g.area.r0, g.area.c0, g.area.r1, g.area.c1, g.color ?? '', !!g.byRows, !!g.folders].join('|')

/**
 * Compara el texto con el tablero y prepara el resultado (sin pictogramas nuevos todavía).
 * Lo que ya existe conserva su id, pictograma y color; el texto manda en posiciones y opciones.
 */
export function planBoardText(lib: Library, doc: TDoc): TextPlan {
  const errors: TextError[] = []
  const jobs: PictoJob[] = []
  const changes: BoardChange[] = []
  const oldRoot = lib.boards[lib.rootId]
  const rows = doc.size?.rows ?? oldRoot.rows
  const cols = doc.size?.cols ?? oldRoot.cols
  const boards: Record<string, Board> = {}
  const used = new Set<string>()

  // Grupos nuevos (con rectángulo) o los que ya existían con ese nombre («@ Nombre» a secas: tal cual)
  function buildGroups(t: TBoard, old: Board | undefined, isRoot: boolean, zone: Area | undefined): Group[] {
    const oldGroups = old ? boardGroups(old, isRoot) : []
    const groups: Group[] = []
    for (const tg of t.groups) {
      const err = (message: string) => errors.push({ line: tg.line, message })
      const prev = oldGroups.find((g) => fold(g.name) === fold(tg.name))
      const inherit = !tg.rect && prev
      const area = tg.rect ?? prev?.area
      if (!area) {
        err(`el grupo «${tg.name}» es nuevo: escribe dónde va, p. ej. «@ ${tg.name} [filas 2-5, columnas 4-5]».`)
        continue
      }
      if (area.r1 >= rows || area.c1 >= cols) err(`«${tg.name}» se sale del tablero (${rows} filas, ${cols} columnas).`)
      else if (zone && !(insideArea(zone, area.r0, area.c0) && insideArea(zone, area.r1, area.c1)))
        err(`«${tg.name}» se sale de la zona de carpetas en la que se abre esta carpeta (${rangeText('fila', zone.r0, zone.r1)}, ${rangeText('columna', zone.c0, zone.c1)}).`)
      const clash = groups.find((g) => g.area.r0 <= area.r1 && area.r0 <= g.area.r1 && g.area.c0 <= area.c1 && area.c0 <= g.area.c1)
      if (clash) err(`«${tg.name}» se solapa con «${clash.name}».`)
      const g: Group = { id: prev && !/^(zona|carpetas)-/.test(prev.id) ? prev.id : uid('g'), name: tg.name, area }
      const color = tg.color ?? (inherit ? prev.color : undefined)
      if (color && color !== 'folder') g.color = color
      if (tg.byRows ?? (inherit ? prev.byRows : false)) g.byRows = true
      if (tg.folders ?? (inherit ? prev.folders : false)) g.folders = true
      groups.push(g)
    }
    return groups
  }

  const areaSize = (a: Area) => (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1)
  const streamCount = (t: TBoard) => t.items.filter((it) => it.group < 0 && !(it.type === 'cell' && it.opts.row !== undefined)).length

  function buildBoard(t: TBoard, old: Board | undefined, path: string, isRoot: boolean, zone: Area | undefined): Board {
    const id = old?.id ?? uid('b')
    used.add(id)
    const groups = buildGroups(t, old, isRoot, zone)
    const area: Area = zone ?? { r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 }
    // Lo que ya existía, por su texto (si se repite, en orden)
    const oldByLabel = new Map<string, Cell[]>()
    for (const c of old?.cells ?? []) oldByLabel.set(fold(c.label), [...(oldByLabel.get(fold(c.label)) ?? []), c])
    const kept = new Set<string>()
    const taken = new Map<string, number>() // casilla → línea que la ocupa
    const cells: Cell[] = []
    const change: BoardChange = { path, added: [], removed: [], changed: [], moved: 0, groups: [], removedFolders: [] }
    changes.push(change)

    // 1) Fichas con posición propia
    const slotOf = new Map<TItem, { row: number; col: number }>()
    for (const it of t.items) {
      if (it.type !== 'cell' || it.opts.row === undefined) continue
      const row = it.opts.row, col = it.opts.col!
      const err = (message: string) => errors.push({ line: it.line, message })
      const g = groupAt(groups, row, col)
      if (it.group >= 0) err('una ficha dentro de un grupo no lleva posición: la da su orden en el grupo.')
      else if (row >= rows || col >= cols) err(`fila ${row + 1}, columna ${col + 1} está fuera del tablero (${rows} × ${cols}).`)
      else if (!insideArea(area, row, col)) err('esta casilla queda fuera de la zona de carpetas en la que se abre esta carpeta.')
      else if (g) err(`fila ${row + 1}, columna ${col + 1} es del grupo «${g.name}»: escribe la ficha dentro del grupo.`)
      else if (taken.has(key(row, col))) err(`fila ${row + 1}, columna ${col + 1} ya está ocupada (línea ${taken.get(key(row, col))}).`)
      else {
        taken.set(key(row, col), it.line)
        slotOf.set(it, { row, col })
      }
    }

    // 2) El resto, por orden: en su grupo o, sin grupo, en las casillas libres de su zona
    const queues = new Map<number, { row: number; col: number }[]>()
    queues.set(-1, fillOrder(area).filter((s) => !groupAt(groups, s.row, s.col) && !taken.has(key(s.row, s.col))))
    t.groups.forEach((tg, i) => {
      const g = groups.find((x) => x.name === tg.name)
      queues.set(i, g ? groupSlots(g) : [])
    })
    const ordered = t.items.filter((it) => !(it.type === 'cell' && it.opts.row !== undefined))
    for (const [gi, q] of queues) {
      const mine = ordered.filter((it) => it.group === gi)
      const tg = t.groups[gi]
      if (gi >= 0 && !groups.some((x) => x.name === tg.name)) continue // el grupo ya tiene su error
      // los huecos del final no cuentan
      const lastCell = mine.map((it) => it.type).lastIndexOf('cell')
      const n = lastCell + 1
      if (n > q.length)
        errors.push({
          line: mine[n - 1].line,
          message:
            gi >= 0
              ? `«${tg.name}» tiene ${q.length} casillas y hay ${n} líneas (fichas y huecos).`
              : zone
                ? `en la zona de carpetas caben ${q.length} y hay ${n} líneas (fichas y huecos).`
                : `fuera de grupos quedan ${q.length} casillas libres y hay ${n} líneas (fichas y huecos).`,
        })
      mine.forEach((it, i) => q[i] && slotOf.set(it, q[i]))
    }

    // Emparejar con lo que ya existía: primero misma ficha en la misma casilla (por si se repite), luego en orden
    const matchOf = new Map<TItem, Cell>()
    const cellItems = t.items.filter((it): it is Extract<TItem, { type: 'cell' }> => it.type === 'cell' && slotOf.has(it))
    for (const exactPass of [true, false])
      for (const it of cellItems) {
        if (matchOf.has(it)) continue
        const slot = slotOf.get(it)!
        const prev = oldByLabel.get(fold(it.label))?.find((c) => !kept.has(c.id) && (!exactPass || (c.row === slot.row && c.col === slot.col)))
        if (prev) {
          kept.add(prev.id)
          matchOf.set(it, prev)
        }
      }

    for (const it of t.items) {
      const slot = slotOf.get(it)
      if (it.type === 'gap' || !slot) continue
      const prev = matchOf.get(it)
      const err = (message: string) => errors.push({ line: it.line, message })
      const isFolder = !!it.children || !!it.opts.folder
      if (!isFolder && it.opts.color) err('«color» es para carpetas. Para una ficha, usa «categoría».')
      if (isFolder && (it.opts.kind || it.opts.textOnly || it.opts.category)) err('una carpeta no lleva «frase», «palabra», «solo texto» ni «categoría».')
      if (it.opts.folder && it.children) err('«carpeta» es para una carpeta vacía; esta ya tiene contenido debajo.')

      const groupColor = groupAt(groups, slot.row, slot.col)?.color
      let cell: Cell
      if (isFolder) {
        const prevBoard = prev && isFolderOf(lib, prev) ? lib.boards[prev.target!] : undefined
        const children = it.children ?? { name: it.label, line: it.line, groups: [], items: [] }
        // Se abre en la zona de carpetas si está en ella (y su contenido sin grupos cabe; si no, a pantalla completa, por páginas)
        let childZone = isRoot ? groups.find((g) => g.folders && insideArea(g.area, slot.row, slot.col))?.area : zone
        if (childZone && !children.groups.length && streamCount(children) > areaSize(childZone)) childZone = undefined
        const sub = buildBoard(children, prevBoard, `${path} › ${it.label}`, false, childZone)
        cell = { ...(prev?.kind === 'folder' ? prev : {}), id: prev?.id ?? uid('c'), kind: 'folder', label: it.label, category: prev?.category ?? 'misc', picto: prev?.picto, target: sub.id, row: slot.row, col: slot.col }
        delete cell.textOnly
        if (it.opts.color) cell.folderColor = it.opts.color
        else delete cell.folderColor
        if (!prev || prev.kind !== 'folder' || it.opts.picto)
          jobs.push({ boardId: id, cellId: cell.id, query: it.opts.picto ?? it.label, exact: !!it.opts.picto, folder: true, kind: 'folder', categoryGiven: true })
      } else {
        const kind = it.opts.kind ?? defaultKind(it.label)
        const fresh = !prev || prev.kind === 'folder'
        // Lo nuevo sin categoría escrita: la que diga ARASAAC al buscar su pictograma
        const category = it.opts.category ?? defaultCategory(it.label, kind)
        cell = { ...(fresh ? {} : prev), id: prev?.id ?? uid('c'), kind, label: it.label, category, picto: fresh ? undefined : prev.picto, row: slot.row, col: slot.col }
        delete cell.target
        delete cell.folderColor
        if (it.opts.textOnly) cell.textOnly = true
        else delete cell.textOnly
        if (fresh || it.opts.picto)
          jobs.push({ boardId: id, cellId: cell.id, query: it.opts.picto ?? it.label, exact: !!it.opts.picto, folder: false, kind, categoryGiven: !!it.opts.category || !fresh })
      }
      if (it.opts.hidden) cell.hidden = true
      else delete cell.hidden
      if (!cell.picto) delete cell.picto
      cells.push(cell)

      // Resumen
      if (!prev) change.added.push(it.label)
      else {
        if (prev.row !== cell.row || prev.col !== cell.col) change.moved++
        const prevGroupColor = old ? groupAt(boardGroups(old, isRoot), prev.row, prev.col)?.color : undefined
        const look = (c: Cell, gc: Category | undefined) =>
          JSON.stringify([c.label, c.kind, c.category, !!c.textOnly, !!c.hidden, c.kind === 'folder' ? (c.folderColor ?? gc ?? 'folder') : ''])
        if (look(cell, groupColor) !== look(prev, prevGroupColor) || it.opts.picto) change.changed.push(it.label)
      }
    }

    // Lo que se quita
    for (const c of old?.cells ?? []) {
      if (kept.has(c.id)) continue
      change.removed.push(c.label)
      if (isFolderOf(lib, c)) change.removedFolders.push({ label: c.label, ...countContents(lib, c.target!) })
    }
    // Grupos
    const before = old ? boardGroups(old, isRoot) : []
    for (const g of groups) {
      const p = before.find((x) => fold(x.name) === fold(g.name))
      if (!p) change.groups.push(`+ ${g.name}`)
      else if (groupKey(p) !== groupKey(g)) change.groups.push(`${g.name}: cambia`)
    }
    for (const p of before) if (!groups.some((g) => fold(g.name) === fold(p.name))) change.groups.push(`− ${p.name}`)

    const board: Board = { ...(old ?? { zones: oldRoot.zones }), id, name: t.name, rows, cols, cells, groups }
    if (zone) board.inZone = true
    else delete board.inZone
    boards[id] = board
    return board
  }

  const root = buildBoard(doc.root, oldRoot, doc.root.name, true, undefined)

  // Lo que no está en el texto (Charla rápida, tableros sueltos) se queda como está, si cabe
  for (const [id, b] of Object.entries(lib.boards)) {
    if (used.has(id) || isReachableRemoved(lib, id, used)) continue
    if (b.cells.some((c) => c.row >= rows || c.col >= cols))
      errors.push({ line: 1, message: `con ${rows} filas y ${cols} columnas no cabe «${b.name}»: tiene fichas más allá.` })
    boards[id] = { ...b, rows, cols }
  }
  if (errors.length) return { errors: dedupe(errors), lib: null, changes, jobs }
  return {
    errors: [],
    lib: { ...lib, rootId: root.id, boards },
    changes: changes.filter((c) => c.added.length || c.removed.length || c.changed.length || c.moved || c.groups.length),
    jobs,
  }
}

function dedupe(errors: TextError[]): TextError[] {
  const seen = new Set<string>()
  return errors.filter((e) => (seen.has(`${e.line}${e.message}`) ? false : (seen.add(`${e.line}${e.message}`), true))).sort((a, b) => a.line - b.line)
}

/** Tableros que eran carpetas (alcanzables desde el principal) y ya no están en el texto: se borran */
function isReachableRemoved(lib: Library, id: string, used: Set<string>): boolean {
  return reachable(lib).has(id) && !used.has(id)
}
const reachableCache = new WeakMap<Library, Set<string>>()
function reachable(lib: Library): Set<string> {
  let out = reachableCache.get(lib)
  if (out) return out
  out = new Set<string>()
  const queue = [lib.rootId]
  while (queue.length) {
    const id = queue.shift()!
    if (out.has(id) || !lib.boards[id]) continue
    out.add(id)
    for (const c of lib.boards[id].cells) if (c.kind === 'folder' && c.target) queue.push(c.target)
  }
  reachableCache.set(lib, out)
  return out
}

function countContents(lib: Library, id: string, seen = new Set<string>()): { cells: number; folders: number } {
  if (seen.has(id) || !lib.boards[id]) return { cells: 0, folders: 0 }
  seen.add(id)
  let cells = 0, folders = 0
  for (const c of lib.boards[id].cells) {
    if (c.kind === 'folder' && c.target && lib.boards[c.target]) {
      folders++
      const n = countContents(lib, c.target, seen)
      cells += n.cells
      folders += n.folders
    } else cells++
  }
  return { cells, folders }
}

/** Busca los pictogramas de lo nuevo (y de lo que pide otro con [picto: …]) */
export async function resolvePictos(lib: Library, jobs: PictoJob[], onProgress?: (done: number, total: number) => void): Promise<Library> {
  const boards = { ...lib.boards }
  let done = 0
  const one = async (job: PictoJob) => {
    let picto: number | undefined
    let category: Category | undefined
    if (/^\d+$/.test(job.query)) picto = Number(job.query)
    else if (job.exact || job.folder) picto = (await bestPicto(job.folder ? job.query.toLowerCase() : job.query))?.id
    else {
      const c = await buildCell({ label: job.query, kind: job.kind === 'phrase' ? 'phrase' : 'word', proper: job.kind === 'word' && isProperName(job.query) })
      picto = c.picto
      category = c.category
    }
    const b = boards[job.boardId]
    boards[job.boardId] = {
      ...b,
      cells: b.cells.map((c) => {
        if (c.id !== job.cellId) return c
        const next = { ...c, picto: picto ?? c.picto }
        if (job.folder && !next.picto) {
          const sub = c.target ? boards[c.target] : undefined
          next.picto = (sub?.cells.find((x) => x.picto && x.category === 'noun') ?? sub?.cells.find((x) => x.picto))?.picto
        }
        if (category && !job.categoryGiven) next.category = category
        if (!next.picto) delete next.picto
        return next
      }),
    }
    onProgress?.(++done, jobs.length)
  }
  // Primero las fichas (en paralelo); luego las carpetas, de dentro afuera: sin pictograma propio,
  // toman el de su contenido
  const cellsJobs = jobs.filter((j) => !j.folder)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(6, cellsJobs.length) }, async () => {
      while (next < cellsJobs.length) await one(cellsJobs[next++])
    }),
  )
  for (const job of jobs.filter((j) => j.folder)) await one(job)
  return { ...lib, boards }
}
