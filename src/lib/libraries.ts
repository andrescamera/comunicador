import type { SupabaseClient } from '@supabase/supabase-js'
import { layoutCells } from './layout'
import type { Board, Library } from './types'

/**
 * Varios tableros por usuario. Para el usuario, un «tablero» es el tablero principal con sus
 * carpetas; en el código es una `Library` y en el servidor una fila de `libraries`.
 * Cada dispositivo guarda un registro con los tableros que conoce y cuál tiene abierto.
 */

export type Role = 'owner' | 'editor' | 'viewer'

export interface LibraryInfo {
  id: string // uuid: el mismo en el dispositivo y en el servidor
  name: string
  role: Role
  ownerEmail?: string // si es compartido: de quién es
  rootBoardId?: string // tablero principal según el servidor (para descargar uno que no está en el dispositivo)
  synced?: boolean // ya existe en el servidor (si desaparece de allí, se borró o se dejó de compartir)
}

export interface Registry {
  userId?: string // cuenta con la que se sincronizó por última vez
  activeId: string | null
  items: Record<string, LibraryInfo>
}

/** Fila de `my_libraries()` */
export interface RemoteLibrary {
  id: string
  name: string
  root_board_id: string
  role: Role
  owner_email: string
  updated_at: string
  created_at: string
}

export const canEdit = (info: Pick<LibraryInfo, 'role'> | null | undefined) => !info || info.role !== 'viewer'

/** uuid v4 (el servidor usa uuid como clave). `crypto.randomUUID` si existe; si no, a mano. */
export function newLibraryId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Junta lo que hay en el dispositivo con lo que dice el servidor. Función pura (con tests):
 * - Los del servidor se añaden o se actualizan (nombre, permiso, dueño).
 * - Uno que ya estuvo en el servidor y ya no está: se borró o se dejó de compartir -> fuera.
 * - Uno que nunca se subió: se queda (se subirá), salvo al entrar por primera vez en una cuenta
 *   que ya tiene tableros: entonces manda la cuenta (la tablet no tiene tableros propios).
 * Devuelve el registro nuevo y los ids que hay que borrar del dispositivo.
 */
export function reconcile(reg: Registry, remote: RemoteLibrary[], userId: string): { registry: Registry; drop: string[] } {
  const firstLink = reg.userId !== userId
  const byId = new Map(remote.map((r) => [r.id, r]))
  const items: Record<string, LibraryInfo> = {}
  const drop: string[] = []
  for (const [id, info] of Object.entries(reg.items)) {
    const r = byId.get(id)
    if (r) continue // se rellena abajo con los datos del servidor
    if (info.synced || (firstLink && remote.length > 0)) drop.push(id)
    else items[id] = info
  }
  for (const r of remote) {
    items[r.id] = {
      ...reg.items[r.id],
      id: r.id,
      name: r.name,
      role: r.role,
      ownerEmail: r.role === 'owner' ? undefined : r.owner_email,
      rootBoardId: r.root_board_id,
      synced: true,
    }
  }
  const ids = Object.keys(items)
  const firstOwned = remote.find((r) => r.role === 'owner')?.id
  const activeId = reg.activeId && items[reg.activeId] ? reg.activeId : (firstOwned ?? ids[0] ?? null)
  return { registry: { userId, activeId, items }, drop }
}

/** Tableros guardados en versiones antiguas sin posiciones fijas: se colocan una vez. */
export function migrateLibrary(lib: Library): Library {
  const boards: Record<string, Board> = {}
  for (const [id, b] of Object.entries(lib.boards)) {
    const cells = b.cells.map((c) => ({ ...c, label: c.label.normalize('NFC') }))
    const ok = b.rows && b.zones && cells.every((c) => Number.isInteger(c.row) && Number.isInteger(c.col))
    boards[id] = ok ? { ...b, cells } : { id: b.id, name: b.name, ...layoutCells(cells) }
  }
  return { ...lib, boards }
}

// ---------- Servidor ----------

async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}

export const fetchMyLibraries = async (sb: SupabaseClient) => ((await check(sb.rpc('my_libraries'))) ?? []) as RemoteLibrary[]
/** Las invitaciones a mi email pasan a ser acceso (al entrar) */
export const claimInvites = async (sb: SupabaseClient) => (await check(sb.rpc('claim_invites'))) as number
export const renameRemote = (sb: SupabaseClient, id: string, name: string) =>
  check(sb.from('libraries').update({ name, updated_at: new Date().toISOString() }).eq('id', id))
export const deleteRemote = (sb: SupabaseClient, id: string) => check(sb.from('libraries').delete().eq('id', id))
export const leaveRemote = (sb: SupabaseClient, id: string, userId: string) =>
  check(sb.from('library_members').delete().eq('library_id', id).eq('user_id', userId))
export const shareLibrary = (sb: SupabaseClient, id: string, email: string, role: Exclude<Role, 'owner'>) =>
  check(sb.rpc('share_library', { p_library: id, p_email: email, p_role: role }))
export const unshareLibrary = (sb: SupabaseClient, id: string, email: string) => check(sb.rpc('unshare_library', { p_library: id, p_email: email }))
export const libraryAccess = async (sb: SupabaseClient, id: string) =>
  ((await check(sb.rpc('library_access', { p_library: id }))) ?? []) as { email: string; role: Exclude<Role, 'owner'> }[]
