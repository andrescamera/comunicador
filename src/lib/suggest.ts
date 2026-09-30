import { CATALOG_WORDS } from './catalog'

/**
 * Autocompletado de palabras al crear fichas. Las sugerencias salen de todas las palabras que
 * tienen pictograma en ARASAAC (así cualquier sugerencia tiene dibujo) y se ordenan poniendo
 * primero las del catálogo de carpetas, que son las habituales en un tablero.
 */

const KEYWORDS_URL = 'https://api.arasaac.org/v1/keywords/es'
const STORAGE_KEY = 'arasaac-keywords-v1'

/** Sin tildes ni mayúsculas: «platano» encuentra «plátano». */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const PRIORITY = new Map(CATALOG_WORDS.map((w, i) => [w.toLowerCase(), i]))

let words: string[] = CATALOG_WORDS
let folded: string[] = words.map(fold)
let loading: Promise<void> | null = null

/** Una palabra útil como ficha: letras, sin espacios delante, sin horas ni símbolos sueltos. */
function usable(w: string): boolean {
  return w === w.trim() && w.length >= 2 && w.length <= 30 && /^\p{L}/u.test(w) && !/\d/.test(w)
}

function setWords(list: string[]) {
  words = [...new Set([...CATALOG_WORDS, ...list.filter(usable)])]
  folded = words.map(fold)
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/**
 * Carga (una vez) la lista de ARASAAC; mientras tanto, o sin conexión, se sugiere el catálogo.
 * En el navegador se guarda para no descargarla cada vez.
 */
export function loadWords(): Promise<void> {
  if (loading) return loading
  loading = (async () => {
    const store = storage()
    try {
      const saved = store?.getItem(STORAGE_KEY)
      if (saved) return setWords(JSON.parse(saved) as string[])
    } catch {
      // guardado dañado o sin acceso: se descarga
    }
    try {
      const r = await fetch(KEYWORDS_URL)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const list = ((await r.json()) as { words: string[] }).words.filter(usable)
      setWords(list)
      try {
        store?.setItem(STORAGE_KEY, JSON.stringify(list))
      } catch {
        // sin espacio: se volverá a descargar la próxima vez
      }
    } catch {
      loading = null // se reintenta en el siguiente uso
    }
  })()
  return loading
}

/**
 * Palabras que empiezan por lo escrito (o que tienen una palabra que empieza así: «dientes»
 * encuentra «lavarse los dientes»). Primero las del catálogo, luego las más cortas.
 */
export function suggestWords(text: string, limit = 8, exclude: Iterable<string> = []): string[] {
  const q = fold(text)
  if (!q) return []
  const skip = new Set([...exclude].map(fold))
  const scored: { w: string; score: number }[] = []
  for (let i = 0; i < words.length; i++) {
    const f = folded[i]
    if (skip.has(f) || f === q) continue
    let score: number
    if (f.startsWith(q)) score = 0
    else if (f.includes(` ${q}`)) score = 1
    else continue
    const priority = PRIORITY.get(words[i].toLowerCase())
    scored.push({ w: words[i], score: score * 10_000 + (priority === undefined ? 5_000 + f.length : f.length) })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.w)
}

/** Solo para pruebas: fija la lista de palabras. */
export function _setWordsForTest(list: string[]) {
  setWords(list)
}
