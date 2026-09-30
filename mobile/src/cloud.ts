import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
import { type KeyValueStore, SUPABASE_KEY, SUPABASE_URL } from './shared'

// Tablet: la sesión se guarda en el almacenamiento de la app
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

// La sesión solo se renueva mientras la app está en primer plano (recomendación de Supabase)
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh()
  else void supabase.auth.stopAutoRefresh()
})

/** Tableros y estado de sincronización guardados en la tablet */
export const appStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key).catch(() => null),
  set: (key, value) => void AsyncStorage.setItem(key, value).catch(() => {}),
  remove: (key) => void AsyncStorage.removeItem(key).catch(() => {}),
}
