import { describe, expect, it } from 'vitest'
import { DEFAULT_DYNAMIC, dynamicView, NEXT_PAGE, sentenceStage, stageCells, wantsVerb } from './dynamic'
import type { Board, Category, Cell } from './types'

let n = 0
const cell = (label: string, category: Category, kind: Cell['kind'] = 'word'): Cell => ({ id: `c${n++}`, label, category, kind, row: n % 7, col: Math.floor(n / 7) })
const board = (cells: Cell[], rows = 6, cols = 10): Board => ({ id: 'root', name: 'Inicio', rows, cols, zones: { A: [0, 1], B: [2, 4], C: [5, 6], D: [7, 8], E: [9, 9] }, cells })

const yo = cell('yo', 'pronoun')
const mama = cell('mamá', 'person')
const donde = cell('dónde', 'question')
const querer = cell('querer', 'verb')
const comer = cell('comer', 'verb')
const dormir = cell('dormir', 'verb')
const agua = cell('agua', 'noun')
const grande = cell('grande', 'adjective')
const la = cell('la', 'misc')
const comida = cell('Comida', 'misc', 'folder')
const hola = cell('hola', 'social')
const no = cell('no', 'negation')
const si = cell('sí', 'social')
const mas = cell('más', 'misc')
const ayuda = cell('ayuda', 'social')
const all = [yo, mama, donde, querer, comer, dormir, agua, grande, la, comida, hola, no, si, mas, ayuda]
const labels = (cs: Cell[]) => cs.map((c) => c.label).sort()

describe('momento de la frase', () => {
  it('vacía: empezar; tras persona, pregunta o «no»: verbos; tras verbo: lo demás', () => {
    expect(sentenceStage([])).toBe(1)
    expect(sentenceStage([yo])).toBe(2)
    expect(sentenceStage([donde])).toBe(2)
    expect(sentenceStage([no])).toBe(2)
    expect(sentenceStage([yo, querer])).toBe(3)
    expect(sentenceStage([querer])).toBe(3) // «quiero agua»: el sujeto se puede omitir
    expect(sentenceStage([hola])).toBe(1)
  })
})

describe('fichas de cada momento', () => {
  const root = board(all)
  it('columna fija en todos los momentos, en el orden configurado', () => {
    for (const s of [1, 2, 3] as const) expect(stageCells(root, DEFAULT_DYNAMIC, s).fixed.map((c) => c.label)).toEqual(['no', 'sí', 'más', 'ayuda'])
  })
  it('1 · personas, preguntas, verbos y social', () => {
    expect(labels(stageCells(root, DEFAULT_DYNAMIC, 1).cells)).toEqual(labels([yo, mama, donde, querer, comer, dormir, hola]))
  })
  it('2 · solo verbos (ni personas ni nombres)', () => {
    expect(labels(stageCells(root, DEFAULT_DYNAMIC, 2).cells)).toEqual(labels([querer, comer, dormir]))
  })
  it('3 · nombres, carpetas, palabras pequeñas y personas', () => {
    expect(labels(stageCells(root, DEFAULT_DYNAMIC, 3).cells)).toEqual(labels([mama, agua, grande, la, comida]))
  })
  it('3 · tras «quiero» también todos los verbos (quiero comer); tras «como», no', () => {
    expect(wantsVerb([yo, querer], DEFAULT_DYNAMIC)).toBe(true)
    expect(wantsVerb([yo, comer], DEFAULT_DYNAMIC)).toBe(false)
    expect(wantsVerb([yo, querer, comer], DEFAULT_DYNAMIC)).toBe(false) // ya hay dos verbos
    expect(labels(stageCells(root, DEFAULT_DYNAMIC, 3, true).cells)).toEqual(labels([mama, querer, comer, dormir, agua, grande, la, comida]))
  })
  it('las fichas ocultas no salen', () => {
    expect(stageCells(board([{ ...agua, hidden: true }]), DEFAULT_DYNAMIC, 3).cells).toEqual([])
  })
})

describe('colocación', () => {
  it('pocas fichas: cuadrícula pequeña (fichas grandes) y la columna fija a la derecha', () => {
    const { board: b, pages } = dynamicView(board(all), DEFAULT_DYNAMIC, 2)
    expect(pages).toBe(1)
    expect(b.rows * (b.cols - 1)).toBeLessThan(6 * 9)
    const fixedCol = b.cols - 1
    expect(b.cells.filter((c) => c.col === fixedCol).map((c) => c.label)).toEqual(['no', 'sí', 'más', 'ayuda'])
    // Ninguna casilla repetida
    expect(new Set(b.cells.map((c) => `${c.row},${c.col}`)).size).toBe(b.cells.length)
  })
  it('siempre la misma posición para la misma ficha en el mismo momento', () => {
    const a = dynamicView(board(all), DEFAULT_DYNAMIC, 3).board.cells.find((c) => c.label === 'agua')
    const b = dynamicView(board(all), DEFAULT_DYNAMIC, 3).board.cells.find((c) => c.label === 'agua')
    expect([a?.row, a?.col]).toEqual([b?.row, b?.col])
  })
  it('si no caben todas: páginas con «más ▸» en la columna fija', () => {
    const many = Array.from({ length: 30 }, (_, i) => cell(`verbo${i}ar`, 'verb'))
    const { board: b, pages } = dynamicView(board([...many, no, si, mas, ayuda], 4, 5), DEFAULT_DYNAMIC, 2)
    expect(pages).toBe(2)
    expect(b.cells.some((c) => c.id === NEXT_PAGE)).toBe(true)
    expect(b.cols).toBeLessThanOrEqual(5)
    expect(b.rows).toBeLessThanOrEqual(4)
  })
})
