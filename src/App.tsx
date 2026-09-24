import { useCallback, useEffect, useRef, useState } from 'react'
import { BoardGrid } from './components/BoardGrid'
import { CellEditor } from './components/CellEditor'
import { Creator } from './components/Creator'
import { SentenceBar } from './components/SentenceBar'
import { SettingsPanel } from './components/SettingsPanel'
import { TapLog } from './components/TapLog'
import { autoCols, folderCell, generateLibrary, parseText, SAMPLE_TEXT, sortCells } from './lib/generator'
import { realize, sentenceText } from './lib/grammar'
import { speak } from './lib/speech'
import { loadLibrary, loadSettings, saveLibrary, saveSettings } from './lib/storage'
import { tapManager, tapRef } from './lib/tap'
import type { Board, Cell, Library, Settings } from './lib/types'
import { uid } from './lib/types'

type EditTarget = { cell: Cell; isNew: boolean } | null

export default function App() {
  const [lib, setLib] = useState<Library | null>(() => loadLibrary())
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<string[]>([])
  const [sentence, setSentence] = useState<Cell[]>([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  tapManager.settings = settings
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    if (lib) saveLibrary(lib)
  }, [lib])

  const loadSample = useCallback(async () => {
    setLib(null)
    const sample = await generateLibrary(parseText(SAMPLE_TEXT))
    setLib(sample)
    setHistory([])
    setSentence([])
  }, [])

  useEffect(() => {
    if (!lib) void loadSample() // primer arranque
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const say = (text: string) => speak(text, settingsRef.current)

  const onCellTap = (cell: Cell) => {
    if (cell.kind === 'folder') {
      if (cell.target && lib.boards[cell.target]) setHistory((h) => [...h, cell.target!])
      return
    }
    const next = [...sentence, cell]
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
  const moveCell = (id: string, delta: -1 | 1) =>
    updateBoard(board.id, (b) => {
      const i = b.cells.findIndex((c) => c.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= b.cells.length) return b
      const cells = [...b.cells]
      ;[cells[i], cells[j]] = [cells[j], cells[i]]
      return { ...b, cells }
    })

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
      const cells = sortCells([...host.cells, ...incoming])
      const { [sub.rootId]: _root, ...folders } = sub.boards
      return { ...l, boards: { ...l.boards, ...folders, [host.id]: { ...host, cells, cols: Math.max(host.cols, autoCols(cells.length)) } } }
    })
    setShowCreator(false)
  }
  const addAsFolder = async (sub: Library) => {
    const folder = await folderCell(sub.boards[sub.rootId])
    setLib((l) => {
      if (!l) return l
      const host = l.boards[board.id]
      return { ...l, boards: { ...l.boards, ...sub.boards, [host.id]: { ...host, cells: [...host.cells, folder] } } }
    })
    setShowCreator(false)
  }

  return (
    <div className={`app ${settings.showTapLog && !editing ? 'with-log' : ''}`}>
      <div className="main">
        <nav className="topbar">
          {!editing ? (
            <>
              <div className="nav-btn" data-tap data-label="Inicio" ref={tapRef(() => setHistory([]))} role="button" aria-label="Inicio">
                🏠 <span>Inicio</span>
              </div>
              <div
                className={`nav-btn ${history.length === 0 ? 'disabled' : ''}`}
                data-tap
                data-label="Atrás"
                ref={tapRef(() => setHistory((h) => h.slice(0, -1)))}
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
              <span className="muted">Columnas</span>
              <button type="button" onClick={() => updateBoard(board.id, (b) => ({ ...b, cols: Math.max(1, b.cols - 1) }))}>−</button>
              <strong>{board.cols}</strong>
              <button type="button" onClick={() => updateBoard(board.id, (b) => ({ ...b, cols: Math.min(12, b.cols + 1) }))}>+</button>
              <button type="button" onClick={() => updateBoard(board.id, (b) => ({ ...b, cols: autoCols(b.cells.length + 1) }))}>Auto</button>
            </div>
          )}
          <div className="topbar-tools">
            {editing && (
              <button type="button" onClick={() => setShowCreator(true)}>✨ Crear desde texto</button>
            )}
            <button type="button" className={editing ? 'primary' : ''} onClick={() => setEditing((e) => !e)}>
              {editing ? '✓ Terminar' : '✎ Editar'}
            </button>
            {!editing && (
              <button type="button" onClick={() => setShowSettings(true)} aria-label="Ajustes">⚙︎</button>
            )}
          </div>
        </nav>

        {!editing && (
          <SentenceBar
            tokens={sentence}
            onSpeak={() => say(sentenceText(sentence))}
            onBackspace={() => setSentence((s) => s.slice(0, -1))}
            onClear={() => setSentence([])}
          />
        )}

        <main className="board-area">
          <BoardGrid
            board={board}
            editing={editing}
            onTap={onCellTap}
            onEdit={(cell) => setEditTarget({ cell, isNew: false })}
            onAdd={() =>
              setEditTarget({ cell: { id: uid('c'), kind: 'word', label: '', category: 'noun' }, isNew: true })
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
          onMove={editTarget.isNew ? undefined : (d) => moveCell(editTarget.cell.id, d)}
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
