import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { emptyMeta, type RemoteChanges, SyncEngine, type SyncMeta, type SyncStatus } from './sync'
import type { Library } from './types'

interface Options {
  supabase: SupabaseClient
  lib: Library | null
  setLib: (fn: (l: Library | null) => Library | null) => void
  loadMeta: () => Promise<SyncMeta>
  saveMeta: (m: SyncMeta) => void
  /** La biblioteca se sustituyó entera (p. ej. se eligieron los tableros de la cuenta) */
  onReplaced?: () => void
}

/**
 * Cuenta y sincronización en la nube (mismo código en la web y en la tablet):
 * inicio de sesión con email y contraseña, motor de sincronización y estado para la interfaz.
 */
export function useCloudSync({ supabase, lib, setLib, loadMeta, saveMeta, onReplaced }: Options) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'signed-out' })
  const [email, setEmail] = useState<string | null>(null)
  const libRef = useRef(lib)
  libRef.current = lib
  const engine = useRef<SyncEngine | null>(null)
  const onReplacedRef = useRef(onReplaced)
  onReplacedRef.current = onReplaced

  useEffect(() => {
    const e = new SyncEngine(supabase, {
      getLibrary: () => libRef.current,
      // Se actualiza también la referencia al momento: el motor no debe trabajar con la biblioteca
      // anterior mientras la interfaz aún no se ha vuelto a dibujar
      applyRemote: (c: RemoteChanges) => {
        const merge = (l: Library | null) => {
          if (!l) return l
          const boards = { ...l.boards }
          for (const b of c.upserts) boards[b.id] = b
          for (const id of c.deletes) delete boards[id]
          const rootId = c.rootId && boards[c.rootId] ? c.rootId : l.rootId
          return { rootId, boards }
        }
        libRef.current = merge(libRef.current)
        setLib(merge)
      },
      replaceLibrary: (next) => {
        libRef.current = next
        setLib(() => next)
        onReplacedRef.current?.()
      },
      loadMeta,
      saveMeta,
      onStatus: setStatus,
    })
    engine.current = e
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null)
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) void e.start()
      if (!session) {
        e.stop()
        setStatus({ state: 'signed-out' })
      }
    })
    return () => {
      data.subscription.unsubscribe()
      e.stop()
    }
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cada cambio local se sube a los ~2 s
  useEffect(() => {
    if (lib) engine.current?.notifyLocalChange()
  }, [lib])

  return {
    status,
    email,
    /** Entrar con email y contraseña */
    signIn: async (address: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email: address.trim(), password })
      if (error) throw new Error(translateAuthError(error.message))
    },
    /** Crear cuenta. Devuelve true si hay que confirmar el email antes de poder entrar. */
    signUp: async (address: string, password: string): Promise<boolean> => {
      const { data, error } = await supabase.auth.signUp({ email: address.trim(), password })
      if (error) throw new Error(translateAuthError(error.message))
      return !data.session
    },
    signOut: async () => {
      engine.current?.stop()
      saveMeta(emptyMeta()) // otra cuenta podrá entrar en este dispositivo; los tableros locales se quedan
      await supabase.auth.signOut()
    },
    /** RGPD: borra la cuenta y todos sus tableros del servidor (los del dispositivo se quedan) */
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw new Error(error.message)
      engine.current?.stop()
      saveMeta(emptyMeta())
      await supabase.auth.signOut()
    },
    syncNow: () => engine.current?.sync(),
  }
}

export type CloudSync = ReturnType<typeof useCloudSync>

/** Mensajes de Supabase más frecuentes, en castellano */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Falta confirmar el email: abre el mensaje que te enviamos y pulsa el enlace.'
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese email: usa «Entrar».'
  if (m.includes('password') && m.includes('6')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos seguidos. Espera unos minutos.'
  if (m.includes('fetch') || m.includes('network')) return 'Sin conexión. Comprueba internet e inténtalo de nuevo.'
  return message
}

export function statusText(s: SyncStatus): string {
  switch (s.state) {
    case 'signed-out':
      return 'Sin cuenta: los tableros solo están en este dispositivo'
    case 'syncing':
      return 'Sincronizando…'
    case 'synced':
      return `Sincronizado (${new Date(s.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})`
    case 'offline':
      return 'Sin conexión: los cambios se subirán al volver'
    case 'error':
      return `Error al sincronizar: ${s.message}`
  }
}
