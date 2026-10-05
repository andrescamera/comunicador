import { realize } from '../lib/grammar'
import { tapRef } from '../lib/tap'
import type { Cell } from '../lib/types'
import { Picto } from './Picto'

interface Props {
  tokens: Cell[]
  onSpeak: () => void
  onBackspace: () => void
  onClear: () => void
  /** > 0 mientras hay un borrado automático pendiente (duración de la cuenta atrás) */
  clearingMs?: number
  clearingKey?: number // cambia en cada toque para reiniciar la barra de cuenta atrás
  /** Botón fijo «Charla rápida» (frases hechas) */
  onQuickChat?: () => void
}

export function SentenceBar({ tokens, onSpeak, onBackspace, onClear, clearingMs = 0, clearingKey, onQuickChat }: Props) {
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
        <div className="action" data-tap data-label="Borrar última" ref={tapRef(onBackspace)} role="button" aria-label="Borrar la última palabra">
          <span className="action-icon">⌫</span>
          <span>Borrar</span>
        </div>
        <div className="action" data-tap data-label="Borrar todo" ref={tapRef(onClear)} role="button" aria-label="Borrar todo">
          <span className="action-icon">✕</span>
          <span>Todo</span>
        </div>
        {onQuickChat && (
          <div className="action action-quick" data-tap data-label="Charla rápida" ref={tapRef(onQuickChat)} role="button" aria-label="Charla rápida">
            <span className="action-icon">💬</span>
            <span>Charla rápida</span>
          </div>
        )}
      </div>
    </div>
  )
}
