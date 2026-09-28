import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Board, Library } from './types'

/**
 * Sincronización de tableros con Supabase (misma lógica en la web y en la tablet).
 *
 * - Primero local: el dispositivo trabaja siempre con su copia; la red nunca bloquea.
 * - Por tablero: se compara el estado actual con el último sincronizado (huella del contenido
 *   y fecha del servidor) para saber qué cambió en cada lado.
 * - Conflicto (el mismo tablero cambió en los dos sitios): gana el cambio más reciente y la
 *   versión perdedora se guarda en `board_backups`.
 * - Borrados marcados (`deleted`) para que no "resuciten" desde otro dispositivo.
 */

export interface SyncedBoard {
  hash: string // huella del contenido sincronizado
  remoteAt: string // updated_at del servidor para esa versión
}

export interface SyncMeta {
  userId?: string
  libraryId?: string
  rootSynced?: string
  boards: Record<string, SyncedBoard>
  dirtySince: Record<string, number> // primer cambio local todavía sin subir
  firstLinkDone?: boolean // ya se decidió qué hacer con los tableros de este dispositivo
}

export const emptyMeta = (): SyncMeta => ({ boards: {}, dirtySince: {} })

export interface RemoteBoard {
  id: string
  data: Board | null
  updated_at: string
  deleted: boolean
}

export type SyncAction =
  | { type: 'push'; id: string; board: Board }
  | { type: 'pushDelete'; id: string }
  | { type: 'pull'; id: string; board: Board; remoteAt: string }
  | { type: 'pullDelete'; id: string; remoteAt: string }
  | { type: 'backup'; id: string; board: Board; at: string }
  | { type: 'settle'; id: string; hash: string; remoteAt: string } // ya iguales: solo actualizar la meta

/** Huella rápida del contenido de un tablero (djb2 sobre su JSON). */
export function hashBoard(b: Board): string {
  const s = JSON.stringify(b)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + s.length
}

/** Decide qué hacer con cada tablero. Función pura (sin red): es la parte con tests. */
export function planSync(local: Library, remote: RemoteBoard[], meta: SyncMeta, now = Date.now()): SyncAction[] {
  const remoteById = new Map(remote.map((r) => [r.id, r]))
  const ids = new Set([...Object.keys(local.boards), ...remoteById.keys(), ...Object.keys(meta.boards)])
  const actions: SyncAction[] = []

  for (const id of ids) {
    const L = local.boards[id]
    const R = remoteById.get(id)
    const S = meta.boards[id]
    const localChanged = L ? !S || hashBoard(L) !== S.hash : !!S
    const remoteChanged = R ? !S || R.updated_at !== S.remoteAt : false
    const remoteAlive = !!R && !R.deleted && !!R.data

    if (!localChanged && !remoteChanged) continue

    // Mismo contenido en los dos lados (p. ej. tras una primera sincronización): nada que mover
    if (L && remoteAlive && hashBoard(L) === hashBoard(R!.data!)) {
      actions.push({ type: 'settle', id, hash: hashBoard(L), remoteAt: R!.updated_at })
      continue
    }
    if (!L && R && !remoteAlive) {
      // Borrado en los dos lados
      if (S) actions.push({ type: 'pullDelete', id, remoteAt: R.updated_at })
      continue
    }

    if (localChanged && !remoteChanged) {
      if (L) actions.push({ type: 'push', id, board: L })
      else if (remoteAlive) actions.push({ type: 'pushDelete', id })
      continue
    }
    if (!localChanged && remoteChanged) {
      if (remoteAlive) actions.push({ type: 'pull', id, board: R!.data!, remoteAt: R!.updated_at })
      else if (L) actions.push({ type: 'pullDelete', id, remoteAt: R!.updated_at })
      continue
    }

    // Conflicto: cambió en los dos lados. Gana el más reciente; el otro se guarda como copia.
    const localTime = meta.dirtySince[id] ?? now
    const remoteTime = Date.parse(R!.updated_at)
    if (localTime > remoteTime) {
      if (remoteAlive) actions.push({ type: 'backup', id, board: R!.data!, at: R!.updated_at })
      actions.push(L ? { type: 'push', id, board: L } : { type: 'pushDelete', id })
    } else {
      if (L) actions.push({ type: 'backup', id, board: L, at: new Date(localTime).toISOString() })
      actions.push(remoteAlive ? { type: 'pull', id, board: R!.data!, remoteAt: R!.updated_at } : { type: 'pullDelete', id, remoteAt: R!.updated_at })
    }
  }
  return actions
}

/** Anota cuándo empezó cada cambio local pendiente (sirve para decidir conflictos). */
export function markDirty(local: Library, meta: SyncMeta, now = Date.now()): boolean {
  let changed = false
  for (const [id, b] of Object.entries(local.boards)) {
    const S = meta.boards[id]
    if ((!S || S.hash !== hashBoard(b)) && meta.dirtySince[id] === undefined) {
      meta.dirtySince[id] = now
      changed = true
    }
  }
  for (const id of Object.keys(meta.boards)) {
    if (!local.boards[id] && meta.dirtySince[id] === undefined) {
      meta.dirtySince[id] = now
      changed = true
    }
  }
  return changed
}

