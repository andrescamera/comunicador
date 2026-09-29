import type { TextBox, TextLine } from './photo'

/** Palabra leída por un OCR genérico (p. ej. Tesseract) con su confianza (0–100). */
export interface ScoredBox extends TextBox {
  confidence: number
}
export interface ScoredLine extends TextBox {
  elements: ScoredBox[]
}

// Palabras cortas habituales en tableros: el resto de trozos de 1–2 letras suele ser ruido de los dibujos
const SHORT_WORDS = new Set([
  'yo', 'tú', 'tu', 'él', 'el', 'la', 'no', 'sí', 'si', 'y', 'o', 'ir', 'ver', 'dar', 'ser', 'más', 'ya', 'mi', 'me', 'te', 'un', 'uno', 'dos', 'oso',
])

function keepWord(w: ScoredBox): boolean {
  const t = w.text.replace(/^[¿¡"“(]+|[?!.,;:"”)]+$/g, '').toLowerCase()
  if (w.confidence < 60 || !/\p{L}/u.test(t)) return false
  return t.length >= 3 || SHORT_WORDS.has(t)
}

/**
 * Un OCR genérico también "lee" dentro de los pictogramas (trozos como «Xx», «E 2 em»).
 * Se quitan las palabras de baja confianza y los trozos cortos que no son palabras de tablero,
 * y cada línea se rehace con lo que queda (texto y caja).
 */
export function cleanOcrLines(lines: ScoredLine[]): TextLine[] {
  const out: TextLine[] = []
  for (const line of lines) {
    const words = line.elements.filter(keepWord)
    if (!words.length) continue
    const x = Math.min(...words.map((w) => w.x))
    const y = Math.min(...words.map((w) => w.y))
    const right = Math.max(...words.map((w) => w.x + w.width))
    const bottom = Math.max(...words.map((w) => w.y + w.height))
    out.push({
      text: words.map((w) => w.text).join(' '),
      x,
      y,
      width: right - x,
      height: bottom - y,
      elements: words.map(({ confidence: _c, ...w }) => w),
    })
  }
  return out
}
