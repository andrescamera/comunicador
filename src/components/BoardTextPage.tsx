import { type KeyboardEvent, useMemo, useRef, useState } from 'react'
import { type BoardChange, boardToText, type LineContext, lineContext, parseBoardText, planBoardText, resolvePictos, type TextError, type TextPlan } from '../lib/boardText'
import { CATEGORY_COLORS, FOLDER_COLORS } from '../lib/colors'
import type { Library } from '../lib/types'

interface Props {
  lib: Library
  onApply: (lib: Library) => void
  onClose: () => void
}

const HELP = `# Nombre [7 filas, 11 columnas]   el tablero principal (una vez, al principio)
@ Grupo [filas 2-5, columnas 4-5, color: social]   un grupo; sus fichas lo llenan por columnas
ficha                     una ficha por línea   ·   _   deja un hueco
	ficha                 con un tabulador más: dentro de la carpeta de la línea de arriba
ficha [fila 7, columna 11]   fuera de grupos, con su casilla
Opciones: [carpeta] (vacía) · [picto: navidad] · [solo texto] · [oculta] · [frase] · [palabra]
          [categoría: verbo] · [color: nombre] (carpetas) · grupos: [por filas] · [carpetas]
Categorías: pronombre, persona, verbo, nombre, descriptivo, social, pregunta, negación, otros
Para no mover nada: escribe lo nuevo en lugar de un «_» o al final de su grupo (en medio, lo de después se desplaza).`

