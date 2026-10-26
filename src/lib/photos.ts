import type { SupabaseClient } from '@supabase/supabase-js'
import { uid } from './types'

/**
 * Fotos propias de las fichas (en lugar del pictograma). Se guardan en un espacio privado de la
 * cuenta, una carpeta por tablero («<tablero>/<foto>.jpg»). Para mostrarlas se pide un enlace
 * temporal, que se reutiliza mientras dura.
 */
export const PHOTO_BUCKET = 'fotos'
const LIFETIME = 60 * 60 // segundos

const cache = new Map<string, { url: string; until: number }>()
const pending = new Map<string, Promise<string | null>>()

/** Enlace temporal para ver la foto (null si no se puede: sin sesión, sin permiso o sin conexión) */
export function photoUrl(sb: SupabaseClient, path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url)
  const inFlight = pending.get(path)
  if (inFlight) return inFlight
  const p = sb.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, LIFETIME)
    .then(({ data }) => {
      if (data?.signedUrl) cache.set(path, { url: data.signedUrl, until: Date.now() + (LIFETIME - 120) * 1000 })
      return data?.signedUrl ?? null
    })
    .catch(() => null)
    .finally(() => pending.delete(path))
  pending.set(path, p)
  return p
}

/** Sube una foto (ya reducida) al tablero `libraryId` y devuelve su ruta, que se guarda en la ficha */
export async function uploadPhoto(sb: SupabaseClient, libraryId: string, data: Blob | ArrayBuffer, contentType = 'image/jpeg'): Promise<string> {
  const path = `${libraryId}/${uid('foto')}.jpg`
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, data, { contentType, upsert: false })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)
  return path
}
