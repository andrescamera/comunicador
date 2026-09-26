import { describe, expect, it } from 'vitest'
import { parseText } from './generator'
import { cleanLabel, gridFromLines, gridToText, splitLine, type TextLine } from './photo'

// Tablero fotografiado: celdas de 200×220 px, etiqueta bajo cada pictograma, algo torcido
const PITCH_X = 200
const PITCH_Y = 220
function label(text: string, row: number, col: number, jitter = 0): TextLine {
  const width = text.length * 14
  return { text, x: 60 + col * PITCH_X + 100 - width / 2 + jitter, y: 40 + row * PITCH_Y + 170 + jitter / 2, width, height: 28 }
}

describe('gridFromLines', () => {
  it('rebuilds rows, columns and empty slots from label positions', () => {
    const lines = [
      label('yo', 0, 0, 4),
      label('quiero', 0, 1, -6),
      label('comer', 0, 2, 3),
      label('agua', 0, 4, -2), // columna 3 vacía
      label('tú', 1, 0, -3),
      label('ir', 1, 1, 5),
      label('galletas', 1, 4, 2),
      label('mamá', 2, 0, 1),
      label('no', 2, 3, -4),
    ]
    const grid = gridFromLines(lines)
    expect(grid.rows).toBe(3)
    expect(grid.cols).toBe(5)
    const at = (l: string) => grid.cells.find((c) => c.label === l)
    expect(at('yo')).toMatchObject({ row: 0, col: 0 })
    expect(at('querer')).toMatchObject({ row: 0, col: 1 }) // conjugado -> infinitivo
    expect(at('agua')).toMatchObject({ row: 0, col: 4 })
    expect(at('galletas')).toMatchObject({ row: 1, col: 4 })
    expect(at('no')).toMatchObject({ row: 2, col: 3 })
  })

  it('joins labels split over two lines and ignores titles and numbers', () => {
    const por = label('por', 0, 1)
    const lines: TextLine[] = [
      { text: 'MI TABLERO DE COMUNICACIÓN', x: 200, y: 0, width: 700, height: 70 },
      label('hola', 0, 0),
      { ...por, y: por.y - 16 },
      { ...label('favor', 0, 1), y: por.y + 16 },
      label('adiós', 0, 2),
      { text: '12', x: 900, y: 600, width: 30, height: 28 },
    ]
    const grid = gridFromLines(lines)
    expect(grid.cells.map((c) => [c.label, c.col])).toEqual([
      ['hola', 0],
      ['por favor', 1],
      ['adiós', 2],
    ])
  })

  it('treats capitals as style when most labels have them, and as names otherwise', () => {
    const styled = gridFromLines([label('Galletas', 0, 0), label('Leche', 0, 1), label('Quiero', 0, 2)])
    expect(styled.cells.map((c) => c.label)).toEqual(['galletas', 'leche', 'querer'])
    const names = gridFromLines([label('galletas', 0, 0), label('leche', 0, 1), label('agua', 0, 2), label('Mati', 0, 3)])
    expect(names.cells.map((c) => c.label)).toEqual(['galletas', 'leche', 'agua', 'Mati'])
  })

  it('transcribes the photo as a grid text that keeps rows, columns and empty slots', () => {
    const grid = gridFromLines([
      label('yo', 0, 0),
      label('otra vez', 0, 1),
      label('agua', 0, 3),
      label('quiero ir al baño', 2, 0), // la fila 1 está vacía
      label('no', 2, 2),
    ])
    expect(grid.rows).toBe(3)
    expect(grid.cols).toBe(4)
    const text = gridToText(grid)
    expect(text).toBe('yo, otra vez, _, agua\n_\n"quiero ir al baño", _, no')
    const [board] = parseText(text, { grid: true })
    expect(board.gridRows).toBe(3)
    expect(board.gridCols).toBe(4)
    expect(board.items.map((i) => `${i.kind}:${i.label}@${i.row},${i.col}`)).toEqual([
      'word:yo@0,0',
      'word:otra vez@0,1',
      'word:agua@0,3',
      'phrase:quiero ir al baño@2,0',
      'word:no@2,2',
    ])
  })

  it('splits a recognised line that joins the labels of neighbouring cells', () => {
    const joined: TextLine = {
      text: 'yo tú',
      x: 100,
      y: 200,
      width: 300,
      height: 28,
      elements: [
        { text: 'yo', x: 100, y: 200, width: 30, height: 28 },
        { text: 'tú', x: 370, y: 200, width: 30, height: 28 },
      ],
    }
    expect(splitLine(joined).map((b) => b.text)).toEqual(['yo', 'tú'])
    const phrase: TextLine = {
      ...joined,
      text: 'por favor',
      elements: [
        { text: 'por', x: 100, y: 200, width: 45, height: 28 },
        { text: 'favor', x: 155, y: 200, width: 70, height: 28 },
      ],
    }
    expect(splitLine(phrase).map((b) => b.text)).toEqual(['por favor'])
  })

  it('cleans punctuation', () => {
    expect(cleanLabel('¿Qué?', false)).toBe('qué')
    expect(cleanLabel('comemos.', false)).toBe('comer')
  })
})

describe('grid text -> board (end to end)', () => {
  it('places every cell exactly where the grid text says, keeping the size', async () => {
    const { vi } = await import('vitest')
    vi.stubGlobal('fetch', async () => new Response('[]', { status: 404 })) // sin red: sin pictogramas
    const { generateLibrary } = await import('./generator')
    const lib = await generateLibrary(parseText('yo, querer, _, agua\n_\nMati, _, no', { grid: true }))
    const b = lib.boards[lib.rootId]
    expect([b.rows, b.cols]).toEqual([3, 4])
    // sin el modo cuadrícula, las mismas palabras se ordenan por categorías (no se respeta el orden)
    const byCategory = await generateLibrary(parseText('yo, querer, _, agua\n_\nMati, _, no'))
    expect(byCategory.boards[byCategory.rootId].cells.map((c) => c.label)).not.toContain('_')
    const pos = Object.fromEntries(b.cells.map((c) => [c.label, [c.row, c.col]]))
    expect(pos).toEqual({ yo: [0, 0], querer: [0, 1], agua: [0, 3], Mati: [2, 0], no: [2, 2] })
    expect(b.cells.find((c) => c.label === 'Mati')?.category).toBe('person')
    vi.unstubAllGlobals()
  })
})
