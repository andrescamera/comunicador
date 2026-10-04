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
  /** Texto que se ve, si no es la etiqueta (verbos conjugados según la frase) */
  displayLabel?: string
  /** Modo predictivo: no encaja ahora (atenuada, pero se puede tocar) */
  dimmed?: boolean
}

export function CellView({ cell, editing, onTap, editProps, selected, displayLabel, dimmed }: Props) {
  const { bg, border } = cellColors(cell.category, cell.kind)
  const style: CSSProperties = { background: bg, borderColor: border, gridRow: cell.row + 1, gridColumn: cell.col + 1 }
  const className = `cell cell-${cell.kind}${dimmed ? ' cell-dimmed' : ''}${cell.textOnly ? ' cell-text' : ''}${cell.hidden ? ' cell-hidden' : ''}${selected ? ' cell-selected' : ''}`
  const body = (
    <>
      {!cell.textOnly && <Picto id={cell.picto} alt={cell.label} />}
      <span className="cell-label">{displayLabel ?? cell.label}</span>
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
    <div className={className} style={style} data-tap data-label={cell.label} ref={tapRef(onTap)} role="button" aria-label={displayLabel ?? cell.label}>
      {body}
    </div>
  )
}
