import { describe, expect, it } from 'vitest'
import { newLibraryId, reconcile, type Registry, type RemoteLibrary } from './libraries'

const remote = (id: string, role: RemoteLibrary['role'] = 'owner', name = id): RemoteLibrary => ({
  id,
  name,
  role,
  root_board_id: `root-${id}`,
  owner_email: role === 'owner' ? 'yo@x.com' : 'otra@x.com',
  updated_at: '2026-09-30T10:00:00Z',
  created_at: '2026-09-30T10:00:00Z',
})

describe('reconcile (dispositivo + cuenta)', () => {
  it('primera vez en una cuenta vacía: los del dispositivo se quedan (se subirán)', () => {
    const reg: Registry = { activeId: 'a', items: { a: { id: 'a', name: 'Ejemplo', role: 'owner' } } }
    const { registry, drop } = reconcile(reg, [], 'u1')
    expect(drop).toEqual([])
    expect(registry.items.a).toBeDefined()
    expect(registry.userId).toBe('u1')
  })

  it('primera vez en una cuenta con tableros: manda la cuenta (la tablet no tiene tableros propios)', () => {
    const reg: Registry = { activeId: 'local', items: { local: { id: 'local', name: 'Ejemplo', role: 'owner' } } }
    const { registry, drop } = reconcile(reg, [remote('r1'), remote('r2', 'editor')], 'u1')
    expect(drop).toEqual(['local'])
    expect(Object.keys(registry.items).sort()).toEqual(['r1', 'r2'])
    expect(registry.activeId).toBe('r1') // el primero propio
    expect(registry.items.r2).toMatchObject({ role: 'editor', ownerEmail: 'otra@x.com', rootBoardId: 'root-r2', synced: true })
  })

  it('misma cuenta: uno creado aquí sin subir se queda; uno ya subido que desaparece se quita', () => {
    const reg: Registry = {
      userId: 'u1',
      activeId: 'gone',
      items: {
        nuevo: { id: 'nuevo', name: 'Nuevo', role: 'owner' },
        gone: { id: 'gone', name: 'Borrado en otro sitio', role: 'owner', synced: true },
        r1: { id: 'r1', name: 'Viejo nombre', role: 'owner', synced: true },
      },
    }
    const { registry, drop } = reconcile(reg, [remote('r1', 'owner', 'Nombre nuevo')], 'u1')
    expect(drop).toEqual(['gone'])
    expect(Object.keys(registry.items).sort()).toEqual(['nuevo', 'r1'])
    expect(registry.items.r1.name).toBe('Nombre nuevo')
    expect(registry.activeId).toBe('r1') // el abierto desapareció: se abre otro
  })

  it('un tablero que me dejan de compartir desaparece de la lista', () => {
    const reg: Registry = { userId: 'u1', activeId: 'mio', items: { mio: { id: 'mio', name: 'Mío', role: 'owner', synced: true }, suyo: { id: 'suyo', name: 'Suyo', role: 'viewer', synced: true } } }
    const { registry, drop } = reconcile(reg, [remote('mio')], 'u1')
    expect(drop).toEqual(['suyo'])
    expect(registry.activeId).toBe('mio')
  })

  it('ids en formato uuid (los usa el servidor)', () => {
    expect(newLibraryId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
