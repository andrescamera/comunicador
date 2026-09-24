import { cellColors } from '../lib/colors'
import { tapRef } from '../lib/tap'
import type { Cell } from '../lib/types'
import { Picto } from './Picto'

interface Props {
  cell: Cell
  editing: boolean
  onTap: () => void
  onEdit: () => void
}

export function CellView({ cell, editing, onTap, onEdit }: Props) {
  const { bg, border } = cellColors(cell.category, cell.kind)
  const className = `cell cell-${cell.kind}`
  const style = { background: bg, borderColor: border }
  const body = (
    <>
      <Picto id={cell.picto} alt={cell.label} />
      <span className="cell-label">{cell.label}</span>
    </>
  )
  if (editing) {
    return (
      <button type="button" className={`${className} cell-editing`} style={style} onClick={onEdit}>
        {body}
      </button>
    )
  }
  return (
    <div className={className} style={style} data-tap data-label={cell.label} ref={tapRef(onTap)} role="button" aria-label={cell.label}>
      {body}
    </div>
  )
}
