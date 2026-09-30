import { describe, expect, it } from 'vitest'
import { emptyMeta, hashBoard, markDirty, planSync, type RemoteBoard, type SyncMeta } from './sync'
import type { Board, Library } from './types'

const board = (id: string, name = id): Board => ({
  id,
  name,
  rows: 1,
  cols: 1,
  zones: { A: [0, 0], B: [1, 0], C: [1, 0], D: [1, 0], E: [1, 0] },
  cells: [],
})
const lib = (...boards: Board[]): Library => ({ rootId: boards[0]?.id ?? 'x', boards: Object.fromEntries(boards.map((b) => [b.id, b])) })
const remote = (b: Board | null, id: string, at: string, deleted = false): RemoteBoard => ({ id, data: b, updated_at: at, deleted })
const synced = (...pairs: [Board, string][]): SyncMeta => ({
  ...emptyMeta(),
  boards: Object.fromEntries(pairs.map(([b, at]) => [b.id, { hash: hashBoard(b), remoteAt: at }])),
})
const kinds = (actions: { type: string; id: string }[]) => actions.map((a) => `${a.type}:${a.id}`).sort()

const T1 = '2026-09-28T10:00:00.000Z'
const T2 = '2026-09-28T11:00:00.000Z'

describe('planSync', () => {
  it('first sync of a new account uploads every local board', () => {
    expect(kinds(planSync(lib(board('a'), board('b')), [], emptyMeta()))).toEqual(['push:a', 'push:b'])
  })

  it('does nothing when nothing changed', () => {
    const a = board('a')
    expect(planSync(lib(a), [remote(a, 'a', T1)], synced([a, T1]))).toEqual([])
  })

  it('uploads a board edited on this device', () => {
    const a = board('a')
    expect(kinds(planSync(lib(board('a', 'nuevo')), [remote(a, 'a', T1)], synced([a, T1])))).toEqual(['push:a'])
  })

  it('downloads a board edited on the other device (e.g. on the computer)', () => {
    const a = board('a')
    const edited = board('a', 'editado en la web')
    const actions = planSync(lib(a), [remote(edited, 'a', T2)], synced([a, T1]))
    expect(actions).toEqual([{ type: 'pull', id: 'a', board: edited, remoteAt: T2 }])
  })

  it('downloads boards created elsewhere and deletions made elsewhere', () => {
    const a = board('a')
    const b = board('b')
    const actions = planSync(lib(a), [remote(null, 'a', T2, true), remote(b, 'b', T2)], synced([a, T1]))
    expect(kinds(actions)).toEqual(['pull:b', 'pullDelete:a'])
  })

  it('uploads a local deletion as a tombstone so it does not come back', () => {
    const a = board('a')
    expect(kinds(planSync(lib(board('r')), [remote(a, 'a', T1)], { ...synced([a, T1]) }))).toContain('pushDelete:a')
  })

  it('conflict: the newest change wins and the other version is backed up', () => {
    const base = board('a', 'base')
    const mine = board('a', 'tablet')
    const theirs = board('a', 'web')
    // cambio local a las 12:00, remoto a las 11:00 -> gana el local
    const meta = { ...synced([base, T1]), dirtySince: { a: Date.parse('2026-09-28T12:00:00.000Z') } }
    const localWins = planSync(lib(mine), [remote(theirs, 'a', T2)], meta)
    expect(localWins).toEqual([
      { type: 'backup', id: 'a', board: theirs, at: T2 },
      { type: 'push', id: 'a', board: mine },
    ])
    // cambio local a las 10:30, remoto a las 11:00 -> gana el remoto y el local queda como copia
    const meta2 = { ...synced([base, T1]), dirtySince: { a: Date.parse('2026-09-28T10:30:00.000Z') } }
    expect(kinds(planSync(lib(mine), [remote(theirs, 'a', T2)], meta2))).toEqual(['backup:a', 'pull:a'])
  })

  it('same content on both sides only settles the metadata', () => {
    const a = board('a')
    expect(kinds(planSync(lib(a), [remote(a, 'a', T2)], emptyMeta()))).toEqual(['settle:a'])
  })
})

describe('planSync en «solo usar»', () => {
  it('nunca sube nada: un cambio local se sustituye por lo del servidor', () => {
    const server = board('a', 'Servidor')
    const edited = board('a', 'Cambiado aquí')
    const actions = planSync(lib(edited, board('solo-aqui')), [remote(server, 'a', T1)], synced([server, T1]), Date.now(), true)
    expect(kinds(actions)).toEqual(['pull:a', 'pullDelete:solo-aqui'])
  })
  it('descarga lo que no tiene y deja igual lo que ya coincide', () => {
    const a = board('a')
    const b = board('b')
    const actions = planSync(lib(a), [remote(a, 'a', T1), remote(b, 'b', T2)], emptyMeta(), Date.now(), true)
    expect(kinds(actions)).toEqual(['pull:b', 'settle:a'])
  })
})

describe('markDirty', () => {
  it('records when a local change started, only once', () => {
    const a = board('a')
    const meta = synced([a, T1])
    const edited = lib(board('a', 'x'))
    expect(markDirty(edited, meta, 1000)).toBe(true)
    expect(markDirty(edited, meta, 5000)).toBe(false)
    expect(meta.dirtySince.a).toBe(1000)
  })
})
