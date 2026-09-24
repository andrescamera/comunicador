import { useCallback, useEffect, useRef, useState } from 'react'
import { BoardGrid } from './components/BoardGrid'
import { CellEditor } from './components/CellEditor'
import { Creator } from './components/Creator'
import { SentenceBar } from './components/SentenceBar'
import { SettingsPanel } from './components/SettingsPanel'
import { TapLog } from './components/TapLog'
import { folderCell, generateLibrary, parseText, SAMPLE_TEXT, sortCells } from './lib/generator'
import { moveCellTo, type NewCell, placeCell, relayoutBoard, resizeBoard, zoneOf } from './lib/layout'
import { classify, realize, sentenceText } from './lib/grammar'
import { bestPicto } from './lib/arasaac'
import { speak } from './lib/speech'
import { loadLibrary, loadSettings, saveLibrary, saveSettings } from './lib/storage'
import { tapManager, tapRef } from './lib/tap'
import type { Board, Cell, Library, Settings } from './lib/types'
import { uid } from './lib/types'

type EditTarget = { cell: Cell; isNew: boolean } | null

// Evita generar el ejemplo dos veces en paralelo (StrictMode monta los efectos dos veces)
let sampleRequest: Promise<Library> | null = null

export default function App() {
  const [lib, setLib] = useState<Library | null>(() => loadLibrary())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<string[]>([])
  const [sentence, setSentence] = useState<Cell[]>([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [clearing, setClearing] = useState(0) // > 0: cuenta atrás de borrado en curso (cambia para reiniciar la animación)
  const clearTimer = useRef<number | undefined>(undefined)
  const clearGen = useRef(0)

  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(''), 8000)
    return () => window.clearTimeout(t)
  }, [notice])

  tapManager.settings = settings
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    if (lib) saveLibrary(lib)
  }, [lib])

  const loadSample = useCallback(async () => {
    setLib(null)
    sampleRequest ??= generateLibrary(parseText(SAMPLE_TEXT)).finally(() => (sampleRequest = null))
    const sample = await sampleRequest
    setLib(sample)
    setHistory([])
    setSentence([])
  }, [])

  useEffect(() => {
    if (!lib) void loadSample() // primer arranque
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Celdas que se quedaron sin pictograma (sin conexión, error de red...): se reintenta una vez por sesión
  const repaired = useRef(false)
  useEffect(() => {
    if (!lib || repaired.current) return
    repaired.current = true
    const missing = Object.values(lib.boards).flatMap((b) => b.cells.filter((c) => !c.picto).map((c) => ({ board: b.id, cell: c })))
    if (!missing.length) return
    void (async () => {
      const found = new Map<string, number>()
      for (const { cell } of missing) {
        const proper = cell.category === 'person' && /^\p{Lu}/u.test(cell.label) // nombres propios: solo coincidencia exacta
        const p = await bestPicto(cell.kind === 'folder' ? cell.label.toLowerCase() : cell.label, { exactOnly: proper })
        if (p) found.set(cell.id, p.id)
      }
      if (!found.size) return
      setLib((l) =>
        l && {
          ...l,
          boards: Object.fromEntries(
            Object.entries(l.boards).map(([id, b]) => [
              id,
              { ...b, cells: b.cells.map((c) => (!c.picto && found.has(c.id) ? { ...c, picto: found.get(c.id) } : c)) },
            ]),
          ),
        },
      )
    })()
  }, [lib])

  if (!lib) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Preparando tableros de ejemplo…</p>
      </div>
    )
  }

  const currentId = history[history.length - 1] ?? lib.rootId
  const board: Board = lib.boards[currentId] ?? lib.boards[lib.rootId]

  const say = (text: string, onEnd?: () => void) => speak(text, settingsRef.current, onEnd)

  const cancelAutoClear = () => {
    window.clearTimeout(clearTimer.current)
    clearGen.current += 1
    setClearing(0)
  }
  /** Sin decir la frase: se borra tras N segundos sin tocar nada. Cada toque reinicia la cuenta. */
  const scheduleIdleClear = (length: number) => {
    cancelAutoClear()
    if (!length || !settingsRef.current.autoClear) return
    setClearing(clearGen.current)
    clearTimer.current = window.setTimeout(() => {
      setSentence([])
      setClearing(0)
    }, settingsRef.current.autoClearSeconds * 1000)
  }
  /** Al tocar la barra de la frase: se dice entera y se borra en cuanto termina. */
  const speakSentence = () => {
    cancelAutoClear()
    if (!sentence.length) return
    const gen = clearGen.current
    say(sentenceText(sentence), () => {
      if (gen !== clearGen.current) return // mientras hablaba se tocó otra celda, se borró, etc.
      if (settingsRef.current.clearAfterSpeak) setSentence([])
      else scheduleIdleClear(sentence.length)
    })
  }

  const onCellTap = (cell: Cell) => {
    if (cell.kind === 'folder') {
      if (cell.target && lib.boards[cell.target]) setHistory((h) => [...h, cell.target!])
      scheduleIdleClear(sentence.length) // navegar también cuenta como actividad
      return
    }
    const next = [...sentence, cell]
    scheduleIdleClear(next.length)
    setSentence(next)
    if (settings.speakOnTap) say(realize(next)[next.length - 1] || cell.label)
  }

  const updateBoard = (id: string, fn: (b: Board) => Board) =>
    setLib((l) => (l ? { ...l, boards: { ...l.boards, [id]: fn(l.boards[id]) } } : l))

  const saveCell = (cell: Cell, isNew: boolean) => {
    updateBoard(board.id, (b) => ({
      ...b,
      cells: isNew ? [...b.cells, cell] : b.cells.map((c) => (c.id === cell.id ? cell : c)),
    }))
    setEditTarget(null)
  }
  const deleteCell = (id: string) => {
    updateBoard(board.id, (b) => ({ ...b, cells: b.cells.filter((c) => c.id !== id) }))
    setEditTarget(null)
  }
  const moveTo = (id: string, row: number, col: number) => {
    updateBoard(board.id, (b) => moveCellTo(b, id, row, col))
    setMovingId(null)
  }
  const resize = (rows: number, cols: number) => {
    const next = resizeBoard(board, rows, cols)
    if (next) updateBoard(board.id, () => next)
    else setNotice('No se puede reducir: hay celdas en la fila o columna que quitarías. Muévelas o elimínalas antes.')
  }
  const strip = ({ row: _r, col: _c, ...cell }: Cell): NewCell => cell
  const reorganize = () => {
    if (!confirm('Esto vuelve a colocar todas las celdas de este tablero por categorías (cambiarán de sitio). ¿Continuar?')) return
    updateBoard(board.id, (b) =>
      relayoutBoard(b, (cells) =>
        sortCells(
          // Personas que se guardaron como nombres (p. ej. "papá" con tilde descompuesta)
          cells.map((c) => (c.kind === 'word' && c.category === 'noun' && classify(c.label) === 'person' ? { ...c, category: 'person' } : c)),
        ),
      ),
    )
    setNotice('Tablero reordenado por categorías.')
  }

  const replaceLibrary = (next: Library) => {
    setLib(next)
    setHistory([])
    setSentence([])
    setShowCreator(false)
  }
  const addToCurrent = (sub: Library) => {
    setLib((l) => {
      if (!l) return l
      const host = l.boards[board.id]
      const known = new Set(host.cells.map((c) => `${c.kind}:${c.label.toLowerCase()}`))
      const incoming = sub.boards[sub.rootId].cells.filter((c) => !known.has(`${c.kind}:${c.label.toLowerCase()}`))
      // Las celdas existentes no se mueven: las nuevas ocupan huecos libres de su zona
      const updated = incoming.reduce((b, c) => placeCell(b, strip(c)), host)
      const outside = updated.cells
        .filter((c) => !host.cells.includes(c))
        .filter((c) => {
          const [s, e] = updated.zones[zoneOf(c)]
          return c.col < s || c.col > e
        })
        .map((c) => `«${c.label}»`)
      const msgs = []
      if (updated.rows > host.rows) msgs.push(`No había huecos suficientes: se añadieron ${updated.rows - host.rows} fila(s).`)
      if (outside.length) msgs.push(`Su zona estaba llena y se colocaron en la casilla libre más cercana: ${outside.join(', ')}. Puedes moverlas o ampliar la cuadrícula.`)
      if (msgs.length) setNotice(msgs.join(' '))
      const { [sub.rootId]: _root, ...folders } = sub.boards
      return { ...l, boards: { ...l.boards, ...folders, [host.id]: updated } }
    })
    setShowCreator(false)
  }
  const addAsFolder = async (sub: Library) => {
    const folder = await folderCell(sub.boards[sub.rootId])
    setLib((l) => {
      if (!l) return l
      const host = l.boards[board.id]
      return { ...l, boards: { ...l.boards, ...sub.boards, [host.id]: placeCell(host, folder) } }
    })
    setShowCreator(false)
  }

  return (
    <div className={`app ${settings.showTapLog && !editing ? 'with-log' : ''}`}>
      <div className="main">
        <nav className="topbar">
          {!editing ? (
            <>
              <div className="nav-btn" data-tap data-label="Inicio" ref={tapRef(() => {
                  setHistory([])
                  scheduleIdleClear(sentence.length)
                })} role="button" aria-label="Inicio">
                🏠 <span>Inicio</span>
              </div>
              <div
                className={`nav-btn ${history.length === 0 ? 'disabled' : ''}`}
                data-tap
                data-label="Atrás"
                ref={tapRef(() => {
                  setHistory((h) => h.slice(0, -1))
                  scheduleIdleClear(sentence.length)
                })}
                role="button"
                aria-label="Atrás"
              >
                ↩ <span>Atrás</span>
              </div>
              <h1 className="board-title">{board.name}</h1>
            </>
          ) : (
            <div className="edit-toolbar">
              <input
                className="board-name-input"
                value={board.name}
                onChange={(e) => updateBoard(board.id, (b) => ({ ...b, name: e.target.value }))}
                aria-label="Nombre del tablero"
              />
              <span className="muted">Filas</span>
              <button type="button" onClick={() => resize(board.rows - 1, board.cols)} aria-label="Quitar fila">−</button>
              <strong>{board.rows}</strong>
              <button type="button" onClick={() => resize(board.rows + 1, board.cols)} aria-label="Añadir fila">+</button>
              <span className="muted">Columnas</span>
              <button type="button" onClick={() => resize(board.rows, board.cols - 1)} aria-label="Quitar columna">−</button>
              <strong>{board.cols}</strong>
              <button type="button" onClick={() => resize(board.rows, Math.min(16, board.cols + 1))} aria-label="Añadir columna">+</button>
              <button type="button" onClick={reorganize} title="Vuelve a colocar las celdas por columnas de categoría">
                ⇅<span className="btn-text"> Reordenar por categorías</span>
              </button>
            </div>
          )}
          <div className="topbar-tools">
            {editing && (
              <button type="button" onClick={() => setShowCreator(true)}>
                ✨<span className="btn-text"> Crear desde texto</span>
              </button>
            )}
            <button
              type="button"
              className={editing ? 'primary' : ''}
              onClick={() => {
                setEditing((e) => !e)
                setMovingId(null)
                cancelAutoClear()
              }}
            >
              {editing ? '✓' : '✎'}
              <span className="btn-text">{editing ? ' Terminar' : ' Editar'}</span>
            </button>
            {!editing && (
              <button type="button" onClick={() => setShowSettings(true)} aria-label="Ajustes">⚙︎</button>
            )}
          </div>
        </nav>

        {!editing && (
          <SentenceBar
            tokens={sentence}
            onSpeak={speakSentence}
            onBackspace={() => {
              scheduleIdleClear(sentence.length - 1)
              setSentence((s) => s.slice(0, -1))
            }}
            onClear={() => {
              cancelAutoClear()
              setSentence([])
            }}
            clearingMs={clearing ? settings.autoClearSeconds * 1000 : 0}
            clearingKey={clearing}
          />
        )}

        {editing && (
          <div className={`edit-hint ${movingId ? 'moving' : ''}`}>
            {movingId ? (
              <>
                Elige la casilla de destino (si está ocupada, se intercambian).
                <button type="button" onClick={() => setMovingId(null)}>Cancelar</button>
              </>
            ) : (
              'Pulsa una celda para editarla, una casilla vacía para añadir, o arrastra para cambiar de sitio. Las celdas nunca se mueven solas.'
            )}
          </div>
        )}
        {notice && <div className="notice">{notice}</div>}

        <main className="board-area">
          <BoardGrid
            board={board}
            editing={editing}
            onTap={onCellTap}
            onEdit={(cell) => setEditTarget({ cell, isNew: false })}
            onAddAt={(row, col) =>
              setEditTarget({ cell: { id: uid('c'), kind: 'word', label: '', category: 'noun', row, col }, isNew: true })
            }
            movingId={movingId}
            onMoveTo={moveTo}
            onRenameZone={(zone, name) =>
              updateBoard(board.id, (b) => {
                const zoneLabels = { ...b.zoneLabels }
                if (name === null) delete zoneLabels[zone] // vuelve al nombre por defecto
                else zoneLabels[zone] = name
                return { ...b, zoneLabels }
              })
            }
          />
        </main>
      </div>

      {settings.showTapLog && !editing && <TapLog onClose={() => setSettings({ ...settings, showTapLog: false })} />}

      {editTarget && (
        <CellEditor
          cell={editTarget.cell}
          isNew={editTarget.isNew}
          onSave={(c) => saveCell(c, editTarget.isNew)}
          onDelete={editTarget.isNew ? undefined : () => deleteCell(editTarget.cell.id)}
          onStartMove={
            editTarget.isNew
              ? undefined
              : () => {
                  setMovingId(editTarget.cell.id)
                  setEditTarget(null)
                }
          }
          onClose={() => setEditTarget(null)}
        />
      )}
      {showCreator && (
        <Creator
          currentBoardName={board.name}
          onReplace={replaceLibrary}
          onAddToCurrent={addToCurrent}
          onAddAsFolder={addAsFolder}
          onClose={() => setShowCreator(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onResetBoards={() => {
            setShowSettings(false)
            void loadSample()
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
