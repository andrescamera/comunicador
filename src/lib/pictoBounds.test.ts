import { zlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { pngBounds, trimmedRect } from './pictoBounds'

function chunk(type: string, data: number[] | Uint8Array): number[] {
  const n = data.length
  // El lector no comprueba el CRC: basta con reservar sus 4 bytes
  return [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

function png(size: number, colorType: number, rows: number[][], extra: number[] = [], depth = 8, interlace = 0) {
  const ihdr = [0, 0, 0, size, 0, 0, 0, size, depth, colorType, 0, 0, interlace]
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr), ...extra, ...chunk('IDAT', zlibSync(new Uint8Array(rows.flat()))), ...chunk('IEND', [])])
}

describe('pngBounds', () => {
  it('encuentra lo dibujado en un PNG con paleta y transparencia', () => {
    const rows = [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0],
    ]
    expect(pngBounds(png(4, 3, rows, chunk('tRNS', [0, 255])))).toEqual([1, 1, 3, 3, 4])
  })

  it('deshace los filtros de cada fila en RGBA', () => {
    const px = (a: number) => [9, 9, 9, a]
    const rows = [
      [0, ...px(0), ...px(0), ...px(0)],
      [1, ...px(0), ...px(200), 0, 0, 0, 10], // Sub: el tercer píxel es 200 + 10
      [2, ...px(0), ...px(0), ...px(0)], // Up: repite la fila de arriba
    ]
    expect(pngBounds(png(3, 6, rows))).toEqual([1, 1, 3, 3, 3])
  })

  it('lee paletas de pocos bits', () => {
    const rows = [
      [0, 0b00000000],
      [0, 0b00110000],
      [0, 0b00000000],
      [0, 0b00000000],
    ]
    expect(pngBounds(png(4, 3, rows, chunk('tRNS', [0, 255]), 2))).toEqual([1, 1, 2, 2, 4])
  })

  it('ignora lo casi invisible', () => {
    const rows = [
      [0, 9, 9, 9, 10, 9, 9, 9, 10],
      [0, 9, 9, 9, 10, 9, 9, 9, 255],
    ]
    expect(pngBounds(png(2, 6, rows))).toEqual([1, 1, 2, 2, 2])
  })

  it('no recorta lo que no puede leer', () => {
    expect(pngBounds(png(2, 3, [[0, 0, 0], [0, 0, 0]], chunk('tRNS', [0])))).toBeNull() // vacío
    expect(pngBounds(png(2, 6, [[0, 0], [0, 0]], [], 8, 1))).toBeNull() // entrelazado
  })
})

describe('trimmedRect', () => {
  it('un picto apaisado llena el ancho y queda centrado en alto', () => {
    // Dibujo de 200×50 en una imagen de 300, hueco de 100×60
    expect(trimmedRect([50, 100, 250, 150, 300], 100, 60)).toEqual({ size: 150, left: -25, top: -32.5 })
  })

  it('un picto estrecho llena el alto', () => {
    const r = trimmedRect([100, 0, 200, 300, 300], 100, 60)
    expect(r.size).toBe(60)
    expect(r.left).toBe(20)
    expect(r.top).toBeCloseTo(0)
  })
})
