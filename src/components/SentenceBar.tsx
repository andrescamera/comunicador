import { realize } from '../lib/grammar'
import { tapRef } from '../lib/tap'
import type { Cell } from '../lib/types'
import { Picto } from './Picto'

interface Props {
  tokens: Cell[]
  onSpeak: () => void
  onBackspace: () => void
  onClear: () => void
}

export function SentenceBar({ tokens, onSpeak, onBackspace, onClear }: Props) {
  const words = realize(tokens)
  return (
    <div className="sentence-bar">
      <div className="sentence" data-tap data-label="Frase (hablar)" ref={tapRef(onSpeak)} role="button" aria-label="Decir la frase">
        {tokens.length === 0 && <span className="sentence-hint">Toca los pictogramas para formar una frase</span>}
        {tokens.map((t, i) => (
          <div key={i} className="sentence-token">
            <Picto id={t.picto} alt={t.label} />
            <span>{words[i]}</span>
          </div>
        ))}
      </div>
      <div className="sentence-actions">
        <div className="action action-speak" data-tap data-label="Hablar" ref={tapRef(onSpeak)} role="button" aria-label="Hablar">
          <span className="action-icon">🔊</span>
          <span>Hablar</span>
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
