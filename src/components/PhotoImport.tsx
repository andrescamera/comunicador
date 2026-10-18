import { useState } from 'react'
import { generateLibrary, parseText } from '../lib/generator'
import { type Area, importCells, type ImportResult } from '../lib/layout'
import { gridToText } from '../lib/photo'
import type { Board, Cell } from '../lib/types'
import { readBoardPhoto } from '../lib/webOcr'
import { BoardGrid } from './BoardGrid'
import { CellEditor } from './CellEditor'
import { Modal } from './Modal'

interface Props {
  /** El tablero que se está editando (el principal o una carpeta): ahí van las fichas */
  board: Board
  isRoot: boolean
  /** Si es una carpeta que se abre en la zona de carpetas: solo dentro de ella */
  zone: Area | null
  onAdd: (result: ImportResult) => void
  onClose: () => void
}

/** Fichas desde una foto: se leen (en este ordenador), se revisan y se añaden al tablero abierto, cada una en su casilla */
export function PhotoImport({ board, isRoot, zone, onAdd, onClose }: Props) {
  const [reading, setReading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<Board | null>(null)
  const [editing, setEditing] = useState<Cell | null>(null)

  const fromPhoto = async (file: File) => {
    setError('')
    setPreview(null)
    setReading('Leyendo la foto… 0%')
    try {
      const grid = await readBoardPhoto(file, (p) => setReading(`Leyendo la foto… ${Math.round(p * 100)}%`))
      if (!grid.cells.length) {
        setError('No se ha encontrado texto en la foto. Prueba con una imagen más nítida, de frente y recortada a la cuadrícula.')
        return
      }
      setPhotoUrl(URL.createObjectURL(file))
      setReading('Buscando pictogramas…')
      const lib = await generateLibrary(parseText(gridToText(grid), { grid: true }), (done, total) =>
        setReading(`Buscando pictogramas… ${Math.round((done / total) * 100)}%`),
      )
      setPreview(lib.boards[lib.rootId])
    } catch (e) {
      setError(`No se pudo leer la foto: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setReading(null)
    }
  }

  const result = preview ? importCells(board, preview.cells, { isRoot, zone }) : null
  const update = (fn: (cells: Cell[]) => Cell[]) => {
    setPreview((p) => (p ? { ...p, cells: fn(p.cells) } : p))
    setEditing(null)
  }

  return (
    <Modal title={`Cargar fichas desde una imagen · «${board.name}»`} onClose={onClose} wide>
      <div className="creator">
        <div className="photo-box">
          <div className="row">
            <label className="file-button">
              {reading ?? (preview ? 'Elegir otra imagen' : 'Elegir imagen')}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={!!reading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void fromPhoto(f)
                }}
              />
            </label>
            {photoUrl && <img src={photoUrl} alt="" className="photo-thumb" />}
          </div>
          <p className="muted">
            Una foto o captura de un tablero o de una página (mejor recortada a la cuadrícula). Se cargan las fichas de ese nivel en
            «{board.name}», cada una en la misma casilla que en la foto si está libre. El texto se lee en este ordenador: la imagen no se
            envía a ningún sitio.
          </p>
          {error && <p className="error">{error}</p>}
        </div>

        {preview && result && (
          <>
            <p className="muted">Revisa lo leído: pulsa una ficha para corregir su texto o pictograma, o para quitarla.</p>
            <div className="preview-grid">
              <BoardGrid board={preview} editing onTap={() => {}} onEdit={setEditing} />
            </div>
            <ul className="import-summary">
              <li>
                <strong>{result.added.length}</strong> fichas nuevas para «{board.name}»
                {result.moved.length > 0 && <> · {result.moved.length} van a otro hueco de su grupo porque su casilla ya está ocupada: {result.moved.join(', ')}</>}
              </li>
              {result.skipped.length > 0 && <li className="muted">Ya están en «{board.name}» (no se repiten): {result.skipped.join(', ')}</li>}
              {result.noRoom.length > 0 && <li className="error">No caben (no quedan huecos{zone ? ' en la zona de carpetas' : ''}): {result.noRoom.join(', ')}</li>}
            </ul>
            <p className="muted">Si alguna es una carpeta, márcala después en el tablero (pulsa la ficha → Tipo: carpeta) o en «📝 Texto».</p>
          </>
        )}
        <footer className="modal-footer">
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" disabled={!result?.added.length} onClick={() => result && onAdd(result)}>
            Añadir {result?.added.length ? `${result.added.length} fichas` : ''} a «{board.name}»
          </button>
        </footer>
      </div>
      {editing && (
        <CellEditor
          cell={editing}
          onSave={(c) => update((cells) => cells.map((x) => (x.id === c.id ? c : x)))}
          onDelete={() => update((cells) => cells.filter((x) => x.id !== editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </Modal>
  )
}
