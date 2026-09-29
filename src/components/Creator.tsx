import { useMemo, useState } from 'react'
import { buildFolder, generateLibrary, type GridSize, parseText, SAMPLE_TEXT } from '../lib/generator'
import { gridToText, type PhotoGrid } from '../lib/photo'
import { readBoardPhoto } from '../lib/webOcr'
import { GRID_SIZES } from '../lib/layout'
import type { Cell, Library } from '../lib/types'
import { BoardGrid } from './BoardGrid'
import { CellEditor } from './CellEditor'
import { Modal } from './Modal'

const EXAMPLES: { name: string; text: string }[] = [
  { name: 'Lista de palabras', text: 'Desayuno: yo, querer, más, leche, galletas, zumo, cereales, tostada, terminado, no, "no me gusta"' },
  { name: 'Texto libre', text: 'Recreo: quiero jugar con mis amigos a la pelota en el tobogán y comer el bocadillo' },
  { name: 'Con carpeta', text: 'Merienda: yo, querer, comer, beber, galletas, leche, más, terminado\ncarpeta Parque: columpio, tobogán, arena, "otra vez"' },
  { name: 'Tablero completo', text: SAMPLE_TEXT },
]

interface Props {
  onReplace: (lib: Library) => void
  onAddToCurrent: (lib: Library) => void
  onAddAsFolder: (lib: Library) => void
  currentBoardName: string
  onClose: () => void
}

