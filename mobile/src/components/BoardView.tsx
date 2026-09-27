import { useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { type Board, type Category, type Cell, CATEGORY_COLORS, type Zone, ZONE_LABELS, ZONE_ORDER } from '../shared'
import { useTapSurface } from '../tap'
import { colors } from '../theme'
import { CellView } from './CellView'

const ZONE_TINT: Record<Zone, Category> = { A: 'pronoun', B: 'verb', C: 'adjective', D: 'noun', E: 'social' }

interface Props {
  board: Board
  editing: boolean
  /** Uso: celda pulsada */
  onTapCell: (cell: Cell) => void
  /** Edición: casilla pulsada (con o sin celda) */
  onTapSlot?: (row: number, col: number, cell: Cell | undefined) => void
  movingId?: string | null
  onRenameZone?: (zone: Zone, name: string | null) => void
  gap?: number
}

export function BoardView({ board, editing, onTapCell, onTapSlot, movingId, onRenameZone, gap = 8 }: Props) {
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const [firedKey, setFiredKey] = useState<string | null>(null)
  const firedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Cuadrícula que ocupa todo el espacio disponible (100 % de ancho y alto)
  const cw = Math.max(0, (dims.w - gap * (board.cols - 1)) / board.cols)
  const ch = Math.max(0, (dims.h - gap * (board.rows - 1)) / board.rows)
  const ox = 0
  const oy = 0
  const byPos = useMemo(() => new Map(board.cells.map((c) => [`${c.row},${c.col}`, c])), [board.cells])

  /** Casilla bajo el dedo, calculada con la geometría (sin buscar vistas): rápido y exacto. */
  const slotAt = (px: number, py: number): { row: number; col: number } | null => {
    if (cw <= 0 || ch <= 0) return null
    const x = px - ox
    const y = py - oy
    const col = Math.floor(x / (cw + gap))
    const row = Math.floor(y / (ch + gap))
    if (col < 0 || row < 0 || col >= board.cols || row >= board.rows) return null
    // En el hueco entre celdas no hay objetivo
    if (x - col * (cw + gap) > cw || y - row * (ch + gap) > ch) return null
    return { row, col }
  }

  const handlers = useTapSurface<string>({
    guard: !editing,
    hitTest: (x, y) => {
      const s = slotAt(x, y)
      if (!s) return null
      if (editing) return `${s.row},${s.col}`
      const cell = byPos.get(`${s.row},${s.col}`)
      return cell && !cell.hidden ? cell.id : null
    },
    label: (key) => (editing ? key : (board.cells.find((c) => c.id === key)?.label ?? key)),
    onPressChange: setPressedKey,
    onFired: (key) => {
      setFiredKey(key)
      clearTimeout(firedTimer.current)
      firedTimer.current = setTimeout(() => setFiredKey(null), 300)
    },
    onTap: (key) => {
      if (editing) {
        const [row, col] = key.split(',').map(Number)
        onTapSlot?.(row, col, byPos.get(key))
        return
      }
      const cell = board.cells.find((c) => c.id === key)
      if (cell) onTapCell(cell)
    },
  })

  const pos = (row: number, col: number) => ({ left: ox + col * (cw + gap), top: oy + row * (ch + gap) })
  const visible = editing ? board.cells : board.cells.filter((c) => !c.hidden)

  const empties: { row: number; col: number }[] = []
  if (editing) {
    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++) if (!byPos.has(`${r},${c}`)) empties.push({ row: r, col: c })
  }
  const zoneAt = (col: number) => ZONE_ORDER.find((z) => board.zones[z][0] <= col && col <= board.zones[z][1])

  return (
    <View style={styles.wrap}>
      {editing && dims.w > 0 && (
        <View style={styles.headerRow}>
          {ZONE_ORDER.filter((z) => board.zones[z][1] >= board.zones[z][0]).map((z) => {
            const [s, e] = board.zones[z]
            const left = ox + s * (cw + gap)
            const width = (e - s + 1) * cw + (e - s) * gap
            return (
              <TextInput
                key={z}
                style={[styles.zoneName, { left, width, borderBottomColor: CATEGORY_COLORS[ZONE_TINT[z]].border }]}
                value={board.zoneLabels?.[z] ?? ZONE_LABELS[z]}
                placeholder={ZONE_LABELS[z]}
                onChangeText={(t) => onRenameZone?.(z, t)}
                onEndEditing={(e) => !e.nativeEvent.text.trim() && onRenameZone?.(z, null)}
                editable={!!onRenameZone}
                numberOfLines={1}
              />
            )
          })}
        </View>
      )}
      <View style={styles.surface} onLayout={(e) => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...handlers}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {dims.w > 0 &&
            visible.map((cell) => {
              const key = editing ? `${cell.row},${cell.col}` : cell.id
              return (
                <CellView
                  key={cell.id}
                  cell={cell}
                  {...pos(cell.row, cell.col)}
                  width={cw}
                  height={ch}
                  pressed={pressedKey === key}
                  fired={firedKey === key}
                  editing={editing}
                  selected={movingId === cell.id}
                />
              )
            })}
          {dims.w > 0 &&
            empties.map(({ row, col }) => {
              const z = zoneAt(col)
              const tint = z ? CATEGORY_COLORS[ZONE_TINT[z]] : undefined
              const key = `${row},${col}`
              return (
                <View
                  key={key}
                  style={[
                    styles.empty,
                    { ...pos(row, col), width: cw, height: ch, backgroundColor: tint?.bg, borderColor: tint?.border },
                    (movingId || pressedKey === key) && styles.emptyActive,
                  ]}
                >
                  {onTapSlot && <Text style={styles.plus}>+</Text>}
                </View>
              )
            })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  headerRow: { height: 30, marginBottom: 4 },
  zoneName: {
    position: 'absolute',
    top: 0,
    height: 28,
    borderBottomWidth: 3,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  surface: { flex: 1 },
  empty: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    opacity: 0.45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActive: { opacity: 0.85 },
  plus: { fontSize: 26, color: colors.muted },
})
