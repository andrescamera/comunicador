import { useState } from 'react'
import { type Area, boardGroups, setFolderZone } from '../lib/layout'
import type { Board } from '../lib/types'
import { AreaPicker } from './ExpansionPicker'

const list = (xs: string[]) => (xs.length <= 6 ? xs.join(', ') : `${xs.slice(0, 6).join(', ')} y ${xs.length - 6} más`)

/** Elegir en el mapa la zona de carpetas del principal (donde se abren las carpetas y los «más» sin zona propia) */
export function FolderZoneEditor({ root, onApply }: { root: Board; onApply: (board: Board) => void }) {
  const groups = boardGroups(root, true)
  const current = groups.find((g) => g.folders)?.area
  const [draft, setDraft] = useState<Area | undefined>(current)
  const changed = !!draft && JSON.stringify(draft) !== JSON.stringify(current && { r0: current.r0, r1: current.r1, c0: current.c0, c1: current.c1 })
  const preview = draft && changed ? setFolderZone(root, draft) : null
  return (
    <div className="folder-zone-editor">
      <strong>Zona de carpetas</strong>
      <span className="muted">Donde se abren las carpetas (y los «más» sin zona propia).</span>
      <AreaPicker rows={root.rows} cols={root.cols} groups={groups.filter((g) => !g.folders)} value={draft} onChange={setDraft} />
      {preview && (
        <ul className="import-summary">
          {preview.trimmed.length > 0 && <li>Se recortan para dejarle sitio: {list(preview.trimmed)}</li>}
          {preview.removed.length > 0 && <li>Quedan dentro y dejan de ser grupo: {list(preview.removed)}</li>}
          {preview.inside.length > 0 && <li className="muted">Fichas que no son carpetas y quedan dentro: {list(preview.inside)}</li>}
          {preview.outside.length > 0 && <li className="error">Carpetas que quedan fuera (se abrirán a pantalla completa): {list(preview.outside)}</li>}
        </ul>
      )}
      <button type="button" className="primary" disabled={!preview} onClick={() => preview && onApply(preview.board)}>
        Guardar zona
      </button>
    </div>
  )
}
