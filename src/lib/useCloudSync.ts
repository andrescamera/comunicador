import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  claimInvites,
  deleteRemote,
  fetchMyLibraries,
  fetchRootBoard,
  leaveRemote,
  type LibraryInfo,
  libraryAccess,
  migrateLibrary,
  newLibraryId,
  reconcile,
  type Registry,
  renameRemote,
  type Role,
  shareLibrary,
  unshareLibrary,
} from './libraries'
import { emptyMeta, type RemoteChanges, SyncEngine, type SyncMeta, type SyncStatus } from './sync'
import type { Board, Library } from './types'

/** Almacenamiento clave-valor del dispositivo (localStorage en la web, AsyncStorage en la tablet). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): void
  remove(key: string): void
}

const REG_KEY = 'comunicador:registry:v1'
const LEGACY_LIB_KEY = 'comunicador:library:v3' // versiones con un solo tablero
const LEGACY_META_KEY = 'comunicador:sync:v1'
const libKey = (id: string) => `comunicador:lib:${id}`
const metaKey = (id: string) => `comunicador:sync:${id}`

const DEFAULT_NAME = 'Mi tablero'
export const STARTER_NAME = 'Tablero de ejemplo'

async function readJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  try {
    const raw = await store.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

type LibUpdate = Library | null | ((l: Library | null) => Library | null)
type Current = { id: string; lib: Library | null } | null

interface Options {
  supabase: SupabaseClient
  store: KeyValueStore
  /** Tablero de ejemplo para quien empieza (o se queda sin ninguno) */
  makeStarter: () => Promise<Library>
  /** Se abrió otro tablero (o se sustituyó entero): limpiar frase, carpeta abierta... */
  onOpened?: () => void
  /** Tras cerrar sesión o borrar la cuenta */
  onSignedOut?: () => void
}

/**
 * Tableros del usuario y cuenta en la nube (mismo código en la web y en la tablet):
 * - Registro de tableros del dispositivo, el abierto y su contenido (siempre primero local).
 * - Inicio de sesión con email y contraseña; al entrar, se junta lo del dispositivo con la cuenta.
 * - Motor de sincronización del tablero abierto (y tiempo real).
 * - Crear, abrir, duplicar, renombrar, borrar y compartir tableros.
 */
