import { useState } from 'react'
import { generateLibrary, parseText } from '../lib/generator'
import { type Area, importCells, type ImportResult } from '../lib/layout'
import { gridToText } from '../lib/photo'
import type { Board, Category, Cell } from '../lib/types'
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
  /** Un «más»: todas sus fichas son de la categoría de su grupo (p. ej. Social) */
  category?: Category
  onAdd: (result: ImportResult) => void
  onClose: () => void
}

/** Fichas desde una foto: se leen (en este ordenador), se revisan y se añaden al tablero abierto, cada una en su casilla */
export function PhotoImport({ board, isRoot, zone, category, onAdd, onClose }: Props) {
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
      const read = lib.boards[lib.rootId]
      // Las posiciones de la imagen cuentan desde la esquina de la zona donde se abre (si la hay),
      // y en un «más», todas son de la categoría de su grupo
      setPreview({
        ...read,
        cells: read.cells.map((c) => ({
          ...c,
          ...(category && c.kind !== 'folder' ? { category } : {}),
          row: c.row + (zone?.r0 ?? 0),
          col: c.col + (zone?.c0 ?? 0),
        })),
      })
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
          {!preview && <p className="muted">
            Una foto o captura de un tablero o de una página (mejor recortada a la cuadrícula). Se cargan las fichas de ese nivel en
            «{board.name}», cada una en la misma casilla que en la foto si está libre. El texto se lee en este ordenador: la imagen no se
            envía a ningún sitio.
          </p>}
          {error && <p className="error">{error}</p>}
        </div>

        {preview && result && (
          <>
            <p className="muted">Revisa lo leído: pulsa una ficha para corregir su texto o pictograma, o para quitarla.</p>
            <div className="preview-grid import-preview">
              <BoardGrid board={previewShown(preview, zone)} editing onTap={() => {}} onEdit={setEditing} />
            </div>
            <ul className="import-summary">
              <li>
                <strong>{result.added.length}</strong> fichas nuevas para «{board.name}»
                {result.moved.length > result.outside.length && (
                  <> · {result.moved.length - result.outside.length} van a otro hueco porque su casilla ya está ocupada: {result.moved.filter((l) => !result.outside.includes(l)).join(', ')}</>
                )}
                {result.outside.length > 0 && (
                  <> · {result.outside.length} van a otro hueco porque su casilla queda fuera de {zone ? 'la zona donde se abre' : 'el tablero'}: {result.outside.join(', ')}</>
                )}
              </li>
              {result.skipped.length > 0 && <li className="muted">Ya están en «{board.name}» (no se repiten): {result.skipped.join(', ')}</li>}
              {result.noRoom.length > 0 && <li className="error">No caben (no quedan huecos{zone ? ' en la zona donde se abre' : ''}): {result.noRoom.join(', ')}</li>}
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
          onSave={(c) => update((cells) => cells.map((x) => (x.id === c.id ? { ...c, row: x.row, col: x.col } : x)))}
          onDelete={() => update((cells) => cells.filter((x) => x.id !== editing.id))}
          onClose={() => setEditing(null)}
        />
      )}
    </Modal>
  )
}

/** La vista previa, solo con la zona (las posiciones ya están desplazadas a ella) */
function previewShown(preview: Board, zone: Area | null): Board {
  if (!zone) return preview
  const rows = Math.max(zone.r1 - zone.r0 + 1, ...preview.cells.map((c) => c.row - zone.r0 + 1))
  const cols = Math.max(zone.c1 - zone.c0 + 1, ...preview.cells.map((c) => c.col - zone.c0 + 1))
  return { ...preview, rows, cols, cells: preview.cells.map((c) => ({ ...c, row: c.row - zone.r0, col: c.col - zone.c0 })) }
}
