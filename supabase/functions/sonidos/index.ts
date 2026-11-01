// Buscar sonidos en Freesound (solo CC0, cortos) para las fichas «Sonido».
// La clave de Freesound está en el Vault ('freesound_api_key'): la app nunca la ve.
// Solo para usuarios con sesión (verify_jwt). GET ?q=vaca → [{ id, name, duration, user, preview }]
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

let key: string | null = null
async function apiKey(): Promise<string> {
  if (key) return key
  const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 })
  try {
    const rows = await sql`select decrypted_secret from vault.decrypted_secrets where name = 'freesound_api_key' limit 1`
    key = rows[0]?.decrypted_secret ?? null
  } finally {
    await sql.end()
  }
  if (!key) throw new Error('Falta la clave de Freesound en el Vault')
  return key
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  // Solo con sesión iniciada (la clave pública de la app, sola, no basta)
  const user = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  })
  if (!user.ok) return json({ error: 'Inicia sesión para buscar sonidos' }, 401)
  const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 80)
  if (!q) return json([])
  try {
    const url = new URL('https://freesound.org/apiv2/search/text/')
    url.searchParams.set('query', q)
    url.searchParams.set('filter', 'license:"Creative Commons 0" duration:[0.5 TO 10]')
    url.searchParams.set('fields', 'id,name,duration,username,previews')
    // Los más descargados primero: es lo que mejor separa los sonidos limpios de las grabaciones raras
    url.searchParams.set('sort', 'downloads_desc')
    url.searchParams.set('page_size', '20')
    url.searchParams.set('token', await apiKey())
    const r = await fetch(url)
    if (!r.ok) return json({ error: `Freesound respondió ${r.status}` }, 502)
    const data = await r.json()
    return json(
      (data.results ?? []).map((s: { id: number; name: string; duration: number; username: string; previews: Record<string, string> }) => ({
        id: s.id,
        name: s.name,
        duration: Math.round(s.duration * 10) / 10,
        user: s.username,
        preview: s.previews['preview-hq-mp3'],
      })),
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