export type SyncStatus =
  | { state: 'signed-out' }
  | { state: 'syncing' }
  | { state: 'synced'; at: number }
  | { state: 'offline' }
  | { state: 'error'; message: string }
  | { state: 'choose'; remoteBoards: number; localBoards: number } // primera vez, con tableros en los dos lados

export interface RemoteChanges {
  upserts: Board[]
  deletes: string[]
  rootId?: string
}

export interface SyncIO {
  getLibrary(): Library | null
  /** Aplicar cambios del servidor sobre el estado actual (sin pisar ediciones hechas mientras tanto). */
  applyRemote(changes: RemoteChanges): void
  /** Sustituir la biblioteca entera (primera vez: usar la de la cuenta). */
  replaceLibrary(lib: Library): void
  loadMeta(): Promise<SyncMeta>
  saveMeta(meta: SyncMeta): void
  onStatus(status: SyncStatus): void
}

export class SyncEngine {
  private meta: SyncMeta = emptyMeta()
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private again = false
  private channel: RealtimeChannel | null = null
  private stopped = false

  constructor(
    private sb: SupabaseClient,
    private io: SyncIO,
  ) {}

  async start(): Promise<void> {
    this.stopped = false
    this.meta = await this.io.loadMeta()
    const { data } = await this.sb.auth.getSession()
    if (!data.session) return this.io.onStatus({ state: 'signed-out' })
    if (this.meta.userId && this.meta.userId !== data.session.user.id) this.meta = emptyMeta() // otra cuenta
    this.meta.userId = data.session.user.id
    await this.sync()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.timer)
    if (this.channel) void this.sb.removeChannel(this.channel)
    this.channel = null
  }

  /** Llamar tras cada cambio local: se sube a los ~2 s, agrupando cambios seguidos. */
  notifyLocalChange(): void {
    const lib = this.io.getLibrary()
    if (!lib || !this.meta.userId) return
    if (markDirty(lib, this.meta)) this.io.saveMeta(this.meta)
    this.schedule(2000)
  }

  schedule(ms: number): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.sync(), ms)
  }

  /** Primera vez en este dispositivo con tableros en la cuenta y en el dispositivo. */
  async resolveFirstLink(choice: 'use-remote' | 'use-local'): Promise<void> {
    const libId = this.meta.libraryId
    const lib = this.io.getLibrary()
    if (!libId || !lib) return
    this.io.onStatus({ state: 'syncing' })
    const remote = await this.fetchBoards(libId)
    if (choice === 'use-remote') {
      // Los tableros del dispositivo se guardan como copia en la cuenta antes de sustituirlos
      await this.backup(libId, Object.values(lib.boards))
      const { data: libRow } = await this.sb.from('libraries').select('root_board_id').eq('id', libId).single()
      const boards = Object.fromEntries(remote.filter((r) => !r.deleted && r.data).map((r) => [r.id, r.data!]))
      this.meta.boards = Object.fromEntries(remote.filter((r) => !r.deleted && r.data).map((r) => [r.id, { hash: hashBoard(r.data!), remoteAt: r.updated_at }]))
      this.meta.dirtySince = {}
      this.meta.rootSynced = libRow?.root_board_id ?? lib.rootId
      this.io.replaceLibrary({ rootId: this.meta.rootSynced!, boards })
    } else {
      // Los de la cuenta se guardan como copia y se marcan como borrados; se suben los del dispositivo
      await this.backup(libId, remote.filter((r) => !r.deleted && r.data).map((r) => r.data!))
      const now = new Date().toISOString()
      const tomb = remote.filter((r) => !lib.boards[r.id]).map((r) => ({ library_id: libId, id: r.id, data: null, deleted: true, updated_at: now }))
      if (tomb.length) await this.check(this.sb.from('boards').upsert(tomb))
      this.meta.boards = {}
      this.meta.dirtySince = {}
      this.meta.rootSynced = undefined
    }
    this.meta.firstLinkDone = true
    this.io.saveMeta(this.meta)
    this.schedule(500) // tras sustituir los tableros, dar tiempo a que la app los aplique
  }

  async sync(): Promise<void> {
    if (this.stopped) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      const lib = this.io.getLibrary()
      const { data: auth } = await this.sb.auth.getSession()
      if (!auth.session) return this.io.onStatus({ state: 'signed-out' })
      if (!lib) return
      this.io.onStatus({ state: 'syncing' })

      const libId = await this.ensureLibrary(lib)
      const remote = await this.fetchBoards(libId)

      // Primera vez en este dispositivo y la cuenta ya tiene tableros: que decida el terapeuta
      const remoteAlive = remote.filter((r) => !r.deleted && r.data)
      if (!this.meta.firstLinkDone && Object.keys(this.meta.boards).length === 0 && remoteAlive.length > 0) {
        const localIds = Object.keys(lib.boards)
        if (localIds.some((id) => !remoteAlive.find((r) => r.id === id))) {
          return this.io.onStatus({ state: 'choose', remoteBoards: remoteAlive.length, localBoards: localIds.length })
        }
      }
      this.meta.firstLinkDone = true

      markDirty(lib, this.meta)
      const actions = planSync(lib, remote, this.meta)
      await this.apply(libId, actions)
      await this.syncRoot(libId, lib)
      this.io.saveMeta(this.meta)
      this.subscribe(libId)
      this.io.onStatus({ state: 'synced', at: Date.now() })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const offline = /fetch|network|Failed to fetch|Network request failed|timeout/i.test(message)
      this.io.onStatus(offline ? { state: 'offline' } : { state: 'error', message })
      this.schedule(offline ? 15000 : 30000) // reintento
    } finally {
      this.running = false
      if (this.again) {
        this.again = false
        this.schedule(300)
      }
    }
  }

  private async check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p
    if (error) throw new Error(error.message)
    return data
  }

  private async ensureLibrary(lib: Library): Promise<string> {
    if (this.meta.libraryId) return this.meta.libraryId
    const rows = await this.check(this.sb.from('libraries').select('id, root_board_id').limit(1))
    let id = (rows as { id: string }[])[0]?.id
    if (!id) {
      const created = await this.check(this.sb.from('libraries').insert({ root_board_id: lib.rootId }).select('id').single())
      id = (created as { id: string }).id
      this.meta.rootSynced = lib.rootId
    } else {
      this.meta.rootSynced = (rows as { root_board_id: string }[])[0].root_board_id
    }
    this.meta.libraryId = id
    this.io.saveMeta(this.meta)
    return id
  }

  private async fetchBoards(libId: string): Promise<RemoteBoard[]> {
    return (await this.check(this.sb.from('boards').select('id, data, updated_at, deleted').eq('library_id', libId))) as RemoteBoard[]
  }

  private async backup(libId: string, boards: Board[]): Promise<void> {
    if (!boards.length) return
    const now = new Date().toISOString()
    await this.check(this.sb.from('board_backups').insert(boards.map((b) => ({ library_id: libId, board_id: b.id, data: b, updated_at: now }))))
  }

  private async apply(libId: string, actions: SyncAction[]): Promise<void> {
    const now = new Date().toISOString()
    const pushes = actions.filter((a) => a.type === 'push' || a.type === 'pushDelete')
    const backups = actions.filter((a): a is Extract<SyncAction, { type: 'backup' }> => a.type === 'backup')

    if (backups.length) {
      await this.check(
        this.sb.from('board_backups').insert(backups.map((a) => ({ library_id: libId, board_id: a.id, data: a.board, updated_at: a.at }))),
      )
    }
    if (pushes.length) {
      const rows = pushes.map((a) =>
        a.type === 'push'
          ? { library_id: libId, id: a.id, data: a.board, deleted: false, updated_at: now }
          : { library_id: libId, id: a.id, data: null, deleted: true, updated_at: now },
      )
      await this.check(this.sb.from('boards').upsert(rows))
    }

    const upserts: Board[] = []
    const deletes: string[] = []
    for (const a of actions) {
      if (a.type === 'push') this.meta.boards[a.id] = { hash: hashBoard(a.board), remoteAt: now }
      else if (a.type === 'pushDelete') delete this.meta.boards[a.id]
      else if (a.type === 'pull') {
        upserts.push(a.board)
        this.meta.boards[a.id] = { hash: hashBoard(a.board), remoteAt: a.remoteAt }
      } else if (a.type === 'pullDelete') {
        deletes.push(a.id)
        delete this.meta.boards[a.id]
      } else if (a.type === 'settle') this.meta.boards[a.id] = { hash: a.hash, remoteAt: a.remoteAt }
      if (a.type !== 'backup') delete this.meta.dirtySince[a.id]
    }
    if (upserts.length || deletes.length) this.io.applyRemote({ upserts, deletes })
  }

  /** Tablero principal: el cambio más reciente gana (se guarda en la fila de la biblioteca). */
  private async syncRoot(libId: string, lib: Library): Promise<void> {
    const rows = (await this.check(this.sb.from('libraries').select('root_board_id').eq('id', libId))) as { root_board_id: string }[]
    const remoteRoot = rows[0]?.root_board_id
    if (lib.rootId !== this.meta.rootSynced) {
      await this.check(this.sb.from('libraries').update({ root_board_id: lib.rootId, updated_at: new Date().toISOString() }).eq('id', libId))
      this.meta.rootSynced = lib.rootId
    } else if (remoteRoot && remoteRoot !== this.meta.rootSynced) {
      this.meta.rootSynced = remoteRoot
      this.io.applyRemote({ upserts: [], deletes: [], rootId: remoteRoot })
    }
  }

  /** Tiempo real: cualquier cambio en el servidor dispara una sincronización. */
  private subscribe(libId: string): void {
    if (this.channel) return
    this.channel = this.sb
      .channel(`library-${libId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boards', filter: `library_id=eq.${libId}` }, () => this.schedule(400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'libraries', filter: `id=eq.${libId}` }, () => this.schedule(400))
      .subscribe()
  }
}
