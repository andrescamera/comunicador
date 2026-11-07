import { unzlibSync } from 'fflate'
import { useEffect, useSyncExternalStore } from 'react'
import { pictoUrl } from './arasaac'

/**
 * Caja de lo dibujado en un pictograma: los PNG de ARASAAC son cuadrados con margen transparente y,
 * si se ignora ese margen, el picto llena mucho mejor la ficha (sobre todo los apaisados).
 * [x0, y0, x1, y1, lado de la imagen], en píxeles de la imagen.
 */
export type PictoBounds = [number, number, number, number, number]

const ALPHA_MIN = 16 // por debajo no se ve: el borde suavizado no cuenta como dibujo

/** Caja de lo dibujado en un PNG cuadrado, o null si no se puede saber (se muestra entero). */
export function pngBounds(png: Uint8Array): PictoBounds | null {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0
  let transparency: Uint8Array | undefined
  const data: Uint8Array[] = []
  for (let at = 8; at + 8 <= png.length; ) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(png[at + 4], png[at + 5], png[at + 6], png[at + 7])
    const chunk = png.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      depth = chunk[8]
      colorType = chunk[9]
      interlace = chunk[12]
    } else if (type === 'tRNS') transparency = chunk
    else if (type === 'IDAT') data.push(chunk)
    at += 12 + length
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType]
  if (!channels || !width || width !== height || interlace || depth > 8 || (depth < 8 && colorType !== 3 && colorType !== 0)) return null

  const joined = new Uint8Array(data.reduce((n, d) => n + d.length, 0))
  data.reduce((at, d) => (joined.set(d, at), at + d.length), 0)
  const raw = unzlibSync(joined)

  const stride = Math.ceil((width * channels * depth) / 8)
  const step = Math.max(1, (channels * depth) >> 3)
  const alphaAt = (row: Uint8Array, x: number): number => {
    if (colorType === 6) return row[x * 4 + 3]
    if (colorType === 4) return row[x * 2 + 1]
    if (colorType !== 3) return 255
    const index = depth === 8 ? row[x] : (row[(x * depth) >> 3] >> (8 - depth - ((x * depth) & 7))) & ((1 << depth) - 1)
    return transparency && index < transparency.length ? transparency[index] : 255
  }

  let x0 = width, y0 = height, x1 = 0, y1 = 0
  let previous = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1)
    if (start + stride + 1 > raw.length) return null
    const filter = raw[start]
    const row = raw.slice(start + 1, start + 1 + stride)
    for (let i = 0; i < stride; i++) {
      const left = i >= step ? row[i - step] : 0
      const up = previous[i]
      const upLeft = i >= step ? previous[i - step] : 0
      if (filter === 1) row[i] += left
      else if (filter === 2) row[i] += up
      else if (filter === 3) row[i] += (left + up) >> 1
      else if (filter === 4) {
        const p = left + up - upLeft
        const pl = Math.abs(p - left), pu = Math.abs(p - up), pul = Math.abs(p - upLeft)
        row[i] += pl <= pu && pl <= pul ? left : pu <= pul ? up : upLeft
      }
    }
    previous = row
    for (let x = 0; x < width; x++) {
      if (alphaAt(row, x) <= ALPHA_MIN) continue
      if (x < x0) x0 = x
      if (x >= x1) x1 = x + 1
      if (y < y0) y0 = y
      y1 = y + 1
    }
  }
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1, width] : null
}

/** Dónde colocar la imagen entera para que lo dibujado llene el hueco, centrado y sin deformar. */
export function trimmedRect([x0, y0, x1, y1, side]: PictoBounds, boxW: number, boxH: number) {
  const scale = Math.min(boxW / (x1 - x0), boxH / (y1 - y0))
  return {
    size: side * scale,
    left: (boxW - (x1 - x0) * scale) / 2 - x0 * scale,
    top: (boxH - (y1 - y0) * scale) / 2 - y0 * scale,
  }
}

// null: no se puede recortar (no se vuelve a intentar). Sin entrada: aún no se sabe.
const known = new Map<number, PictoBounds | null>()
const listeners = new Set<() => void>()
const pending = new Set<number>()
const queue: number[] = []
const MAX_DOWNLOADS = 3
let downloads = 0
let save: ((raw: string) => void) | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined

function learn(id: number, bounds: PictoBounds | null) {
  known.set(id, bounds)
  listeners.forEach((l) => l())
  if (save && !saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      save?.(JSON.stringify(Object.fromEntries(known)))
    }, 1000)
  }
}

async function download(id: number) {
  try {
    const res = await fetch(pictoUrl(id))
    if (res.ok) learn(id, pngBounds(new Uint8Array(await res.arrayBuffer())))
    // Sin conexión o error del servidor: se ve entero y se reintenta la próxima vez
  } catch {
    // Un PNG dañado tampoco debe romper la ficha
  }
}

function next() {
  while (downloads < MAX_DOWNLOADS && queue.length) {
    const id = queue.shift()!
    downloads++
    void download(id).finally(() => {
      downloads--
      pending.delete(id)
      next()
    })
  }
}

/** Pide la caja de un picto si aún no se conoce (en segundo plano). */
export function requestPictoBounds(id: number) {
  if (known.has(id) || pending.has(id)) return
  pending.add(id)
  queue.push(id)
  next()
}

/** Recupera las cajas guardadas en el dispositivo y deja indicado cómo guardar las nuevas. */
export function restorePictoBounds(raw: string | null, onSave: (raw: string) => void) {
  save = onSave
  if (!raw) return
  try {
    for (const [id, bounds] of Object.entries(JSON.parse(raw) as Record<string, PictoBounds | null>)) known.set(Number(id), bounds)
    listeners.forEach((l) => l())
  } catch {
    // Copia dañada: se vuelven a calcular
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** La caja de un picto: undefined/null mientras no se conozca o si no se puede recortar. */
export function usePictoBounds(id: number | undefined): PictoBounds | null | undefined {
  useEffect(() => {
    if (id) requestPictoBounds(id)
  }, [id])
  return useSyncExternalStore(subscribe, () => (id ? known.get(id) : undefined))
}
