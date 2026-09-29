import { type CellRect, detectGrid } from './gridDetect'
import type { PSM } from 'tesseract.js'
import { cellCandidate, cleanOcrLines, type LabelCandidate, pickLabel, type ScoredLine } from './ocrClean'
import { gridFromCells, gridFromLines, type PhotoCell, type PhotoGrid, type TextLine } from './photo'

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>

/** Imagen ampliada en escala de grises: Tesseract lee mejor el texto pequeño de las capturas. */
function prepare(bitmap: ImageBitmap): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.min(3, Math.max(1, 2400 / Math.max(bitmap.width, bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.2)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { canvas, scale }
}

const PADDING = 16

/**
 * Lecturas de cada casilla, con la altura (px) a la que se amplía el trozo leído: Tesseract
 * lee mejor letras de unos 30–40 px. 1) La casilla entera como texto disperso (dibujo +
 * etiqueta); 2) la franja de abajo, donde suele ir la etiqueta, como una línea y con más
 * contraste (fondos grises de carpeta, palabras cortas); 3) la casilla entera como un bloque
 * (letras grandes solas: «EL», «A»).
 */
const PASSES = [
  { psm: '11', from: 0, to: 1, height: 160, filter: 'grayscale(1) contrast(1.2)' },
  { psm: '7', from: 0.6, to: 1, height: 100, filter: 'grayscale(1) contrast(2)' },
  { psm: '6', from: 0, to: 1, height: 160, filter: 'grayscale(1) contrast(1.2)' },
] as const

/**
 * Un trozo de una casilla (de `from` a `to` de su altura) en su propio lienzo, ampliado y con
 * margen blanco: así cada casilla se lee sola, sin mezclar textos de las vecinas.
 */
function cellImage(bitmap: ImageBitmap, c: CellRect, pass: (typeof PASSES)[number]): HTMLCanvasElement {
  const y = c.y + c.height * pass.from
  const h = c.height * (pass.to - pass.from)
  const scale = pass.height / h
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(c.width * scale) + 2 * PADDING
  canvas.height = pass.height + 2 * PADDING
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.filter = pass.filter
  ctx.drawImage(bitmap, c.x, y, c.width, h, PADDING, PADDING, canvas.width - 2 * PADDING, pass.height)
  return canvas
}

/** Píxeles de la imagen tal cual (en color): para encontrar las casillas. */
function pixels(bitmap: ImageBitmap): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

async function lines(worker: Worker, image: HTMLCanvasElement): Promise<ScoredLine[]> {
  const { data } = await worker.recognize(image, {}, { blocks: true })
  return (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines.map((l) => ({
        text: l.text.trim(),
        x: l.bbox.x0,
        y: l.bbox.y0,
        width: l.bbox.x1 - l.bbox.x0,
        height: l.bbox.y1 - l.bbox.y0,
        elements: l.words.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          x: w.bbox.x0,
          y: w.bbox.y0,
          width: w.bbox.x1 - w.bbox.x0,
          height: w.bbox.y1 - w.bbox.y0,
        })),
      })),
    ),
  )
}

/**
 * Lee la foto de un tablero en el propio navegador (Tesseract.js): la imagen no sale del ordenador.
 * Si se ven las casillas, se lee cada una por separado (posición exacta, sin mezclar textos de
 * casillas vecinas); si no, se lee la imagen entera y la cuadrícula se deduce de los textos.
 * La librería y el idioma se descargan solo la primera vez que se usa.
 */
export async function readBoardPhoto(file: Blob, onProgress?: (p: number) => void): Promise<PhotoGrid> {
  const bitmap = await createImageBitmap(file)
  const found = detectGrid(pixels(bitmap))
  if (!found) return gridFromLines(await recognizeImage(bitmap, onProgress))

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1)
  try {
    const read: PhotoCell[] = []
    for (const [i, c] of found.cells.entries()) {
      const candidates: LabelCandidate[] = []
      for (const pass of PASSES) {
        await worker.setParameters({ tessedit_pageseg_mode: pass.psm as PSM })
        const cand = cellCandidate(await lines(worker, cellImage(bitmap, c, pass)))
        if (cand) candidates.push(cand)
      }
      const label = pickLabel(candidates)
      read.push({ row: c.row, col: c.col, label })
      onProgress?.((i + 1) / found.cells.length)
    }
    return gridFromCells(found.rows, found.cols, read)
  } finally {
    await worker.terminate()
  }
}

/** Texto de toda la imagen, línea a línea (cuando no se distinguen las casillas). */
async function recognizeImage(bitmap: ImageBitmap, onProgress?: (p: number) => void): Promise<TextLine[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    return cleanOcrLines(await lines(worker, prepare(bitmap).canvas))
  } finally {
    await worker.terminate()
  }
}
