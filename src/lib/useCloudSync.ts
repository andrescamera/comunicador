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
 * inicio de sesión con código por email, motor de sincronización y estado para la interfaz.
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
      applyRemote: (c: RemoteChanges) =>
        setLib((l) => {
          if (!l) return l
          const boards = { ...l.boards }
          for (const b of c.upserts) boards[b.id] = b
          for (const id of c.deletes) delete boards[id]
          const rootId = c.rootId && boards[c.rootId] ? c.rootId : l.rootId
          return { rootId, boards }
        }),
      replaceLibrary: (next) => {
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
    sendCode: async (address: string) => {
      const { error } = await supabase.auth.signInWithOtp({ email: address.trim(), options: { shouldCreateUser: true } })
      if (error) throw new Error(error.message)
    },
    verifyCode: async (address: string, code: string) => {
      const { error } = await supabase.auth.verifyOtp({ email: address.trim(), token: code.trim(), type: 'email' })
      if (error) throw new Error(error.message)
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
    resolveFirstLink: (choice: 'use-remote' | 'use-local') => engine.current?.resolveFirstLink(choice),
  }
}

export type CloudSync = ReturnType<typeof useCloudSync>

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
    case 'choose':
      return 'Elige qué tableros usar'
  }
}
