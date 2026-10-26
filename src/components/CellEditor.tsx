import { useEffect, useState } from 'react'
import { searchPictos, type PictoResult } from '../lib/arasaac'
import { FOLDER_TEMPLATES } from '../lib/generator'
import { classify, normalizeText } from '../lib/grammar'
import { CATEGORY_LABELS, type Category, type Cell, type Group } from '../lib/types'
import { ExpansionPicker } from './ExpansionPicker'
import { PhotoCropper } from './PhotoCropper'
import { Modal } from './Modal'
import { Picto } from './Picto'
import { WordInput } from './WordInput'
import { WordPicker, WordSuggestions } from './WordPicker'

interface Props {
  cell: Cell
  isNew?: boolean
  onSave: (cell: Cell) => void
  onDelete?: () => void
  onStartMove?: () => void
  onClose: () => void
  /** Crear una carpeta (vacía o con el vocabulario de una plantilla), nueva o en lugar de esta celda */
  onCreateFolder?: (name: string, words: string[], picto: number | undefined, folderColor?: Category | 'folder') => Promise<void>
  /** Casillas de cada tablero (para avisar si las palabras elegidas no caben en la carpeta) */
  capacity?: number
  /** Ficha nueva dentro de una carpeta: palabras de su categoría que aún no están */
  suggestions?: { category: string; words: string[] }
  /** Entrar en la carpeta para editar lo que tiene dentro */
  onOpenFolder?: () => void
  /** Subir una foto (de archivo) para usarla en lugar del pictograma; devuelve su ruta. Sin ella, no hay fotos (p. ej. sin sesión) */
  onUploadPhoto?: (file: Blob) => Promise<string>
  /** Carpeta del principal: elegir dónde se abre (zona de carpetas o zona de ampliación propia) */
  expansionBoard?: { rows: number; cols: number; groups: Group[] }
}

