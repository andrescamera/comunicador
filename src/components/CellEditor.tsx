import { useEffect, useState } from 'react'
import { searchPictos, type PictoResult } from '../lib/arasaac'
import { classify } from '../lib/grammar'
import { CATEGORY_LABELS, type Category, type Cell } from '../lib/types'
import { Modal } from './Modal'
import { Picto } from './Picto'

interface Props {
  cell: Cell
  isNew?: boolean
  onSave: (cell: Cell) => void
  onDelete?: () => void
  onMove?: (delta: -1 | 1) => void
  onClose: () => void
}

export function CellEditor({ cell, isNew, onSave, onDelete, onMove, onClose }: Props) {
  const [draft, setDraft] = useState<Cell>(cell)
  const [query, setQuery] = useState(cell.label)
  const [results, setResults] = useState<PictoResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) return setResults([])
    setLoading(true)
    const timer = window.setTimeout(async () => {
      const r = await searchPictos(q)
      setResults(r)
      setLoading(false)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const setLabel = (label: string) => {
    setDraft((d) => ({ ...d, label, category: d.kind === 'word' && isNew ? classify(label) : d.category }))
    setQuery(label)
  }

  return (
    <Modal title={isNew ? 'Nueva celda' : 'Editar celda'} onClose={onClose} wide>
      <div className="editor">
        <div className="editor-preview">
          <Picto id={draft.picto} alt={draft.label} />
          <span>{draft.label || '—'}</span>
        </div>
        <div className="editor-fields">
          <label>
            Texto
            <input value={draft.label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </label>
          {draft.kind !== 'folder' && (
            <div className="row">
              <label>
                Tipo
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Cell['kind'] })}>
                  <option value="word">Palabra (se conjuga)</option>
                  <option value="phrase">Frase hecha</option>
                </select>
              </label>
              <label>
                Categoría (color)
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label>
            Buscar pictograma
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="p. ej. galletas" />
          </label>
        </div>
      </div>
      <div className="picto-results">
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && query.trim() && <p className="muted">Sin resultados en ARASAAC.</p>}
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`picto-option ${draft.picto === r.id ? 'selected' : ''}`}
            onClick={() => setDraft({ ...draft, picto: r.id })}
            title={r.keyword}
          >
            <Picto id={r.id} alt={r.keyword} />
          </button>
        ))}
      </div>
      <footer className="modal-footer">
        {onDelete && <button type="button" className="danger" onClick={onDelete}>Eliminar</button>}
        {onMove && (
          <>
            <button type="button" onClick={() => onMove(-1)}>◀ Mover</button>
            <button type="button" onClick={() => onMove(1)}>Mover ▶</button>
          </>
        )}
        <span className="spacer" />
        <button type="button" onClick={onClose}>Cancelar</button>
        <button type="button" className="primary" disabled={!draft.label.trim()} onClick={() => onSave({ ...draft, label: draft.label.trim() })}>
          Guardar
        </button>
      </footer>
      <p className="credit">Pictogramas: Sergio Palao · ARASAAC (Gobierno de Aragón) · CC BY-NC-SA</p>
    </Modal>
  )
}
