import { describe, expect, it } from 'vitest'
import { pageOfCell, searchCells } from './search'
import type { Board, Cell, Library } from './types'

const zones = { A: [0, 0], B: [1, 1], C: [2, 2], D: [3, 3], E: [4, 4] } as Board['zones']
const cell = (id: string, label: string, row = 0, col = 0, extra: Partial<Cell> = {}): Cell => ({ id, kind: 'word', label, category: 'noun', row, col, ...extra })
const board = (id: string, name: string, cells: Cell[]): Board => ({ id, name, rows: 3, cols: 5, zones, cells })

const lib: Library = {
  rootId: 'root',
  boards: {
    root: board('root', 'Principal', [cell('agua', 'agua'), cell('f1', 'Comida', 0, 4, { kind: 'folder', target: 'comida' })]),
    comida: board('comida', 'Comida', [cell('pan', 'pan'), cell('pa', 'patatas', 1), cell('f2', 'Frutas', 2, 0, { kind: 'folder', target: 'frutas' })]),
    frutas: board('frutas', 'Frutas', [cell('pl', 'plátano'), cell('za', 'zumo de piña', 1), cell('pe', 'pera', 2, 0, { hidden: true })]),
    suelto: board('suelto', 'Suelto', [cell('x', 'pan duro')]),
  },
}

describe('searchCells', () => {
  it('ignores accents and case, and gives the folders to open', () => {
    const [hit] = searchCells(lib, 'PLATANO')
    expect(hit.cell.id).toBe('pl')
    expect(hit.path).toEqual(['comida', 'frutas'])
    expect(hit.trail).toEqual(['Comida', 'Frutas'])
  })

  it('puts starts-with first, then word starts, then the rest; skips boards nobody reaches', () => {
    expect(searchCells(lib, 'pa').map((h) => h.cell.label)).toEqual(['pan', 'patatas'])
    expect(searchCells(lib, 'piña').map((h) => h.cell.label)).toEqual(['zumo de piña'])
    expect(searchCells(lib, 'gu').map((h) => h.cell.label)).toEqual(['agua'])
  })

  it('finds folders too and returns nothing for an empty query', () => {
    expect(searchCells(lib, 'frut')[0].cell.id).toBe('f2')
    expect(searchCells(lib, '  ')).toEqual([])
    expect(searchCells(lib, 'pera')).toEqual([]) // oculta: en uso no se ve
  })
})

describe('pageOfCell', () => {
  it('finds the page of the folder zone where a cell shows up', () => {
    const root = board('root', 'P', [])
    const many = board('m', 'Muchas', Array.from({ length: 9 }, (_, i) => cell(`m${i}`, `w${i}`, i % 3, Math.floor(i / 3))))
    const area = { r0: 0, c0: 0, r1: 1, c1: 1 } // 4 casillas: 2 fichas por página + flechas
    expect(pageOfCell(root, many, area, 'm0')).toBe(0)
    expect(pageOfCell(root, many, area, 'm8')).toBe(4)
  })
})
