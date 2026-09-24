import type { Board, Cell } from '../lib/types'
import { CellView } from './CellView'

interface Props {
  board: Board
  editing: boolean
  onTap: (cell: Cell) => void
  onEdit: (cell: Cell) => void
  onAdd?: () => void
}

export function BoardGrid({ board, editing, onTap, onEdit, onAdd }: Props) {
  const count = board.cells.length + (editing && onAdd ? 1 : 0)
  const rows = Math.max(1, Math.ceil(count / board.cols))
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {board.cells.map((cell) => (
        <CellView key={cell.id} cell={cell} editing={editing} onTap={() => onTap(cell)} onEdit={() => onEdit(cell)} />
      ))}
      {editing && onAdd && (
        <button type="button" className="cell cell-add" onClick={onAdd}>
          <span className="cell-add-plus">+</span>
          <span className="cell-label">Añadir</span>
        </button>
      )}
    </div>
  )
}
