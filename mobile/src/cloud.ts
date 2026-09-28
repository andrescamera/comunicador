import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import { emptyMeta, SUPABASE_KEY, SUPABASE_URL, type SyncMeta } from './shared'

// Tablet: la sesión se guarda en el almacenamiento de la app
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

// La sesión solo se renueva mientras la app está en primer plano (recomendación de Supabase)
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh()
  else void supabase.auth.stopAutoRefresh()
})

const META_KEY = 'comunicador:sync:v1'
export const loadSyncMeta = async (): Promise<SyncMeta> => {
  try {
    return { ...emptyMeta(), ...JSON.parse((await AsyncStorage.getItem(META_KEY)) ?? '{}') }
  } catch {
    return emptyMeta()
  }
}
export const saveSyncMeta = (m: SyncMeta) => void AsyncStorage.setItem(META_KEY, JSON.stringify(m)).catch(() => {})
