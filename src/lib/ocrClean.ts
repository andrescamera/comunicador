import { isKnownWord } from './grammar'
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

const LABEL_CHARS = /^[¿¡"“(]*[\p{L}]+(?:[-'’][\p{L}]+)*[?!.,;:"”)]*$/u

/**
 * Texto de UNA casilla leída por separado: el dibujo también produce "palabras" (trozos de
 * baja confianza o con símbolos). Se elige la línea más fiable; a igualdad, la de más abajo
 * (la etiqueta suele ir bajo el pictograma). Devuelve '' si no hay texto claro (casilla vacía,
 * flecha de carpeta, solo dibujo).
 */
export function cellLabel(lines: ScoredLine[]): string {
  return cellCandidate(lines)?.text ?? ''
}

export interface LabelCandidate {
  text: string
  score: number
}

/** Como `cellLabel`, con la puntuación (0–100) para comparar lecturas distintas de la misma casilla. */
export function cellCandidate(lines: ScoredLine[]): LabelCandidate | null {
  let best: { text: string; score: number; y: number } | null = null
  for (const line of lines) {
    const words = line.elements.filter((w) => w.confidence >= 55 && LABEL_CHARS.test(w.text))
    if (!words.length) continue
    const text = words.map((w) => w.text).join(' ')
    // Una letra suelta solo vale si es una palabra ("y", "o", "a"), y con mucha confianza
    if (text.replace(/[^\p{L}]/gu, '').length < 2 && (!/^[yoaeu]$/i.test(text) || words[0].confidence < 80)) continue
    const mean = words.reduce((n, w) => n + w.confidence, 0) / words.length
    const score = mean * (words.length / line.elements.length)
    if (!best || score > best.score + 5 || (Math.abs(score - best.score) <= 5 && line.y > best.y)) {
      best = { text, score, y: line.y }
    }
  }
  return best && { text: best.text, score: best.score }
}

/**
 * Entre varias lecturas de la misma casilla: la de más confianza, pero si alguna es una palabra
 * conocida gana esa (una lectura muy segura de un trozo de dibujo no debe tapar a «yo»).
 */
export function pickLabel(candidates: LabelCandidate[]): string {
  const bare = (t: string) => t.replace(/^[¿¡"“(]+|[?!.,;:"”)]+$/g, '').toLowerCase()
  const known = candidates.filter((c) => isKnownWord(bare(c.text)))
  const pool = known.length ? known : candidates
  return [...pool].sort((a, b) => b.score - a.score)[0]?.text ?? ''
}