export function CellEditor({ cell, isNew, onSave, onDelete, onStartMove, onClose, onCreateFolder, onOpenFolder, capacity, suggestions, expansionBoard, onUploadPhoto }: Props) {
  const [draft, setDraft] = useState<Cell>(cell)
  const [template, setTemplate] = useState<string | undefined>(undefined)
  const [picked, setPicked] = useState<string[]>([]) // palabras elegidas para la carpeta
  const [creating, setCreating] = useState(false)
  // Carpeta nueva: una celda vacía o una palabra que se convierte en carpeta
  const newFolder = draft.kind === 'folder' && cell.kind !== 'folder'
  const [query, setQuery] = useState(cell.label)
  // Buscar un pictograma distinto del texto (p. ej. «Navidad» para la ficha «Papá Noel»)
  const [customQuery, setCustomQuery] = useState(false)
  const [results, setResults] = useState<PictoResult[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [cropping, setCropping] = useState<File | null>(null) // foto elegida: primero se recorta
  const pickPhoto = async (jpeg: Blob) => {
    setCropping(null)
    if (!onUploadPhoto) return
    setUploading(true)
    setPhotoError('')
    try {
      const photo = await onUploadPhoto(jpeg)
      setDraft((d) => ({ ...d, photo }))
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }
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
    if (!customQuery) setQuery(label) // los pictogramas siguen al texto salvo que se busque otro
  }

  return (
    <Modal title={isNew ? 'Nueva celda' : 'Editar celda'} onClose={onClose} wide>
      {isNew && suggestions && draft.kind !== 'folder' && (
        <WordSuggestions
          title={`${suggestions.category}: toca una para añadirla`}
          words={suggestions.words}
          selected={draft.label}
          onPick={(w, picto) => {
            setLabel(w)
            if (picto) setDraft((d) => ({ ...d, label: w, picto }))
          }}
        />
      )}
      <div className="editor">
        <div className="editor-preview">
          {!draft.textOnly && <Picto id={draft.picto} photo={draft.photo} alt={draft.label} />}
          <span className={draft.textOnly ? 'editor-preview-text' : undefined}>{draft.label || '—'}</span>
          {!draft.textOnly && (
            <div className="photo-actions">
              <label className={`file-button small${onUploadPhoto ? '' : ' disabled'}`} title={onUploadPhoto ? 'Usar una foto en lugar del pictograma' : 'Para usar fotos, inicia sesión: el tablero tiene que estar en tu cuenta'}>
                {uploading ? 'Subiendo…' : draft.photo ? '🖼️ Cambiar foto' : '🖼️ Poner foto'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={!onUploadPhoto || uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) setCropping(f)
                  }}
                />
              </label>
              {draft.photo && (
                <button type="button" className="small" onClick={() => setDraft(({ photo: _p, ...d }) => d)}>
                  Quitar foto
                </button>
              )}
              {photoError && <span className="error">{photoError}</span>}
            </div>
          )}
        </div>
        <div className="editor-fields">
          <label>
            Texto
            <WordInput value={draft.label} onChange={setLabel} autoFocus placeholder="Escribe y elige una sugerencia" />
          </label>
          {cell.kind !== 'folder' && (
            <div className="row">
              <label>
                Tipo
                <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Cell['kind'] })}>
                  <option value="word">Palabra (se conjuga)</option>
                  <option value="phrase">Frase hecha</option>
                  {onCreateFolder && <option value="folder">Carpeta (abre otro tablero)</option>}
                </select>
              </label>
              {draft.kind !== 'folder' && <label>
                Categoría (color)
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>}
            </div>
          )}
          {draft.kind === 'folder' && (
            <label>
              Color
              <select value={draft.folderColor ?? ''} onChange={(e) => setDraft({ ...draft, folderColor: (e.target.value || undefined) as Cell['folderColor'] })}>
                <option value="">Como su grupo</option>
                <option value="folder">Marrón (carpeta)</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {draft.kind === 'folder' && !newFolder && expansionBoard && (
            <ExpansionPicker
              {...expansionBoard}
              at={{ row: draft.row, col: draft.col }}
              value={draft.expansion}
              onChange={(expansion) => setDraft((d) => {
                const next = { ...d, expansion }
                if (!expansion) delete next.expansion
                return next
              })}
            />
          )}
          {newFolder && (
            <div className="folder-templates">
              <span>Categoría (luego eliges las palabras)</span>
              <div className="examples">
                {[undefined, ...Object.keys(FOLDER_TEMPLATES)].map((t) => (
                  <button
                    key={t ?? 'vacia'}
                    type="button"
                    className={template === t ? 'selected' : ''}
                    onClick={() => {
                      setTemplate(t)
                      setPicked([])
                      if (t && (!draft.label.trim() || (template && draft.label === template))) setLabel(t)
                    }}
                  >
                    {t ?? 'Vacía'}
                  </button>
                ))}
              </div>
              <WordPicker key={template ?? ''} words={template ? FOLDER_TEMPLATES[template] : []} picked={picked} onChange={setPicked} capacity={capacity} />
            </div>
          )}
          {draft.kind !== 'folder' && (
            <label className="check">
              <input type="checkbox" checked={!!draft.textOnly} onChange={(e) => setDraft({ ...draft, textOnly: e.target.checked || undefined })} />
              Solo la palabra, en grande (sin pictograma)
            </label>
          )}
          {!isNew && (
            <label className="check">
              <input type="checkbox" checked={!!draft.hidden} onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })} />
              Ocultar (conserva su sitio; para introducir vocabulario poco a poco)
            </label>
          )}
        </div>
      </div>
      {/* Los pictogramas siguen a lo escrito en «Texto» */}
      <div className="picto-search">
        <strong className="picto-results-title">Pictograma</strong>
        <input
          value={customQuery ? query : ''}
          onChange={(e) => {
            setQuery(e.target.value || draft.label)
            setCustomQuery(!!e.target.value)
          }}
          placeholder={`Buscar otro pictograma (ahora: «${draft.label || '…'}»)`}
          aria-label="Buscar otro pictograma"
        />
        {customQuery && (
          <button type="button" onClick={() => (setCustomQuery(false), setQuery(draft.label))}>
            ↺ Usar el texto
          </button>
        )}
      </div>
      <div className="picto-results">
        {loading && <p className="muted">Buscando…</p>}
        {!loading && results.length === 0 && query.trim() && <p className="muted">Sin resultados en ARASAAC.</p>}
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`picto-option ${draft.picto === r.id ? 'selected' : ''}`}
            onClick={() => setDraft(({ photo: _p, ...d }) => ({ ...d, picto: r.id }))}
            title={r.keyword}
          >
            <Picto id={r.id} alt={r.keyword} />
          </button>
        ))}
      </div>
      <footer className="modal-footer">
        {onDelete && <button type="button" className="danger" onClick={onDelete}>Eliminar</button>}
        {onStartMove && <button type="button" onClick={onStartMove}>✥ Mover a otra casilla</button>}
        {onOpenFolder && <button type="button" onClick={onOpenFolder}>📂 Abrir carpeta</button>}
        <span className="spacer" />
        <button type="button" onClick={onClose}>Cancelar</button>
        <button
          type="button"
          className="primary"
          disabled={!draft.label.trim() || creating}
          onClick={async () => {
            if (newFolder && onCreateFolder) {
              setCreating(true)
              await onCreateFolder(normalizeText(draft.label), picked, draft.picto, draft.folderColor)
              setCreating(false)
            } else onSave({ ...draft, label: normalizeText(draft.label) })
          }}
        >
          {creating ? 'Creando carpeta…' : newFolder ? (isNew ? 'Crear carpeta' : 'Convertir en carpeta') : 'Guardar'}
        </button>
      </footer>
      <p className="credit">Pictogramas: Sergio Palao · ARASAAC (Gobierno de Aragón) · CC BY-NC-SA</p>
      {cropping && <PhotoCropper file={cropping} onDone={(jpeg) => void pickPhoto(jpeg)} onCancel={() => setCropping(null)} />}
    </Modal>
  )
}
