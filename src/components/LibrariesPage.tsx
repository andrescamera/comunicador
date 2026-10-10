import { useEffect, useState } from 'react'
import { pictoUrl } from '../lib/arasaac'
import { cellColors } from '../lib/colors'
import { emptyLibrary, starterLibrary } from '../lib/generator'
import { boardGroups, groupAt } from '../lib/layout'
import type { LibraryInfo, Role } from '../lib/libraries'
import type { Board, Library } from '../lib/types'
import { type CloudSync, STARTER_NAME } from '../lib/useCloudSync'
import { Modal } from './Modal'

interface Props {
  cloud: CloudSync
  /** Volver al tablero abierto */
  onBack: () => void
  /** Crear un tablero nuevo desde texto o foto (se abre el creador sobre un tablero vacío) */
  onCreateFromText: () => void
}

const ROLE_TEXT: Record<Exclude<Role, 'owner'>, string> = { editor: 'puede editar', viewer: 'solo usar' }

/**
 * Página «Mis tableros»: los propios y los compartidos conmigo, cada uno con una vista previa de
 * su tablero principal. Abrir, crear, renombrar, duplicar, compartir, borrar.
 */
export function LibrariesPage({ cloud, onBack, onCreateFromText }: Props) {
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
  const openAndBack = (id: string) => run(async () => (await cloud.open(id), onBack()))
  const create = (lib: () => Promise<Library> | Library, defaultName: string, then: () => void = onBack) => {
    const name = defaultName === STARTER_NAME ? defaultName : prompt('Nombre del tablero nuevo', defaultName)
    if (name !== null) void run(async () => (await cloud.create(await lib(), name), then()))
  }

  const card = (info: LibraryInfo) => {
    const active = info.id === cloud.activeId
    return (
      <li key={info.id} className={`library-card ${active ? 'active' : ''}`}>
        <button type="button" className="library-thumb" onClick={() => void openAndBack(info.id)} disabled={busy} aria-label={`Abrir ${info.name}`}>
          <BoardThumb id={info.id} cloud={cloud} />
        </button>
        <div className="library-info">
          <strong>{info.name}</strong>
          <small className="muted">
            {info.role === 'owner' ? (info.synced ? 'Tuyo' : 'Tuyo · aún no se ha subido a la cuenta') : `De ${info.ownerEmail ?? 'otra persona'} · ${ROLE_TEXT[info.role]}`}
          </small>
        </div>
        <div className="library-actions">
          {active ? (
            <button type="button" className="primary" onClick={onBack}>Abierto · volver</button>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={() => void openAndBack(info.id)}>Abrir</button>
          )}
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
          <button type="button" disabled={busy} onClick={() => void run(() => cloud.duplicate(info.id))}>Duplicar</button>
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
    <div className="libraries-page">
      <header className="libraries-header">
        <button type="button" onClick={onBack}>◀ Volver al tablero</button>
        <h1>Mis tableros</h1>
        <span className="spacer" />
        <div className="library-new">
          <span className="muted">Nuevo:</span>
          <button type="button" disabled={busy} onClick={() => create(starterLibrary, STARTER_NAME)}>De ejemplo</button>
          <button type="button" disabled={busy} onClick={() => create(emptyLibrary, 'Nuevo tablero')}>Vacío</button>
          <button type="button" className="primary" disabled={busy} onClick={() => create(emptyLibrary, 'Nuevo tablero', onCreateFromText)}>
            ✨ Desde texto o foto
          </button>
        </div>
      </header>
      <main className="libraries-body">
        {error && <p className="error">{error}</p>}
        <ul className="library-grid">{mine.map(card)}</ul>
        {shared.length > 0 && (
          <>
            <h2>Compartidos conmigo</h2>
            <ul className="library-grid">{shared.map(card)}</ul>
          </>
        )}
        {!cloud.email && <p className="muted">Sin sesión iniciada: los tableros solo están en este dispositivo.</p>}
      </main>
      {sharing && <SharePanel cloud={cloud} info={sharing} onClose={() => setSharing(null)} />}
    </div>
  )
}

/** Miniatura del tablero principal: la misma cuadrícula, con sus colores y pictogramas */
function BoardThumb({ id, cloud }: { id: string; cloud: CloudSync }) {
  const [board, setBoard] = useState<Board | null | undefined>(undefined)
  // Si se edita el tablero abierto, la miniatura se actualiza
  const version = id === cloud.activeId ? cloud.lib : null
  useEffect(() => {
    let cancelled = false
    void cloud.preview(id).then((b) => !cancelled && setBoard(b))
    return () => {
      cancelled = true
    }
  }, [id, version]) // eslint-disable-line react-hooks/exhaustive-deps

  if (board === undefined) return <div className="thumb thumb-empty">Cargando…</div>
  if (!board) return <div className="thumb thumb-empty">Sin vista previa</div>
  return (
    <>
    {board.dynamic?.enabled && <span className="thumb-badge">Dinámico</span>}
    <div className="thumb" style={{ gridTemplateColumns: `repeat(${board.cols}, 1fr)`, gridTemplateRows: `repeat(${board.rows}, 1fr)`, aspectRatio: `${board.cols} / ${board.rows}` }}>
      {(() => {
        const groups = boardGroups(board, true)
        return board.cells
        .filter((c) => !c.hidden)
        .map((c) => {
          const { bg, border } = cellColors(c.category, c.kind, c.folderColor, groupAt(groups, c.row, c.col)?.color)
          return (
            <div key={c.id} className="thumb-cell" style={{ gridRow: c.row + 1, gridColumn: c.col + 1, background: bg, borderColor: border }} title={c.label}>
              {c.textOnly || !c.picto ? <span>{c.label}</span> : <img src={pictoUrl(c.picto)} alt="" loading="lazy" draggable={false} />}
            </div>
          )
        })
      })()}
    </div>
    </>
  )
}

/** Compartir un tablero por email, con permiso de editar o solo usar */
function SharePanel({ cloud, info, onClose }: { cloud: CloudSync; info: LibraryInfo; onClose: () => void }) {
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
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Listo
        </button>
      </footer>
    </Modal>
  )
}