export function Creator({ onReplace, onAddToCurrent, onAddAsFolder, currentBoardName, onClose }: Props) {
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [preview, setPreview] = useState<Library | null>(null)
  const [tab, setTab] = useState<string>('')
  const [editing, setEditing] = useState<Cell | null>(null)
  const [size, setSize] = useState<GridSize>('auto')
  // Mantener filas y columnas: cada línea es una fila y cada palabra entre comas, una columna
  const [gridMode, setGridMode] = useState(false)
  const [photo, setPhoto] = useState<{ url: string; grid: PhotoGrid } | null>(null)
  const [reading, setReading] = useState<number | null>(null) // progreso de la lectura (0–1)
  const [photoError, setPhotoError] = useState('')

  /** Foto de otro tablero -> texto leído en el navegador -> filas y columnas -> texto editable */
  const fromPhoto = async (file: File) => {
    setPhotoError('')
    setReading(0)
    try {
      const grid = await readBoardPhoto(file, setReading)
      if (!grid.cells.length) {
        setPhotoError('No se ha encontrado texto en la foto. Prueba con una imagen más nítida, de frente y recortada a la cuadrícula.')
        return
      }
      setPhoto({ url: URL.createObjectURL(file), grid })
      setGridMode(true)
      setText(gridToText(grid))
    } catch (e) {
      setPhotoError(`No se pudo leer la foto: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setReading(null)
    }
  }

  const parsed = useMemo(() => parseText(text, { grid: gridMode }), [text, gridMode])
  const wordCount = parsed.reduce((n, b) => n + b.items.length, 0)

  const generate = async () => {
    setProgress({ done: 0, total: 1 })
    const lib = await generateLibrary(parsed, (done, total) => setProgress({ done, total }), gridMode ? 'auto' : size)
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

  /** Una celda del resultado pasa a ser carpeta (vacía o con plantilla); se rellena después */
  const makeFolder = async (at: Cell, name: string, template: string | undefined, picto: number | undefined) => {
    if (!preview) return
    const root = preview.boards[preview.rootId]
    const { board: sub, cell } = await buildFolder(name, template, { rows: root.rows, cols: root.cols })
    const folder: Cell = { ...cell, id: at.id, label: name, picto: picto ?? cell.picto, category: at.category, row: at.row, col: at.col }
    setPreview((p) => {
      if (!p) return p
      const host = p.boards[tab]
      return { ...p, boards: { ...p.boards, [sub.id]: sub, [tab]: { ...host, cells: host.cells.map((c) => (c.id === at.id ? folder : c)) } } }
    })
    setEditing(null)
  }

  const board = preview?.boards[tab]
  const missing = preview ? Object.values(preview.boards).flatMap((b) => b.cells).filter((c) => !c.picto).length : 0

  return (
    <Modal title="Crear tablero" onClose={onClose} wide>
      {!preview ? (
        <div className="creator">
          <div className="photo-box">
            <div className="row">
              <strong>📷 Desde una foto</strong>
              <label className="file-button">
                {reading !== null ? `Leyendo la foto… ${Math.round(reading * 100)}%` : 'Elegir imagen'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={reading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void fromPhoto(f)
                  }}
                />
              </label>
            </div>
            <p className="muted">
              Una foto o captura del tablero (mejor recortada a la cuadrícula). El texto se lee en este ordenador: la imagen no se envía a ningún
              sitio. La primera vez tarda un poco más porque se descarga el lector.
            </p>
            {photoError && <p className="error">{photoError}</p>}
            {photo && (
              <div className="row">
                <img src={photo.url} alt="" className="photo-thumb" />
                <div>
                  <strong>
                    {photo.grid.cells.length} palabras en {photo.grid.rows} filas × {photo.grid.cols} columnas
                  </strong>
                  <p className="muted">Revisa el texto de abajo y corrige las palabras mal leídas. Cada línea es una fila de la foto; «_» es una casilla vacía.</p>
                </div>
              </div>
            )}
          </div>
          <strong>✏️ Desde texto</strong>
          <p className="muted">
            Escribe las palabras separadas por comas, o texto libre y se extraen las palabras clave. Usa <code>"comillas"</code> para una
            frase completa en una celda. Todo va al tablero principal; <code>Nombre:</code> al inicio de una línea es solo una etiqueta.
            Para crear una carpeta aparte, empieza la línea con <code>carpeta Nombre:</code>
          </p>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex.name} type="button" onClick={() => (setText(ex.text), setPhoto(null))}>
                Ejemplo: {ex.name}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={'Desayuno: yo, querer, leche, galletas, más, terminado\ncarpeta Parque: columpio, tobogán, arena, "otra vez"'}
            autoFocus
          />
          <label className="check">
            <input type="checkbox" checked={gridMode} onChange={(e) => setGridMode(e.target.checked)} />
            Mantener filas y columnas: cada línea es una fila y las palabras quedan en el orden escrito (<code>_</code> = casilla vacía)
          </label>
          {parsed.length > 0 && (
            <div className="parsed">
              {parsed.map((b, i) => (
                <div key={i}>
                  <strong>{b.name}</strong>
                  <span className="muted">
                    {i === 0 ? ' (principal)' : ' (carpeta)'}
                    {b.gridRows ? ` · ${b.gridRows} filas × ${b.gridCols} columnas` : ''}
                  </span>
                  : {b.items.map((it) => (it.kind === 'phrase' ? `“${it.label}”` : it.label)).join(' · ')}
                </div>
              ))}
            </div>
          )}
          <footer className="modal-footer">
            <span className="muted">
              {wordCount} celdas{parsed.length > 1 ? `, ${parsed.length - 1} carpeta${parsed.length === 2 ? '' : 's'}` : ''}
            </span>
            <span className="spacer" />
            <label className="inline" hidden={gridMode}>
              Cuadrícula
              <select
                value={size === 'auto' ? 'auto' : `${size.rows}x${size.cols}`}
                onChange={(e) => {
                  const [rows, cols] = e.target.value.split('x').map(Number)
                  setSize(e.target.value === 'auto' ? 'auto' : { rows, cols })
                }}
              >
                <option value="auto">Automática (con huecos para crecer)</option>
                {GRID_SIZES.map((g) => (
                  <option key={`${g.rows}x${g.cols}`} value={`${g.rows}x${g.cols}`}>
                    {g.rows} filas × {g.cols} columnas ({g.rows * g.cols} casillas)
                  </option>
                ))}
              </select>
            </label>
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
            Revisa el resultado. Cada categoría tiene su bloque de columnas y los huecos quedan reservados para palabras nuevas.
            Pulsa una celda para cambiar su pictograma, texto o color.
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
            <button type="button" onClick={() => onAddAsFolder(preview)}>Como carpeta en «{currentBoardName}»</button>
            <button type="button" onClick={() => onAddToCurrent(preview)}>Añadir a «{currentBoardName}»</button>
            <button type="button" className="primary" onClick={() => onReplace(preview)}>Usar como tablero principal</button>
          </footer>
        </div>
      )}
      {editing && (
        <CellEditor
          cell={editing}
          onSave={updateCell}
          onDelete={() => deleteCell(editing.id)}
          onClose={() => setEditing(null)}
          onCreateFolder={(name, template, picto) => makeFolder(editing, name, template, picto)}
        />
      )}
    </Modal>
  )
}
