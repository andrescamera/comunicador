const API = 'https://api.arasaac.org/v1/pictograms/es'

export interface PictoResult {
  id: number
  keyword: string
  type?: number // 1 nombre propio, 2 nombre, 3 verbo, 4 descriptivo, 5 social, 6 misc.
}

interface RawPicto {
  _id: number
  keywords: { keyword: string; type: number }[]
}

export function pictoUrl(id: number, size: 300 | 500 = 300): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`
}

const cache = new Map<string, Promise<PictoResult[]>>()

function toResults(raw: RawPicto[], query: string): PictoResult[] {
  const q = query.toLowerCase()
  return raw.map((p) => {
    const kw = p.keywords.find((k) => k.keyword.toLowerCase() === q) ?? p.keywords[0]
    return { id: p._id, keyword: kw?.keyword ?? query, type: kw?.type }
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 404 = sin resultados (se guarda). Error de red o del servidor: se reintenta y no se guarda. */
async function fetchOnce(kind: 'bestsearch' | 'search', text: string): Promise<PictoResult[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${API}/${kind}/${encodeURIComponent(text)}`)
      if (r.status === 404) return []
      if (r.ok) return toResults((await r.json()) as RawPicto[], text)
      throw new Error(`HTTP ${r.status}`)
    } catch (err) {
      if (attempt >= 2) throw err
      await sleep(400 * 2 ** attempt)
    }
  }
}

async function fetchList(kind: 'bestsearch' | 'search', text: string): Promise<PictoResult[]> {
  const key = `${kind}:${text}`
  const hit = cache.get(key)
  if (hit) return hit
  const p = fetchOnce(kind, text)
  cache.set(key, p)
  p.catch(() => cache.delete(key))
  return p.catch(() => [])
}

// Palabras frecuentes que ARASAAC no tiene con ese nombre
const SYNONYMS: Record<string, string> = { vale: 'ok', 'de acuerdo': 'ok', tele: 'televisión' }

// ARASAAC ignora las tildes al buscar ("papá" encuentra "papa"): preferimos la coincidencia exacta
function exact(list: PictoResult[], text: string): PictoResult | undefined {
  const q = text.normalize('NFC').toLowerCase()
  return list.find((p) => p.keyword.toLowerCase() === q)
}

/** Mejor pictograma para una palabra o frase, o undefined si no hay. */
export async function bestPicto(text: string, opts: { exactOnly?: boolean } = {}): Promise<PictoResult | undefined> {
  text = text.normalize('NFC').trim()
  const best = await fetchList('bestsearch', text)
  const hit = exact(best, text)
  if (hit) return hit
  const any = await fetchList('search', text)
  if (opts.exactOnly) return exact(any, text)
  const found = exact(any, text) ?? best[0] ?? any[0]
  if (found) return found
  // Últimos recursos: sinónimos, "terminado" -> "terminar", "lugares" -> "lugar"
  const fallbacks = [
    SYNONYMS[text.toLowerCase()] ?? text,
    text.replace(/(ar|er|ir|ír)se$/, '$1'), // bañarse -> bañar
    text.replace(/ado$/, 'ar'),
    text.replace(/ido$/, 'er'),
    text.replace(/ido$/, 'ir'),
    text.replace(/(.{3,}?)(es|s)$/, '$1'),
  ].filter((f, i, all) => f !== text && all.indexOf(f) === i)
  for (const f of fallbacks) {
    const r = exact(await fetchList('bestsearch', f), f)
    if (r) return r
  }
  return undefined
}

/** Todas las alternativas: primero las mejores coincidencias, luego el resto. */
export async function searchPictos(text: string): Promise<PictoResult[]> {
  const q = text.trim()
  if (!q) return []
  const [best, all] = await Promise.all([fetchList('bestsearch', q), fetchList('search', q)])
  const seen = new Set<number>()
  return [...best, ...all].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 40)
}
