import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './cloudConfig'
import type { KeyValueStore } from './useCloudSync'

// Web: la sesión se guarda en el navegador (localStorage). Al volver del enlace de confirmación
// del email, la sesión viene en la dirección y se inicia sola.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Tableros y estado de sincronización guardados en el navegador */
export const webStore: KeyValueStore = {
  get: async (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // almacenamiento lleno o bloqueado: seguimos en memoria
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // nada que borrar
    }
  },
}
