import { describe, expect, it } from 'vitest'
import { detectGrid, period, periodicBands, type Pixels } from './gridDetect'

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

describe('detectGrid por repetición (casillas con sombra y huecos vacíos)', () => {
  it('encuentra las casillas aunque los huecos no sean de un color y falten casillas', () => {
    // 6 × 6 casillas rosas con sombra degradada, en un fondo melocotón; las últimas filas, medio vacías
    const cell = 150, gap = 20, n = 6, width = 1040, height = 1190
    const data = new Uint8ClampedArray(width * height * 4)
    const put = (x: number, y: number, [r, g, b]: RGB) => {
      const i = (y * width + x) * 4
      data.set([r, g, b, 255], i)
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, [255, 204, 187])
    const present = (r: number, c: number) => (r < 4 ? c < (r === 1 || r === 2 ? 5 : 6) : r === 4 ? c < 5 : c < 2)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!present(r, c)) continue
        const x0 = 18 + c * (cell + gap), y0 = 10 + r * (cell + gap)
        for (let y = 0; y < cell + 8; y++)
          for (let x = 0; x < cell + 8; x++) {
            const inCell = x < cell && y < cell
            // sombra: un degradado a la derecha y abajo de cada casilla
            if (!inCell) put(x0 + x, y0 + y, [180 + Math.max(x - cell, y - cell) * 8, 167 + Math.max(x - cell, y - cell) * 4, 162])
            else put(x0 + x, y0 + y, (x * 7 + y * 13) % 23 === 0 ? [30, 30, 30] : [248, 187, 208])
          }
      }
    const g = detectGrid({ width, height, data })
    expect(g && [g.rows, g.cols]).toEqual([6, 6])
    const first = g!.cells.find((c) => c.row === 0 && c.col === 0)!
    // cada casilla detectada contiene el centro de la de verdad y mide más o menos lo mismo
    for (const c of g!.cells) {
      const cx = 18 + c.col * (cell + gap) + cell / 2, cy = 10 + c.row * (cell + gap) + cell / 2
      expect(c.x < cx && cx < c.x + c.width && c.y < cy && cy < c.y + c.height).toBe(true)
      expect(Math.abs(c.width - cell)).toBeLessThanOrEqual(cell * 0.25)
    }
    expect(first.row).toBe(0)
  })
})

describe('periodo de las casillas', () => {
  it('a partir de los bordes: periodo, inicio y tamaño, sin contar la zona vacía', () => {
    // casillas de 150 cada 170 desde x=18; las 3 últimas posiciones, vacías (sin bordes)
    const p = new Array<number>(1400).fill(2)
    for (let i = 0; i < 5; i++) {
      p[18 + i * 170] = 300
      p[18 + i * 170 + 151] = 280
      for (let k = 40; k < 110; k += 9) p[18 + i * 170 + k] = 60 // dibujos y letras
    }
    const k = period(p)!
    expect(Math.abs(k - 170)).toBeLessThanOrEqual(1)
    const b = periodicBands(p, k)
    expect(b.length).toBe(5)
    expect(b[0].start).toBeGreaterThanOrEqual(18)
    expect(b[0].start).toBeLessThanOrEqual(21)
    expect(Math.abs(b[0].end - b[0].start - 150)).toBeLessThanOrEqual(3)
  })
})
