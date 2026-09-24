import { useSyncExternalStore } from 'react'
import { tapManager } from '../lib/tap'

export function TapLog({ onClose }: { onClose: () => void }) {
  const log = useSyncExternalStore(
    (cb) => tapManager.subscribe(cb),
    () => tapManager.getLog(),
  )
  const ok = log.filter((e) => e.outcome === 'ok').length
  const ignored = log.length - ok
  return (
    <aside className="taplog">
      <header>
        <strong>Registro de toques</strong>
        <button type="button" onClick={() => tapManager.clearLog()}>Limpiar</button>
        <button type="button" onClick={onClose} aria-label="Cerrar registro">✕</button>
      </header>
      <p className="taplog-summary">
        <span className="ok">{ok} activados</span> · <span className="ignored">{ignored} ignorados</span>
      </p>
      <ol>
        {log.map((e) => (
          <li key={e.n} className={e.outcome}>
            <span className="taplog-label">{e.label}</span>
            <span className="taplog-reason">
              {e.outcome === 'ok' ? '✓' : '⨯'} {e.reason}
              {e.holdMs !== undefined && e.outcome === 'ok' ? ` (${e.holdMs} ms)` : ''}
            </span>
          </li>
        ))}
      </ol>
      {log.length === 0 && <p className="taplog-empty">Toca celdas para ver qué pulsaciones se aceptan y cuáles se descartan.</p>}
    </aside>
  )
}