/** El tablero entero como texto: se edita y, tras revisar los cambios, se aplica de una vez */
export function BoardTextPage({ lib, onApply, onClose }: Props) {
  const original = useMemo(() => boardToText(lib), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [text, setText] = useState(original)
  const [errors, setErrors] = useState<TextError[]>([])
  const [plan, setPlan] = useState<TextPlan | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [caretLine, setCaretLine] = useState(1)
  const context = useMemo(() => lineContext(lib, text, caretLine), [lib, text, caretLine])
  const trackCaret = (el: HTMLTextAreaElement) => setCaretLine(el.value.slice(0, el.selectionStart).split('\n').length)
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLPreElement>(null)
  const lineCount = text.split('\n').length
  const errorLines = new Set(errors.map((e) => e.line))

  const review = () => {
    const { doc, errors } = parseBoardText(text)
    const p = doc && !errors.length ? planBoardText(lib, doc) : null
    const all = p ? p.errors : errors
    setErrors(all)
    setPlan(all.length ? null : p)
  }

  const apply = async () => {
    if (!plan?.lib) return
    setProgress('Buscando pictogramas…')
    const next = await resolvePictos(plan.lib, plan.jobs, (done, total) => setProgress(`Buscando pictogramas… ${done} de ${total}`))
    onApply(next)
  }

  const goToLine = (line: number) => {
    const el = area.current
    if (!el) return
    const lines = text.split('\n')
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0)
    el.focus()
    el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0))
    el.scrollTop = Math.max(0, (line - 4) * parseFloat(getComputedStyle(el).lineHeight || '20'))
  }

  // Tab / Mayús+Tab: meter o sacar un nivel (también varias líneas); Enter: mantiene la sangría
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const { selectionStart: s, selectionEnd: end, value } = el
    const replace = (from: number, to: number, insert: string, selStart: number, selEnd: number) => {
      e.preventDefault()
      const next = value.slice(0, from) + insert + value.slice(to)
      setText(next)
      setPlan(null)
      requestAnimationFrame(() => el.setSelectionRange(selStart, selEnd))
    }
    if (e.key === 'Tab') {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      const lineEnd = value.indexOf('\n', end) < 0 ? value.length : value.indexOf('\n', end)
      const block = value.slice(lineStart, lineEnd)
      if (!e.shiftKey && s === end) return replace(s, s, '\t', s + 1, s + 1)
      const lines = block.split('\n')
      const changed = e.shiftKey ? lines.map((l) => l.replace(/^(\t| {1,8})/, '')) : lines.map((l) => '\t' + l)
      const out = changed.join('\n')
      const first = e.shiftKey ? Math.max(lineStart, s - (lines[0].length - changed[0].length)) : s + 1
      return replace(lineStart, lineEnd, out, first, lineEnd + (out.length - block.length))
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      const indent = value.slice(lineStart).match(/^[\t ]*/)![0]
      if (indent) replace(s, end, '\n' + indent, s + 1 + indent.length, s + 1 + indent.length)
    }
  }

  const removals = plan?.changes.reduce((n, c) => n + c.removed.length, 0) ?? 0

  return (
    <div className="libraries-page board-text-page">
      <header className="libraries-header">
        <button type="button" onClick={onClose} disabled={!!progress}>◀ Volver al tablero</button>
        <h1>Tablero escrito</h1>
        <span className="spacer" />
        <button type="button" onClick={() => setShowHelp((v) => !v)}>{showHelp ? 'Ocultar ayuda' : '? Cómo se escribe'}</button>
        <button type="button" disabled={text === original && !plan} onClick={() => (setText(original), setErrors([]), setPlan(null))}>
          ↺ Deshacer cambios del texto
        </button>
        <button type="button" className="primary" disabled={!!progress} onClick={review}>
          Revisar cambios
        </button>
      </header>
      {showHelp && <pre className="board-text-help">{HELP}</pre>}
      <div className="board-text-body">
        <div className="board-text-editor">
          <pre className="board-text-gutter" ref={gutter} aria-hidden>
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i} className={errorLines.has(i + 1) ? 'bad' : undefined}>
                {i + 1}
                {'\n'}
              </span>
            ))}
          </pre>
          <textarea
            ref={area}
            value={text}
            spellCheck={false}
            aria-label="Tablero escrito"
            onChange={(e) => (setText(e.target.value), setPlan(null))}
            onKeyDown={onKeyDown}
            onSelect={(e) => trackCaret(e.currentTarget)}
            onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
            wrap="off"
          />
        </div>
        <aside className="board-text-side">
          {context && <BoardMap context={context} />}
          {errors.length > 0 && (
            <>
              <h2>{errors.length === 1 ? 'Hay 1 error' : `Hay ${errors.length} errores`} (no se ha cambiado nada)</h2>
              <ul className="board-text-errors">
                {errors.map((e, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => goToLine(e.line)}>
                      <strong>Línea {e.line}:</strong> {e.message}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {plan && !plan.changes.length && <p>No hay cambios: el texto es igual que el tablero.</p>}
          {plan && plan.changes.length > 0 && (
            <>
              <h2>Cambios</h2>
              <ul className="board-text-changes">
                {plan.changes.map((c) => (
                  <ChangeItem key={c.path} change={c} />
                ))}
              </ul>
              {removals > 0 && <p className="board-text-warning">Se borrarán {removals === 1 ? '1 ficha' : `${removals} fichas`} (en rojo). Se puede deshacer con «↶» o Ctrl+Z.</p>}
              <div className="board-text-actions">
                <button type="button" onClick={() => setPlan(null)} disabled={!!progress}>Volver al texto</button>
                <button type="button" className={removals ? 'danger' : 'primary'} onClick={() => void apply()} disabled={!!progress}>
                  {progress ?? (removals ? `Aplicar y borrar ${removals}` : 'Aplicar')}
                </button>
              </div>
            </>
          )}
          {!errors.length && !plan && (
            <p className="muted">
              Edita el texto y pulsa «Revisar cambios». Antes de cambiar nada verás qué se añade, qué se quita y qué se mueve.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function ChangeItem({ change: c }: { change: BoardChange }) {
  const folders = new Map(c.removedFolders.map((f) => [f.label, f]))
  return (
    <li>
      <strong>{c.path}</strong>
      {c.added.length > 0 && <div className="add">+ {c.added.join(', ')}</div>}
      {c.removed.length > 0 && (
        <div className="del">
          − {c.removed
            .map((l) => {
              const f = folders.get(l)
              return f ? `${l} (carpeta con ${f.cells} fichas${f.folders ? ` y ${f.folders} subcarpetas` : ''})` : l
            })
            .join(', ')}
        </div>
      )}
      {c.changed.length > 0 && <div>✎ {c.changed.join(', ')}</div>}
      {c.moved > 0 && <div>↔ {c.moved === 1 ? 'se mueve 1 ficha' : `se mueven ${c.moved} fichas`}</div>}
      {c.groups.length > 0 && <div>▦ Grupos: {c.groups.join(' · ')}</div>}
    </li>
  )
}

/** La cuadrícula del tablero (sin fichas) con sus grupos, y resaltado lo que se está editando */
function BoardMap({ context: c }: { context: LineContext }) {
  const colors = (color?: string) => (color ? CATEGORY_COLORS[color as keyof typeof CATEGORY_COLORS] : FOLDER_COLORS)
  const span = (a: { r0: number; r1: number; c0: number; c1: number }) => ({ gridRow: `${a.r0 + 1} / ${a.r1 + 2}`, gridColumn: `${a.c0 + 1} / ${a.c1 + 2}` })
  const current = c.groups.find((g) => g.current)
  return (
    <figure className="board-map">
      <figcaption>{c.title}</figcaption>
      <div className="board-map-grid" style={{ gridTemplateColumns: `repeat(${c.cols}, 1fr)`, gridTemplateRows: `repeat(${c.rows}, 1fr)`, aspectRatio: `${c.cols} / ${c.rows}` }}>
        {Array.from({ length: c.rows * c.cols }, (_, i) => (
          <span key={i} className="board-map-slot" style={{ gridRow: Math.floor(i / c.cols) + 1, gridColumn: (i % c.cols) + 1 }} />
        ))}
        {c.groups.map((g) => (
          <span
            key={g.name}
            className={`board-map-group${g.current ? ' current' : ''}`}
            title={g.name}
            style={{ ...span(g.area), borderColor: colors(g.color).border, background: g.current ? colors(g.color).bg : undefined }}
          />
        ))}
        {c.highlight && !current && <span className="board-map-group current other" style={span(c.highlight)} />}
      </div>
    </figure>
  )
}
