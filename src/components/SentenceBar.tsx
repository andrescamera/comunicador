import { realize } from '../lib/grammar'
import { tapRef } from '../lib/tap'
import type { Cell } from '../lib/types'
import { Picto } from './Picto'

interface Props {
  tokens: Cell[]
  onSpeak: () => void
  onBackspace: () => void
  onClear: () => void
  /** Pasar la última palabra a plural (o volver al singular) */
  onPlural: () => void
  /** 'none': la última palabra no admite plural; 'plural': ya está en plural */
  pluralState: 'none' | 'singular' | 'plural'
  /** > 0 mientras hay un borrado automático pendiente (duración de la cuenta atrás) */
  clearingMs?: number
  clearingKey?: number // cambia en cada toque para reiniciar la barra de cuenta atrás
}

export function SentenceBar({ tokens, onSpeak, onBackspace, onClear, onPlural, pluralState, clearingMs = 0, clearingKey }: Props) {
  const words = realize(tokens)
  return (
    <div className="sentence-bar">
      <div className="sentence" data-tap data-label="Frase (hablar)" ref={tapRef(onSpeak)} role="button" aria-label="Decir la frase">
        {tokens.length === 0 && <span className="sentence-hint">Toca los pictogramas para formar una frase. Toca aquí para decirla entera.</span>}
        {clearingMs > 0 && (
          <span key={clearingKey} className="autoclear-bar" style={{ animationDuration: `${clearingMs}ms` }} aria-hidden />
        )}
        {tokens.map((t, i) => (
          <div key={i} className="sentence-token">
            <Picto id={t.picto} alt={t.label} />
            <span>{words[i]}</span>
          </div>
        ))}
      </div>
      <div className="sentence-actions">
        <div
          className={`action action-plural ${pluralState === 'none' ? 'disabled' : ''} ${pluralState === 'plural' ? 'active' : ''}`}
          data-tap
          data-label="Plural"
          ref={tapRef(onPlural)}
          role="button"
          aria-label="Poner la última palabra en plural"
          aria-pressed={pluralState === 'plural'}
        >
          <span className="action-icon">+s</span>
          <span>{pluralState === 'plural' ? 'Singular' : 'Plural'}</span>
        </div>
        <div className="action" data-tap data-label="Borrar última" ref={tapRef(onBackspace)} role="button" aria-label="Borrar la última palabra">
          <span className="action-icon">⌫</span>
          <span>Borrar</span>
        </div>
        <div className="action" data-tap data-label="Borrar todo" ref={tapRef(onClear)} role="button" aria-label="Borrar todo">
          <span className="action-icon">✕</span>
          <span>Todo</span>
        </div>
      </div>
    </div>
  )
}
