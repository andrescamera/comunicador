import { useState } from 'react'
import { CATEGORY_COLORS, FOLDER_COLORS } from '../lib/colors'
import type { Area } from '../lib/layout'
import type { Group } from '../lib/types'

interface Props {
  rows: number
  cols: number
  groups: Group[]
  /** Dónde está la carpeta (se marca en el mapa) */
  at: { row: number; col: number }
  value: Area | undefined
  onChange: (area: Area | undefined) => void
}

const range = (what: string, a: number, b: number) => (a === b ? `${what} ${a + 1}` : `${what}s ${a + 1}-${b + 1}`)

/**
 * Dónde se abre una carpeta del principal (un «más»): en la zona de carpetas o en una zona propia,
 * que se elige pulsando una esquina y luego la opuesta en el mapa del tablero.
 */
export function ExpansionPicker({ rows, cols, groups, at, value, onChange }: Props) {
  const [first, setFirst] = useState<{ row: number; col: number } | null>(null)
  const own = !!value
  const pick = (row: number, col: number) => {
    if (!first) return setFirst({ row, col })
    onChange({ r0: Math.min(first.row, row), r1: Math.max(first.row, row), c0: Math.min(first.col, col), c1: Math.max(first.col, col) })
    setFirst(null)
  }
  const span = (a: Area) => ({ gridRow: `${a.r0 + 1} / ${a.r1 + 2}`, gridColumn: `${a.c0 + 1} / ${a.c1 + 2}` })
  return (
    <fieldset className="expansion-picker">
      <legend>Dónde se abre su contenido</legend>
      <label className="check">
        <input type="radio" checked={!own} onChange={() => (onChange(undefined), setFirst(null))} />
        En la zona de carpetas
      </label>
      <label className="check">
        <input type="radio" checked={own} onChange={() => !own && onChange({ r0: 0, r1: rows - 1, c0: Math.min(cols - 1, at.col + 1), c1: cols - 1 })} />
        En una zona de ampliación propia (tapa lo que haya debajo mientras está abierta)
      </label>
      {own && (
        <>
          <p className="muted">
            {first ? 'Ahora pulsa la esquina opuesta.' : 'Pulsa una esquina de la zona y luego la opuesta.'}{' '}
            <strong>{value && `${range('fila', value.r0, value.r1)}, ${range('columna', value.c0, value.c1)}`}</strong>
          </p>
          <div className="board-map-grid expansion-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, aspectRatio: `${cols} / ${rows}` }}>
            {Array.from({ length: rows * cols }, (_, i) => {
              const row = Math.floor(i / cols), col = i % cols
              const isAt = row === at.row && col === at.col
              const isFirst = first && first.row === row && first.col === col
              return (
                <button
                  key={i}
                  type="button"
                  className={`board-map-slot pick${isAt ? ' here' : ''}${isFirst ? ' first' : ''}`}
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  onClick={() => pick(row, col)}
                  title={isAt ? 'Aquí está la carpeta' : `Fila ${row + 1}, columna ${col + 1}`}
                  aria-label={`Fila ${row + 1}, columna ${col + 1}`}
                />
              )
            })}
            {groups.map((g) => (
              <span key={g.id} className="board-map-group" style={{ ...span(g.area), borderColor: (g.color ? CATEGORY_COLORS[g.color] : FOLDER_COLORS).border }} />
            ))}
            {value && <span className="board-map-group current expansion-area" style={span(value)} />}
          </div>
        </>
      )}
    </fieldset>
  )
}
