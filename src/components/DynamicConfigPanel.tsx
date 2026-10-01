import { useState } from 'react'
import { DEFAULT_DYNAMIC } from '../lib/dynamic'
import type { DynamicConfig } from '../lib/types'
import { Modal } from './Modal'

const toList = (s: string) =>
  s
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)

/** Configuración del modo dinámico de un tablero */
export function DynamicConfigPanel({ config, onChange, onClose }: { config: DynamicConfig; onChange: (c: DynamicConfig) => void; onClose: () => void }) {
  const [fixed, setFixed] = useState(config.fixed.join(', '))
  const [chain, setChain] = useState(config.chainVerbs.join(', '))
  return (
    <Modal title="Modo dinámico" onClose={onClose}>
      <div className="settings">
        <p className="muted">
          En cada momento de la frase se ve solo lo que encaja: al empezar, personas, preguntas y verbos; tras la persona, los
          verbos; tras el verbo, nombres, carpetas y palabras pequeñas. El tamaño máximo es el de Filas × Columnas del tablero.
        </p>
        <label>
          Columna fija (siempre visible, separadas por comas)
          <input value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="no, sí, más, ayuda" />
        </label>
        <label>
          Verbos que pueden llevar otro detrás («<em>quiero</em> comer», «<em>puedo</em> jugar»), separados por comas
          <input value={chain} onChange={(e) => setChain(e.target.value)} />
        </label>
        <footer className="modal-footer">
          <button
            type="button"
            onClick={() => {
              setFixed(DEFAULT_DYNAMIC.fixed.join(', '))
              setChain(DEFAULT_DYNAMIC.chainVerbs.join(', '))
            }}
          >
            Valores por defecto
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="primary"
            onClick={() => {
              onChange({ ...config, fixed: toList(fixed), chainVerbs: toList(chain) })
              onClose()
            }}
          >
            Guardar
          </button>
        </footer>
      </div>
    </Modal>
  )
}
