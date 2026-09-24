import { useMemo, useState } from 'react'
import { generateLibrary, parseText, SAMPLE_TEXT } from '../lib/generator'
import type { Cell, Library } from '../lib/types'
import { BoardGrid } from './BoardGrid'
import { CellEditor } from './CellEditor'
import { Modal } from './Modal'

const EXAMPLES: { name: string; text: string }[] = [
  { name: 'Lista de palabras', text: 'Desayuno: yo, querer, más, leche, galletas, zumo, cereales, tostada, terminado, no, "no me gusta"' },
  { name: 'Texto libre', text: 'Recreo: quiero jugar con mis amigos a la pelota en el tobogán y comer el bocadillo' },
  { name: 'Varios tableros', text: SAMPLE_TEXT },
]

interface Props {
  onReplace: (lib: Library) => void
  onAddAsFolder: (lib: Library) => void
  currentBoardName: string
  onClose: () => void
}

export function Creator({ onReplace, onAddAsFolder, currentBoardName, onClose }: Props) {
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [preview, setPreview] = useState<Library | null>(null)
  const [tab, setTab] = useState<string>('')
  const [editing, setEditing] = useState<Cell | null>(null)

  const parsed = useMemo(() => parseText(text), [text])
  const wordCount = parsed.reduce((n, b) => n + b.items.length, 0)

  const generate = async () => {
    setProgress({ done: 0, total: 1 })
    const lib = await generateLibrary(parsed, (done, total) => setProgress({ done, total }))
    setProgress(null)
    setPreview(lib)
    setTab(lib.rootId)
  }

  const updateCell = (updated: Cell) => {
    if (!preview) return
    const board = preview.boards[tab]
    setPreview({
      ...preview,
      boards: { ...preview.boards, [tab]: { ...board, cells: board.cells.map((c) => (c.id === updated.id ? updated : c)) } },
    })
    setEditing(null)
  }
  const deleteCell = (id: string) => {
    if (!preview) return
    const board = preview.boards[tab]
    setPreview({ ...preview, boards: { ...preview.boards, [tab]: { ...board, cells: board.cells.filter((c) => c.id !== id) } } })
    setEditing(null)
  }

  const board = preview?.boards[tab]
  const missing = preview ? Object.values(preview.boards).flatMap((b) => b.cells).filter((c) => !c.picto).length : 0

  return (
    <Modal title="Crear tableros desde texto" onClose={onClose} wide>
      {!preview ? (
        <div className="creator">
          <p className="muted">
            Una línea por tablero: <code>nombre: palabras</code>. Separa con comas para decidir tú cada celda, o escribe texto libre y se extraen
            las palabras clave. Usa <code>"comillas"</code> para una frase completa en una celda. La primera línea es el tablero principal; las
            demás aparecen como carpetas.
          </p>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex.name} type="button" onClick={() => setText(ex.text)}>
                Ejemplo: {ex.name}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={'Desayuno: yo, querer, leche, galletas, más, terminado\nParque: columpio, tobogán, arena, "otra vez"'}
            autoFocus
          />
          {parsed.length > 0 && (
            <div className="parsed">
              {parsed.map((b, i) => (
                <div key={i}>
                  <strong>{b.name}</strong>
                  {i > 0 && <span className="muted"> (carpeta)</span>}: {b.items.map((it) => (it.kind === 'phrase' ? `“${it.label}”` : it.label)).join(' · ')}
                </div>
              ))}
            </div>
          )}
          <footer className="modal-footer">
            <span className="muted">
              {parsed.length} tablero{parsed.length === 1 ? '' : 's'}, {wordCount} celdas
            </span>
            <span className="spacer" />
            <button type="button" className="primary" disabled={!wordCount || !!progress} onClick={generate}>
              {progress ? `Buscando pictogramas… ${Math.round((progress.done / progress.total) * 100)}%` : 'Generar tableros'}
            </button>
          </footer>
        </div>
      ) : (
        <div className="creator-preview">
          <div className="tabs">
            {Object.values(preview.boards).map((b) => (
              <button key={b.id} type="button" className={b.id === tab ? 'active' : ''} onClick={() => setTab(b.id)}>
                {b.name}
              </button>
            ))}
          </div>
          <p className="muted">
            Revisa el resultado. Pulsa una celda para cambiar su pictograma, texto o color.
            {missing > 0 && <strong> {missing} celda(s) sin pictograma.</strong>}
          </p>
          {board && (
            <div className="preview-grid">
              <BoardGrid board={board} editing onTap={() => {}} onEdit={setEditing} />
            </div>
          )}
          <footer className="modal-footer">
            <button type="button" onClick={() => setPreview(null)}>◀ Volver al texto</button>
            <span className="spacer" />
            <button type="button" onClick={() => onAddAsFolder(preview)}>Añadir como carpeta en «{currentBoardName}»</button>
            <button type="button" className="primary" onClick={() => onReplace(preview)}>Usar como tablero principal</button>
          </footer>
        </div>
      )}
      {editing && (
        <CellEditor cell={editing} onSave={updateCell} onDelete={() => deleteCell(editing.id)} onClose={() => setEditing(null)} />
      )}
    </Modal>
  )
}
