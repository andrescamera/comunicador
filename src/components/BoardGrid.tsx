import type { CSSProperties, DragEvent } from 'react'
import { CATEGORY_COLORS } from '../lib/colors'
import { ZONE_LABELS, ZONE_ORDER } from '../lib/layout'
import type { Board, Category, Cell, Zone } from '../lib/types'
import { CellView } from './CellView'

const ZONE_TINT: Record<Zone, Category> = { A: 'pronoun', B: 'verb', C: 'adjective', D: 'noun', E: 'social' }

interface Props {
  board: Board
  editing: boolean
  onTap: (cell: Cell) => void
  onEdit: (cell: Cell) => void
  /** Edición: crear una celda en una casilla vacía */
  onAddAt?: (row: number, col: number) => void
  /** Edición: celda seleccionada para moverla con clic en el destino */
  movingId?: string | null
  onMoveTo?: (id: string, row: number, col: number) => void
}

function zoneAt(board: Board, col: number): Zone | undefined {
  return ZONE_ORDER.find((z) => board.zones[z][0] <= col && col <= board.zones[z][1])
}

export function BoardGrid({ board, editing, onTap, onEdit, onAddAt, movingId, onMoveTo }: Props) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${board.rows}, minmax(0, 1fr))`,
  }

  const dropProps = (row: number, col: number) =>
    onMoveTo
      ? {
          onDragOver: (e: DragEvent) => e.preventDefault(),
          onDrop: (e: DragEvent) => {
            e.preventDefault()
            const id = e.dataTransfer.getData('text/plain')
            if (id) onMoveTo(id, row, col)
          },
        }
      : {}

  const visible = editing ? board.cells : board.cells.filter((c) => !c.hidden)
  const occupied = new Set(board.cells.map((c) => `${c.row},${c.col}`))
  const empties: { row: number; col: number }[] = []
  if (editing) {
    for (let r = 0; r < board.rows; r++)
      for (let c = 0; c < board.cols; c++) if (!occupied.has(`${r},${c}`)) empties.push({ row: r, col: c })
  }

  return (
    <div className="grid-wrap" style={{ '--rows': board.rows, '--cols': board.cols } as CSSProperties}>
      {editing && (
        <div className="zone-header" style={{ gridTemplateColumns: gridStyle.gridTemplateColumns }}>
          {ZONE_ORDER.filter((z) => board.zones[z][1] >= board.zones[z][0]).map((z) => (
            <span
              key={z}
              style={{
                gridColumn: `${board.zones[z][0] + 1} / ${board.zones[z][1] + 2}`,
                borderColor: CATEGORY_COLORS[ZONE_TINT[z]].border,
              }}
              title={ZONE_LABELS[z]}
            >
              {ZONE_LABELS[z]}
            </span>
          ))}
        </div>
      )}
      <div className="grid" style={gridStyle}>
        {visible.map((cell) => (
          <CellView
            key={cell.id}
            cell={cell}
            editing={editing}
            selected={movingId === cell.id}
            onTap={() => onTap(cell)}
            editProps={{
              onClick: () => (movingId && onMoveTo ? onMoveTo(movingId, cell.row, cell.col) : onEdit(cell)),
              draggable: !!onMoveTo,
              onDragStart: (e) => e.dataTransfer.setData('text/plain', cell.id),
              ...dropProps(cell.row, cell.col),
            }}
          />
        ))}
        {empties.map(({ row, col }) => {
          const zone = zoneAt(board, col)
          const tint = zone ? CATEGORY_COLORS[ZONE_TINT[zone]] : undefined
          return (
            <button
              key={`${row},${col}`}
              type="button"
              className={`slot-empty ${movingId ? 'slot-target' : ''}`}
              style={{ gridRow: row + 1, gridColumn: col + 1, background: tint?.bg, borderColor: tint?.border }}
              disabled={!onAddAt && !movingId}
              onClick={() => (movingId && onMoveTo ? onMoveTo(movingId, row, col) : onAddAt?.(row, col))}
              aria-label={movingId ? 'Mover aquí' : 'Añadir celda aquí'}
              {...dropProps(row, col)}
            >
              {onAddAt || movingId ? '+' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
