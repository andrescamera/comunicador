import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './cloudConfig'
import { emptyMeta, type SyncMeta } from './sync'

// Web: la sesión se guarda en el navegador (localStorage)
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

const META_KEY = 'comunicador:sync:v1'
export const loadSyncMeta = async (): Promise<SyncMeta> => {
  try {
    return { ...emptyMeta(), ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') }
  } catch {
    return emptyMeta()
  }
}
export const saveSyncMeta = (m: SyncMeta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m))
  } catch {
    // sin almacenamiento: se resincroniza al volver a abrir
  }
}
