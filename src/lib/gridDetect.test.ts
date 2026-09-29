import { describe, expect, it } from 'vitest'
import { detectGrid, type Pixels } from './gridDetect'

type RGB = [number, number, number]

/** Imagen sintética: fondo, una barra arriba y una cuadrícula de casillas con "dibujos". */
function board(opts: { rows: number; cols: number; cell: number; gap: number; top: number; colors: (r: number, c: number) => RGB }): Pixels {
  const { rows, cols, cell, gap, top } = opts
  const width = cols * (cell + gap) + gap
  const height = top + rows * (cell + gap) + gap
  const data = new Uint8ClampedArray(width * height * 4)
  const put = (x: number, y: number, [r, g, b]: RGB) => {
    const i = (y * width + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, [230, 200, 190])
  for (let y = 0; y < top - gap; y++) for (let x = 0; x < width; x++) put(x, y, [255, 255, 255]) // barra de frase
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x0 = gap + c * (cell + gap)
      const y0 = top + gap + r * (cell + gap)
      for (let y = 0; y < cell; y++)
        for (let x = 0; x < cell; x++) {
          const edge = x < 2 || y < 2 || x >= cell - 2 || y >= cell - 2
          // "Dibujo": unas manchas oscuras dentro de la casilla
          const ink = (x * 7 + y * 13 + r * 5 + c * 3) % 17 === 0
          put(x0 + x, y0 + y, edge ? [120, 120, 120] : ink ? [20, 20, 20] : opts.colors(r, c))
        }
    }
  return { width, height, data }
}

describe('detectGrid', () => {
  it('encuentra filas y columnas, sin contar la barra de arriba', () => {
    const g = detectGrid(board({ rows: 4, cols: 6, cell: 60, gap: 8, top: 50, colors: (_, c) => [255, 250 - c * 20, 200] }))
    expect(g && [g.rows, g.cols]).toEqual([4, 6])
    expect(g!.cells).toHaveLength(24)
    expect(g!.cells[0]).toMatchObject({ row: 0, col: 0 })
  })

  it('distingue las columnas aunque toda una columna sea del mismo color', () => {
    const g = detectGrid(board({ rows: 5, cols: 5, cell: 60, gap: 6, top: 0, colors: () => [255, 245, 200] }))
    expect(g && [g.rows, g.cols]).toEqual([5, 5])
  })

  it('devuelve null si no hay cuadrícula', () => {
    const width = 200
    const height = 100
    const data = new Uint8ClampedArray(width * height * 4).fill(255)
    expect(detectGrid({ width, height, data })).toBeNull()
  })
})
