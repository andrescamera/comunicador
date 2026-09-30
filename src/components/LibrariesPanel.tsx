import { useEffect, useState } from 'react'
import { emptyLibrary, starterLibrary } from '../lib/generator'
import type { LibraryInfo, Role } from '../lib/libraries'
import { type CloudSync, STARTER_NAME } from '../lib/useCloudSync'
import { Modal } from './Modal'

interface Props {
  cloud: CloudSync
  onClose: () => void
  /** Crear un tablero nuevo desde texto o foto (se abre el creador sobre un tablero vacío) */
  onCreateFromText: () => void
}

const ROLE_TEXT: Record<Exclude<Role, 'owner'>, string> = { editor: 'puede editar', viewer: 'solo usar' }

/** Mis tableros: los propios y los que me han compartido. Abrir, crear, renombrar, compartir... */
export function LibrariesPanel({ cloud, onClose, onCreateFromText }: Props) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState<LibraryInfo | null>(null)
  const items = Object.values(cloud.registry?.items ?? {})
  const mine = items.filter((i) => i.role === 'owner')
  const shared = items.filter((i) => i.role !== 'owner')

  useEffect(() => {
    void cloud.refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const openAndClose = (id: string) => run(async () => (await cloud.open(id), onClose()))

  if (sharing) return <SharePanel cloud={cloud} info={sharing} onBack={() => setSharing(null)} onClose={onClose} />

  const card = (info: LibraryInfo) => {
    const active = info.id === cloud.activeId
    return (
      <li key={info.id} className={`library-card ${active ? 'active' : ''}`}>
        <div className="library-info">
          <strong>{info.name}</strong>
          <small className="muted">
            {info.role === 'owner' ? (info.synced ? 'Tuyo' : 'Tuyo · aún no se ha subido a la cuenta') : `De ${info.ownerEmail ?? 'otra persona'} · ${ROLE_TEXT[info.role]}`}
          </small>
        </div>
        <div className="library-actions">
          {active ? <span className="badge">Abierto</span> : <button type="button" className="primary" disabled={busy} onClick={() => void openAndClose(info.id)}>Abrir</button>}
          {info.role === 'owner' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const name = prompt('Nombre del tablero', info.name)
                if (name) void run(() => cloud.rename(info.id, name))
              }}
            >
              Renombrar
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void run(() => cloud.duplicate(info.id).then(onClose))}>Duplicar</button>
          {info.role === 'owner' && (
            <button type="button" disabled={busy || !cloud.email} title={cloud.email ? undefined : 'Inicia sesión para compartir'} onClick={() => setSharing(info)}>
              Compartir
            </button>
          )}
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => {
              const q =
                info.role === 'owner'
                  ? `¿Borrar «${info.name}» y sus carpetas? También dejarán de verlo las personas con quien lo compartiste. No se puede deshacer.`
                  : `¿Dejar de ver «${info.name}»? Su dueño puede volver a compartírtelo.`
              if (confirm(q)) void run(() => cloud.remove(info.id))
            }}
          >
            {info.role === 'owner' ? 'Borrar' : 'Dejar de ver'}
          </button>
        </div>
      </li>
    )
  }

  return (
    <Modal title="Mis tableros" onClose={onClose} wide>
      <div className="libraries">
        <section className="library-new">
          <strong>Nuevo tablero</strong>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void run(async () => (await cloud.create(await starterLibrary(), STARTER_NAME), onClose()))}>
              De ejemplo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const name = prompt('Nombre del tablero nuevo', 'Nuevo tablero')
                if (name !== null) void run(async () => (await cloud.create(emptyLibrary(), name), onClose()))
              }}
            >
              Vacío
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const name = prompt('Nombre del tablero nuevo', 'Nuevo tablero')
                if (name !== null) void run(async () => (await cloud.create(emptyLibrary(), name), onCreateFromText()))
              }}
            >
              ✨ Desde texto o foto
            </button>
          </div>
        </section>
        {error && <p className="error">{error}</p>}
        <ul className="library-list">{mine.map(card)}</ul>
        {shared.length > 0 && (
          <>
            <h3>Compartidos conmigo</h3>
            <ul className="library-list">{shared.map(card)}</ul>
          </>
        )}
        {!cloud.email && <p className="muted">Sin sesión iniciada: los tableros solo están en este dispositivo.</p>}
      </div>
    </Modal>
  )
}

/** Compartir un tablero por email, con permiso de editar o solo usar */
function SharePanel({ cloud, info, onBack, onClose }: { cloud: CloudSync; info: LibraryInfo; onBack: () => void; onClose: () => void }) {
  const [address, setAddress] = useState('')
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('editor')
  const [people, setPeople] = useState<{ email: string; role: Exclude<Role, 'owner'> }[] | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      setPeople(await cloud.access(info.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      await fn()
      setMessage(ok)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Compartir «${info.name}»`} onClose={onClose} wide>
      <form
        className="share-form"
        onSubmit={(e) => {
          e.preventDefault()
          const to = address.trim()
          if (!to) return
          void run(
            () => cloud.share(info.id, to, role),
            `Compartido con ${to}. Si aún no tiene cuenta, lo verá cuando la cree con ese email (no se envía ningún correo: avísale tú).`,
          ).then(() => setAddress(''))
        }}
      >
        <label>
          Email de la otra persona
          <input type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="familia@ejemplo.com" autoFocus required />
        </label>
        <label>
          Permiso
          <select value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, 'owner'>)}>
            <option value="editor">Puede editar (terapeutas, familia que prepara tableros)</option>
            <option value="viewer">Solo usar (no puede cambiar nada)</option>
          </select>
        </label>
        <button type="submit" className="primary" disabled={busy || !address.trim()}>
          Compartir
        </button>
      </form>
      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
      <h3>Con acceso</h3>
      {people === null ? (
        <p className="muted">Cargando…</p>
      ) : people.length === 0 ? (
        <p className="muted">Solo tú.</p>
      ) : (
        <ul className="library-list">
          {people.map((p) => (
            <li key={p.email} className="library-card">
              <div className="library-info">
                <strong>{p.email}</strong>
                <small className="muted">{ROLE_TEXT[p.role]}</small>
              </div>
              <div className="library-actions">
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`¿Quitar el acceso de ${p.email}?`)) void run(() => cloud.unshare(info.id, p.email), `${p.email} ya no tiene acceso.`)
                  }}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer className="modal-footer">
        <button type="button" onClick={onBack}>
          ◀ Volver a mis tableros
        </button>
      </footer>
    </Modal>
  )
}
