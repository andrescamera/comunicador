import type { ButtonHTMLAttributes, CSSProperties } from 'react'
import { cellColors } from '../lib/colors'
import { tapRef } from '../lib/tap'
import type { Cell } from '../lib/types'
import { Picto } from './Picto'

interface Props {
  cell: Cell
  editing: boolean
  onTap: () => void
  /** Solo en edición: props del botón (clic, arrastrar y soltar) */
  editProps?: ButtonHTMLAttributes<HTMLButtonElement>
  selected?: boolean
}

export function CellView({ cell, editing, onTap, editProps, selected }: Props) {
  const { bg, border } = cellColors(cell.category, cell.kind)
  const style: CSSProperties = { background: bg, borderColor: border, gridRow: cell.row + 1, gridColumn: cell.col + 1 }
  const className = `cell cell-${cell.kind}${cell.hidden ? ' cell-hidden' : ''}${selected ? ' cell-selected' : ''}`
  const body = (
    <>
      <Picto id={cell.picto} alt={cell.label} />
      <span className="cell-label">{cell.label}</span>
      {editing && cell.hidden && <span className="cell-badge">oculta</span>}
    </>
  )
  if (editing) {
    return (
      <button type="button" className={`${className} cell-editing`} style={style} {...editProps}>
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