export function useLibraries({ supabase, store, makeStarter, onOpened, onSignedOut }: Options) {
  const [registry, setRegistryState] = useState<Registry | null>(null)
  const regRef = useRef<Registry | null>(null)
  const [current, setCurrent] = useState<Current>(null)
  const curRef = useRef(current)
  curRef.current = current
  const [status, setStatus] = useState<SyncStatus>({ state: 'signed-out' })
  const [email, setEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false) // ya se sabe si hay sesión guardada
  const [userId, setUserId] = useState<string | null>(null)
  const [linked, setLinked] = useState(false) // lo del dispositivo ya se juntó con la cuenta
  const engine = useRef<SyncEngine | null>(null)
  const loaded = useRef<Promise<void> | null>(null)
  const onOpenedRef = useRef(onOpened)
  onOpenedRef.current = onOpened

  const saveRegistry = useCallback(
    (r: Registry) => {
      regRef.current = r
      setRegistryState(r)
      store.set(REG_KEY, JSON.stringify(r))
    },
    [store],
  )

  const loadLib = useCallback(
    async (id: string): Promise<Library | null> => {
      const saved = await readJson<Library>(store, libKey(id))
      if (saved) return migrateLibrary(saved)
      // Está en la cuenta pero no en este dispositivo: se descarga al sincronizar
      const root = regRef.current?.items[id]?.rootBoardId
      return root ? { rootId: root, boards: {} } : null
    },
    [store],
  )

  const openLocal = useCallback(
    async (id: string | null) => {
      const lib = id ? await loadLib(id) : null
      const next = id ? { id, lib } : null
      curRef.current = next
      setCurrent(next)
      onOpenedRef.current?.()
    },
    [loadLib],
  )

  const removeLocal = useCallback(
    (id: string) => {
      store.remove(libKey(id))
      store.remove(metaKey(id))
    },
    [store],
  )

  /** Un tablero nuevo en el dispositivo (se sube a la cuenta en la siguiente sincronización) */
  const addLocal = useCallback(
    (reg: Registry, lib: Library, name: string): Registry => {
      const id = newLibraryId()
      store.set(libKey(id), JSON.stringify(lib))
      return { ...reg, activeId: id, items: { ...reg.items, [id]: { id, name, role: 'owner' } } }
    },
    [store],
  )

  // Arranque: registro guardado; o, de versiones anteriores, el único tablero; o el de ejemplo
  useEffect(() => {
    if (loaded.current) return // StrictMode repite los efectos: no crear dos tableros de ejemplo
    loaded.current = (async () => {
      let reg = await readJson<Registry>(store, REG_KEY)
      if (!reg) {
        const legacy = await readJson<Library>(store, LEGACY_LIB_KEY)
        const legacyMeta = await readJson<SyncMeta & { userId?: string }>(store, LEGACY_META_KEY)
        if (legacy) {
          const id = legacyMeta?.libraryId ?? newLibraryId()
          store.set(libKey(id), JSON.stringify(legacy))
          if (legacyMeta?.libraryId) store.set(metaKey(id), JSON.stringify(legacyMeta))
          reg = {
            userId: legacyMeta?.libraryId ? legacyMeta.userId : undefined,
            activeId: id,
            items: { [id]: { id, name: DEFAULT_NAME, role: 'owner', synced: !!legacyMeta?.libraryId } },
          }
          store.remove(LEGACY_LIB_KEY)
          store.remove(LEGACY_META_KEY)
          store.remove('comunicador:library:v1') // restos de versiones aún más antiguas
          store.remove('comunicador:library:v2')
        } else {
          reg = addLocal({ activeId: null, items: {} }, await makeStarter(), STARTER_NAME)
        }
      }
      saveRegistry(reg)
      await openLocal(reg.activeId)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Junta lo del dispositivo con lo que tiene la cuenta (al entrar y cada vez que se refresca la lista) */
  const link = useCallback(
    async (uid: string) => {
      await loaded.current
      let reg = regRef.current!
      if (reg.userId && reg.userId !== uid) {
        // Otra cuenta en este dispositivo: fuera los tableros de la anterior
        Object.keys(reg.items).forEach(removeLocal)
        reg = { activeId: null, items: {} }
      }
      try {
        await claimInvites(supabase)
      } catch {
        // sin conexión: se reclamarán la próxima vez
      }
      let remote
      try {
        remote = await fetchMyLibraries(supabase)
      } catch {
        setStatus({ state: 'offline' })
        setTimeout(() => void link(uid), 15000)
        return
      }
      const result = reconcile(reg, remote, uid)
      result.drop.forEach(removeLocal)
      let next = result.registry
      if (!Object.keys(next.items).length) next = addLocal(next, await makeStarter(), STARTER_NAME)
      const before = curRef.current?.id ?? null
      saveRegistry(next)
      if (next.activeId !== before || (before && result.drop.includes(before))) await openLocal(next.activeId)
      setUserId(uid)
      setLinked(true)
    },
    [supabase, removeLocal, addLocal, makeStarter, saveRegistry, openLocal],
  )
  const linkRef = useRef(link)
  linkRef.current = link

  // Sesión
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null)
      setAuthReady(true)
      // Fuera del aviso de Supabase (no se deben hacer llamadas dentro de él)
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(() => void linkRef.current(session.user.id), 0)
      if (!session) {
        setLinked(false)
        setUserId(null)
        setStatus({ state: 'signed-out' })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [supabase])

  // Motor de sincronización del tablero abierto
  const activeInfo = current ? registry?.items[current.id] : undefined
  const readOnly = activeInfo?.role === 'viewer'
  useEffect(() => {
    if (!linked || !current) return
    const id = current.id
    const e = new SyncEngine(supabase, {
      libraryId: id,
      readOnly,
      getLibraryName: () => regRef.current?.items[id]?.name ?? DEFAULT_NAME,
      getLibrary: () => (curRef.current?.id === id ? curRef.current.lib : null),
      // Se actualiza también la referencia al momento: el motor no debe trabajar con la versión
      // anterior mientras la interfaz aún no se ha vuelto a dibujar
      applyRemote: (c: RemoteChanges) => {
        const merge = (cur: Current): Current => {
          if (!cur || cur.id !== id) return cur
          const l = cur.lib ?? { rootId: c.rootId ?? '', boards: {} }
          const boards = { ...l.boards }
          for (const b of c.upserts) boards[b.id] = b
          for (const d of c.deletes) delete boards[d]
          const rootId = c.rootId && (boards[c.rootId] || !Object.keys(l.boards).length) ? c.rootId : l.rootId
          return { id, lib: { rootId, boards } }
        }
        curRef.current = merge(curRef.current)
        setCurrent(merge)
      },
      loadMeta: async () => ({ ...emptyMeta(), ...((await readJson<SyncMeta>(store, metaKey(id))) ?? {}) }),
      saveMeta: (m) => {
        store.set(metaKey(id), JSON.stringify(m))
        // Ya está en el servidor: si desaparece de la cuenta, es que se borró o se dejó de compartir
        const info = regRef.current?.items[id]
        if (m.libraryId === id && info && !info.synced)
          saveRegistry({ ...regRef.current!, items: { ...regRef.current!.items, [id]: { ...info, synced: true } } })
      },
      onStatus: setStatus,
    })
    engine.current = e
    void e.start()
    return () => {
      e.stop()
      if (engine.current === e) engine.current = null
    }
  }, [linked, current?.id, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambios locales: guardar en el dispositivo y subir a los ~2 s
  useEffect(() => {
    if (!current?.lib) return
    store.set(libKey(current.id), JSON.stringify(current.lib))
    engine.current?.notifyLocalChange()
  }, [current, store])

  // Alguien me comparte un tablero: la lista se actualiza sola
  useEffect(() => {
    if (!linked || !userId) return
    const channel = supabase
      .channel(`members-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_members', filter: `user_id=eq.${userId}` }, () =>
        setTimeout(() => void linkRef.current(userId), 300),
      )
      .subscribe()
    return () => void supabase.removeChannel(channel)
  }, [linked, userId, supabase])

  const renameLibrary = useCallback(
    async (id: string, name: string) => {
      const info = regRef.current?.items[id]
      const clean = name.trim()
      if (!info || !clean || info.role === 'viewer' || info.name === clean) return
      saveRegistry({ ...regRef.current!, items: { ...regRef.current!.items, [id]: { ...info, name: clean } } })
      if (info.synced) await renameRemote(supabase, id, clean)
    },
    [supabase, saveRegistry],
  )

  // Un solo nombre: si se cambia el de la pantalla principal (en modo edición), el tablero
  // pasa a llamarse igual en «Mis tableros» y al compartir
  const rootName = current?.lib?.boards[current.lib.rootId]?.name
  const lastRoot = useRef<{ id: string; name?: string } | null>(null)
  useEffect(() => {
    if (!current) return
    const prev = lastRoot.current
    lastRoot.current = { id: current.id, name: rootName }
    if (!prev || prev.id !== current.id || !prev.name || !rootName || prev.name === rootName) return
    const id = current.id
    const t = setTimeout(() => void renameLibrary(id, rootName).catch(() => {}), 800)
    return () => clearTimeout(t)
  }, [current?.id, rootName]) // eslint-disable-line react-hooks/exhaustive-deps

  const setLib = useCallback((update: LibUpdate) => {
    setCurrent((c) => {
      if (!c) return c
      const lib = typeof update === 'function' ? update(c.lib) : update
      const next = { id: c.id, lib }
      curRef.current = next
      return next
    })
  }, [])

  const wipeLocal = useCallback(() => {
    for (const id of Object.keys(regRef.current?.items ?? {})) removeLocal(id)
    store.remove(REG_KEY)
  }, [store, removeLocal])

  const requireOnline = () => {
    if (!userId) throw new Error('Hace falta iniciar sesión y conexión para esto.')
    return userId
  }

  return {
    // Cuenta
    status,
    email,
    authReady,
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
      await supabase.auth.signOut()
      onSignedOut?.()
    },
    /** RGPD: borra la cuenta y todos sus tableros del servidor */
    deleteAccount: async () => {
      const { error } = await supabase.rpc('delete_my_account')
      if (error) throw new Error(error.message)
      engine.current?.stop()
      await supabase.auth.signOut()
      onSignedOut?.()
    },
    syncNow: () => engine.current?.sync(),
    wipeLocal,

    // Tableros
    ready: current !== null || (registry !== null && registry.activeId === null),
    registry,
    active: activeInfo ?? null,
    activeId: current?.id ?? null,
    readOnly,
    lib: current?.lib ?? null,
    /** Aún no ha llegado del servidor (tablero de la cuenta abierto por primera vez aquí) */
    downloading: !!current?.lib && Object.keys(current.lib.boards).length === 0 && !!activeInfo?.synced,
    setLib,
    open: async (id: string) => {
      if (!regRef.current?.items[id] || id === curRef.current?.id) return
      saveRegistry({ ...regRef.current, activeId: id })
      await openLocal(id)
    },
    /** Tablero nuevo (vacío, de ejemplo o generado) que queda abierto */
    create: async (lib: Library, name: string) => {
      saveRegistry(addLocal(regRef.current ?? { activeId: null, items: {} }, lib, name.trim() || DEFAULT_NAME))
      await openLocal(regRef.current!.activeId)
    },
    duplicate: async (id: string) => {
      const info = regRef.current?.items[id]
      const lib = id === curRef.current?.id ? curRef.current.lib : await loadLib(id)
      if (!info || !lib || !Object.keys(lib.boards).length) throw new Error('Abre el tablero una vez (para descargarlo) antes de duplicarlo.')
      saveRegistry(addLocal(regRef.current!, lib, `${info.name} (copia)`))
      await openLocal(regRef.current!.activeId)
    },
    rename: async (id: string, name: string) => {
      await renameLibrary(id, name)
      // Si es el abierto, su pantalla principal se llama igual (es el título que se ve arriba)
      const clean = name.trim()
      if (clean && id === curRef.current?.id) {
        setLib((l) => (l && l.boards[l.rootId] ? { ...l, boards: { ...l.boards, [l.rootId]: { ...l.boards[l.rootId], name: clean } } } : l))
      }
    },
    /** Borrar (si es mío) o dejar de ver (si me lo compartieron) */
    remove: async (id: string) => {
      const info = regRef.current?.items[id]
      if (!info) return
      if (info.synced) {
        const uid = requireOnline()
        if (info.role === 'owner') await deleteRemote(supabase, id)
        else await leaveRemote(supabase, id, uid)
      }
      removeLocal(id)
      const { [id]: _gone, ...items } = regRef.current!.items
      let next: Registry = { ...regRef.current!, items, activeId: regRef.current!.activeId === id ? (Object.keys(items)[0] ?? null) : regRef.current!.activeId }
      if (!next.activeId) next = addLocal(next, await makeStarter(), STARTER_NAME)
      saveRegistry(next)
      if (curRef.current?.id !== next.activeId) await openLocal(next.activeId)
    },
    /** Volver a pedir la lista a la cuenta (p. ej. al abrir la vista de tableros) */
    refresh: async () => {
      if (userId) await link(userId)
    },
    share: async (id: string, address: string, role: Exclude<Role, 'owner'>) => {
      requireOnline()
      await engine.current?.sync() // que el tablero exista en el servidor antes de compartirlo
      if (!regRef.current?.items[id]?.synced) throw new Error('El tablero aún no se ha subido a la cuenta. Espera unos segundos y vuelve a intentarlo.')
      await shareLibrary(supabase, id, address, role)
    },
    unshare: async (id: string, address: string) => {
      requireOnline()
      await unshareLibrary(supabase, id, address)
    },
    /** Tablero principal para la vista previa: del dispositivo o, si no está, de la cuenta */
    preview: async (id: string): Promise<Board | null> => {
      const lib = id === curRef.current?.id ? curRef.current.lib : await readJson<Library>(store, libKey(id))
      if (lib?.boards[lib.rootId]) return lib.boards[lib.rootId]
      const info = regRef.current?.items[id]
      if (!info?.synced || !info.rootBoardId || !userId) return null
      try {
        return await fetchRootBoard(supabase, id, info.rootBoardId)
      } catch {
        return null
      }
    },
    access: async (id: string) => (regRef.current?.items[id]?.synced ? libraryAccess(supabase, id) : []),
  }
}

export type CloudSync = ReturnType<typeof useLibraries>
export type { LibraryInfo }

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
