import type { CSSProperties, DragEvent } from 'react'
import { CATEGORY_COLORS } from '../lib/colors'
import { type Area, groupAt, ZONE_LABELS, ZONE_ORDER, zoneLabel } from '../lib/layout'
import type { Board, Category, Cell, Group, Zone } from '../lib/types'
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
  /** Edición: cambiar el nombre de un grupo de columnas (null = volver al nombre por defecto) */
  onRenameZone?: (zone: Zone, name: string | null) => void
  /** Texto que se ve en una celda, si no es su etiqueta (verbos conjugados) */
  labelFor?: (cell: Cell) => string | null
  /** Modo predictivo: fichas atenuadas (no encajan ahora; siguen en su sitio y se pueden tocar) */
  dimFor?: (cell: Cell) => boolean
  /** Edición de una carpeta que se abre en la zona de carpetas: solo se puede colocar ahí */
  activeArea?: Area | null
  /** Grupos con los que se colorean las carpetas (y, si el tablero los tiene guardados, se dibujan al editar) */
  groups?: Group[]
}

function zoneAt(board: Board, col: number): Zone | undefined {
  return ZONE_ORDER.find((z) => board.zones[z][0] <= col && col <= board.zones[z][1])
}

export function BoardGrid({ board, editing, onTap, onEdit, onAddAt, movingId, onMoveTo, onRenameZone, labelFor, dimFor, activeArea, groups = [] }: Props) {
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
      {editing && !board.groups && (
        <div className="zone-header" style={{ gridTemplateColumns: gridStyle.gridTemplateColumns }}>
          {ZONE_ORDER.filter((z) => board.zones[z][1] >= board.zones[z][0]).map((z) => {
            const style = {
              gridColumn: `${board.zones[z][0] + 1} / ${board.zones[z][1] + 2}`,
              borderColor: CATEGORY_COLORS[ZONE_TINT[z]].border,
            }
            return onRenameZone ? (
              <input
                key={z}
                className="zone-name"
                style={style}
                value={board.zoneLabels?.[z] ?? ZONE_LABELS[z]}
                placeholder={ZONE_LABELS[z]}
                onChange={(e) => onRenameZone(z, e.target.value)}
                onBlur={(e) => !e.target.value.trim() && onRenameZone(z, null)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label={`Nombre del grupo: ${zoneLabel(board, z)}`}
                title="Pulsa para cambiar el nombre del grupo"
              />
            ) : (
              <span key={z} style={style} title={zoneLabel(board, z)}>
                {zoneLabel(board, z)}
              </span>
            )
          })}
        </div>
      )}
      <div className={`grid${editing && board.groups ? ' with-groups' : ''}`} style={gridStyle}>
        {visible.map((cell) => (
          <CellView
            key={cell.id}
            cell={cell}
            editing={editing}
            selected={movingId === cell.id}
            displayLabel={editing ? undefined : (labelFor?.(cell) ?? undefined)}
            dimmed={!editing && !!dimFor?.(cell)}
            groupColor={groupAt(groups, cell.row, cell.col)?.color}
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
          const g = board.groups ? groupAt(board.groups, row, col) : undefined
          const tint = board.groups ? (g?.color ? CATEGORY_COLORS[g.color] : undefined) : zone ? CATEGORY_COLORS[ZONE_TINT[zone]] : undefined
          const off = !!activeArea && (row < activeArea.r0 || row > activeArea.r1 || col < activeArea.c0 || col > activeArea.c1)
          if (off) return <div key={`${row},${col}`} className="slot-off" style={{ gridRow: row + 1, gridColumn: col + 1 }} aria-hidden />
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
        {editing &&
          board.groups?.map((g) => (
            <div
              key={g.id}
              className={`group-outline${g.folders ? ' group-folders' : ''}`}
              style={{
                gridRow: `${g.area.r0 + 1} / ${g.area.r1 + 2}`,
                gridColumn: `${g.area.c0 + 1} / ${g.area.c1 + 2}`,
                borderColor: g.color ? CATEGORY_COLORS[g.color].border : '#8d6e4a',
              }}
              aria-hidden
            >
              <span style={{ background: g.color ? CATEGORY_COLORS[g.color].border : '#8d6e4a' }}>{g.name}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
