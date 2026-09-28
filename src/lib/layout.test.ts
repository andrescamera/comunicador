import { describe, expect, it } from 'vitest'
import { classify } from './grammar'
import { computeZones, layoutAt, layoutCells, moveCellTo, type NewCell, pickSize, placeCell, resizeBoard, zoneOf } from './layout'
import type { Board } from './types'

let n = 0
const word = (label: string): NewCell => ({ id: `c${++n}`, kind: 'word', label, category: classify(label) })
const board = (labels: string[], size?: { rows: number; cols: number }): Board => ({
  id: 'b',
  name: 'test',
  ...layoutCells(labels.map(word), size),
})
const at = (b: Board, label: string) => {
  const c = b.cells.find((x) => x.label === label)!
  return [c.row, c.col]
}

describe('layout', () => {
  it('puts each category in its own block of columns, left to right', () => {
    const b = board(['yo', 'tú', 'querer', 'ir', 'no', 'grande', 'agua', 'pan', 'hola'], { rows: 2, cols: 10 })
    const col = (label: string) => at(b, label)[1]
    expect(col('yo')).toBeLessThan(col('querer'))
    expect(col('querer')).toBeLessThan(col('no'))
    expect(col('no')).toBeLessThan(col('agua'))
    expect(col('agua')).toBeLessThan(col('hola'))
    // Todas las celdas de una zona quedan dentro de su rango de columnas
    for (const c of b.cells) {
      const [s, e] = b.zones[zoneOf(c)]
      expect(c.col).toBeGreaterThanOrEqual(s)
      expect(c.col).toBeLessThanOrEqual(e)
    }
  })

  it('fills each zone top to bottom, column by column', () => {
    const b = board(['comer', 'beber', 'dormir', 'cocinar', 'jugar'], { rows: 3, cols: 4 })
    const [s] = b.zones.B
    expect(at(b, 'comer')).toEqual([0, s])
    expect(at(b, 'beber')).toEqual([1, s])
    expect(at(b, 'dormir')).toEqual([2, s])
    expect(at(b, 'cocinar')).toEqual([0, s + 1])
  })

  it('never moves existing cells when adding new ones', () => {
    const b = board(['yo', 'querer', 'agua', 'hola'], { rows: 4, cols: 8 })
    const before = new Map(b.cells.map((c) => [c.id, [c.row, c.col]]))
    const after = ['comer', 'pan', 'tú', 'no', 'leche', 'beber'].reduce((acc, l) => placeCell(acc, word(l)), b)
    for (const c of after.cells.filter((x) => before.has(x.id))) expect([c.row, c.col]).toEqual(before.get(c.id))
    // y las nuevas caen en la zona de su categoría
    expect(zoneOf(after.cells.find((c) => c.label === 'comer')!)).toBe('B')
    const [s, e] = after.zones.B
    const comer = after.cells.find((c) => c.label === 'comer')!
    expect(comer.col >= s && comer.col <= e).toBe(true)
  })

  it('never puts two cells in the same slot, and grows a row when full', () => {
    const b = board(['yo', 'tú', 'él', 'ella'], { rows: 1, cols: 4 })
    const full = placeCell(b, word('nosotros'))
    expect(full.rows).toBe(2)
    const slots = full.cells.map((c) => `${c.row},${c.col}`)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('reserves free slots for growth', () => {
    const labels = ['yo', 'tú', 'querer', 'ir', 'comer', 'no', 'más', 'agua', 'pan', 'hola', 'sí', 'gracias']
    const size = pickSize(labels.map(word))
    expect(size.rows * size.cols).toBeGreaterThanOrEqual(labels.length * 1.25)
  })

  it('swaps cells when moving onto an occupied slot', () => {
    const b = board(['yo', 'querer'], { rows: 2, cols: 4 })
    const [r1, c1] = at(b, 'yo')
    const [r2, c2] = at(b, 'querer')
    const moved = moveCellTo(b, b.cells.find((c) => c.label === 'yo')!.id, r2, c2)
    expect(at(moved, 'yo')).toEqual([r2, c2])
    expect(at(moved, 'querer')).toEqual([r1, c1])
  })

  it('refuses to shrink when there is no empty column or row left', () => {
    const b = board(['yo', 'querer', 'agua', 'hola'], { rows: 2, cols: 5 })
    expect(resizeBoard(b, 2, 1)).toBeNull()
    expect(resizeBoard(b, 3, 6)?.cols).toBe(6)
  })

  it('removes an empty column in the middle, shifting the cells on its right', () => {
    // yo | querer | (vacía) | agua | hola  ->  quitar una columna
    const b = board(['yo', 'querer', 'agua', 'hola'], { rows: 1, cols: 5 })
    const empty = [0, 1, 2, 3, 4].find((c) => !b.cells.some((x) => x.col === c))!
    const smaller = resizeBoard(b, 1, 4)!
    expect(smaller.cols).toBe(4)
    for (const c of b.cells) {
      const moved = smaller.cells.find((x) => x.id === c.id)!
      expect(moved.col).toBe(c.col > empty ? c.col - 1 : c.col)
    }
    // Las zonas siguen cubriendo sus celdas
    for (const c of smaller.cells) {
      const [s, e] = smaller.zones[zoneOf(c)]
      expect(c.col >= s && c.col <= e).toBe(true)
    }
    const slots = smaller.cells.map((c) => `${c.row},${c.col}`)
    expect(new Set(slots).size).toBe(slots.length)
  })

  it('removes an empty row in the middle', () => {
    const b = { ...board(['yo'], { rows: 3, cols: 2 }) }
    b.cells = [...b.cells, { ...b.cells[0], id: 'z', label: 'tú', row: 2 }]
    const smaller = resizeBoard(b, 2, 2)!
    expect(smaller.rows).toBe(2)
    expect(smaller.cells.find((c) => c.id === 'z')!.row).toBe(1)
  })

  it('zones cover all columns without overlapping', () => {
    const z = computeZones({ A: 8, B: 20, C: 10, D: 5, E: 3 }, 6, 12)
    const ranges = Object.values(z).filter(([s, e]) => e >= s).sort((a, b) => a[0] - b[0])
    expect(ranges[0][0]).toBe(0)
    expect(ranges[ranges.length - 1][1]).toBe(11)
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1] + 1)
  })
})

describe('layoutAt (distribución de una foto)', () => {
  it('keeps photo positions and fills free slots with the rest', () => {
    const grid = { rows: 2, cols: 3, cells: [{ label: 'agua', row: 0, col: 2 }, { label: 'yo', row: 1, col: 0 }] }
    const b = { id: 'b', name: 'x', ...layoutAt(['yo', 'agua', 'comer'].map(word), grid) }
    expect(at(b, 'agua')).toEqual([0, 2])
    expect(at(b, 'yo')).toEqual([1, 0])
    const slots = b.cells.map((c) => `${c.row},${c.col}`)
    expect(new Set(slots).size).toBe(3)
    expect(b.rows).toBe(2)
  })
})
