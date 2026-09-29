import { cleanOcrLines, type ScoredLine } from './ocrClean'
import type { TextLine } from './photo'

/** Imagen ampliada en escala de grises: Tesseract lee mejor el texto pequeño de las capturas. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, Math.max(1, 2400 / Math.max(bitmap.width, bitmap.height)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.2)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Lee el texto de una foto en el propio navegador (Tesseract.js): la imagen no sale del ordenador.
 * La librería y el idioma se descargan solo la primera vez que se usa.
 */
export async function recognizeImage(file: Blob, onProgress?: (p: number) => void): Promise<TextLine[]> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(await prepare(file), {}, { blocks: true })
    const lines: ScoredLine[] = (data.blocks ?? []).flatMap((b) =>
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
    return cleanOcrLines(lines)
  } finally {
    await worker.terminate()
  }
}
