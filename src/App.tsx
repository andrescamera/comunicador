import { useEffect, useRef, useState } from 'react'
import { BoardGrid } from './components/BoardGrid'
import { CellEditor } from './components/CellEditor'
import { Creator } from './components/Creator'
import { SentenceBar } from './components/SentenceBar'
import { SettingsPanel } from './components/SettingsPanel'
import { TapLog } from './components/TapLog'
import { LibrariesPage } from './components/LibrariesPage'
import { buildFolder, buildQuickChat, folderCell, sortCells, starterLibrary } from './lib/generator'
import { FOLDER_NEXT, FOLDER_PREV, folderArea, inlineFolder, moveCellTo, type NewCell, normalizeLibrary, placeCell, relayoutBoard, resizeLibrary, zoneOf } from './lib/layout'
import { classify, realize, sentenceText, verbFormFor } from './lib/grammar'
import { bestPicto } from './lib/arasaac'
import { supabase, webStore } from './lib/cloud'
import { STARTER_NAME, useLibraries } from './lib/useCloudSync'
import { categoryFor, missingWords } from './lib/catalog'
import { buildPool, DEFAULT_DYNAMIC, predictionKey, predictiveHighlights } from './lib/predict'
import { DynamicConfigPanel } from './components/DynamicConfigPanel'
import { speak } from './lib/speech'
import { loadSettings, saveSettings } from './lib/storage'
import { LoginScreen } from './components/LoginScreen'
import { tapManager, tapRef } from './lib/tap'
import type { Board, Cell, Library, Settings } from './lib/types'
import { uid } from './lib/types'

type EditTarget = { cell: Cell; isNew: boolean } | null

/** Dentro de una carpeta: palabras de su categoría del catálogo que aún no están */
function folderSuggestions(board: Board, lib: Library): { category: string; words: string[] } | undefined {
  if (board.id === lib.rootId) return undefined
  const labels = board.cells.map((c) => c.label)
  const category = categoryFor(board.name, labels)
  if (!category) return undefined
  const words = missingWords(category, labels)
  return words.length ? { category, words } : undefined
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [history, setHistory] = useState<string[]>([])
  const [sentence, setSentence] = useState<Cell[]>([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  // «Mis tableros» es otra página (con dirección propia: #tableros, y el botón Atrás del navegador vuelve)
  const [showLibraries, setShowLibrariesState] = useState(() => window.location.hash === '#tableros')
  useEffect(() => {
    const onHash = () => setShowLibrariesState(window.location.hash === '#tableros')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const setShowLibraries = (show: boolean) => {
    if (show === (window.location.hash === '#tableros')) return
    if (show) window.location.hash = 'tableros'
    else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setShowLibrariesState(false)
    }
  }
  const [movingId, setMovingId] = useState<string | null>(null)
  // Modo dinámico: página del momento actual y, en edición, vista previa de un momento
  // En edición: probar cómo se ve tras una frase (null = editar las fichas)
  const [preview, setPreview] = useState<Cell[] | null>(null)
  const [showDynConfig, setShowDynConfig] = useState(false)
  const [folderPage, setFolderPage] = useState(0) // carpeta abierta en su zona: página
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

  // Tableros (varios por usuario) y sincronización en la nube
  const cloud = useLibraries({
    supabase,
    store: webStore,
    makeStarter: starterLibrary,
    onOpened: () => (setHistory([]), setSentence([]), setEditing(false)),
    // Privacidad en ordenadores compartidos: al salir no quedan tableros en el navegador
    onSignedOut: () => {
      cloud.wipeLocal()
      window.location.reload()
    },
  })
  const { lib, setLib, readOnly } = cloud

  // Edición: copia al entrar, para poder salir sin guardar («Cancelar» la recupera)
  const beforeEdit = useRef<typeof lib>(null)
  useEffect(() => {
    beforeEdit.current = editing ? lib : null
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps
  const editChanged = () => !!beforeEdit.current && !!lib && JSON.stringify(beforeEdit.current) !== JSON.stringify(lib)
  const discardEdits = () => {
    const before = beforeEdit.current
    if (before) {
      setLib(before)
      setHistory((h) => h.filter((id) => before.boards[id])) // carpetas creadas al editar ya no existen
    }
    setEditing(false)
    setMovingId(null)
    setEditTarget(null)
  }
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => setFolderPage(0), [history])
  // Modo predictivo: tras cada palabra, si todo lo que encaja está en una carpeta, se abre sola
  const predKey = predictionKey(sentence)
  useEffect(() => {
    if (!lib || editing || !sentence.length) return
    const r = lib.boards[lib.rootId]
    if (!r?.dynamic?.enabled) return
    const { autoOpen } = predictiveHighlights(lib, { ...DEFAULT_DYNAMIC, ...r.dynamic }, sentence)
    if (autoOpen && lib.boards[autoOpen]) setHistory([autoOpen])
  }, [predKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // Todos los tableros con la cuadrícula del principal (también los que llegan de otro dispositivo)
  useEffect(() => {
    if (!lib || readOnly || cloud.downloading) return
    const n = normalizeLibrary(lib)
    if (n !== lib) setLib(n, { record: false }) // ajuste automático: no se deshace
  }, [lib])

  // Deshacer / rehacer con el teclado (en un campo de texto, Ctrl+Z sigue deshaciendo el texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || readOnly) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      const key = e.key.toLowerCase()
      const wantsRedo = (key === 'z' && e.shiftKey) || key === 'y'
      if (key !== 'z' && key !== 'y') return
      e.preventDefault()
      const done = wantsRedo ? cloud.redo() : cloud.undo()
      if (done) setNotice(wantsRedo ? 'Rehecho.' : 'Deshecho. (Ctrl+Shift+Z para rehacer)')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cloud.undo, cloud.redo, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const newStarter = async () => cloud.create(await starterLibrary(), STARTER_NAME)

  // Celdas que se quedaron sin pictograma (sin conexión, error de red...): se reintenta una vez por sesión
  const repaired = useRef<string | null>(null)
  useEffect(() => {
    if (!lib || readOnly || cloud.downloading || repaired.current === cloud.activeId) return
    repaired.current = cloud.activeId
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
        { record: false }, // pictogramas que se completan solos: no se deshacen
      )
    })()
  }, [lib])

  // La web es para el terapeuta: sin sesión iniciada solo se muestra el acceso
  if (!cloud.authReady) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }
  // Solo en desarrollo (localhost): «?local» permite probar sin cuenta. No existe en la versión publicada.
  const devBypass = import.meta.env.DEV && new URLSearchParams(window.location.search).has('local')
  if (!cloud.email && !devBypass) return <LoginScreen cloud={cloud} />

  if (showLibraries) {
    return (
      <LibrariesPage
        cloud={cloud}
        onBack={() => setShowLibraries(false)}
        onCreateFromText={() => {
          setShowLibraries(false)
          setEditing(true)
          setShowCreator(true)
        }}
      />
    )
  }

  if (!lib || cloud.downloading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>{cloud.downloading ? `Descargando «${cloud.active?.name ?? 'tablero'}»…` : 'Preparando el tablero…'}</p>
      </div>
    )
  }

  const currentId = history[history.length - 1] ?? lib.rootId
  // Red de seguridad: si falta el tablero (p. ej. borrado desde otro dispositivo), se usa el principal o el primero
  const board: Board | undefined = lib.boards[currentId] ?? lib.boards[lib.rootId] ?? Object.values(lib.boards)[0]
  if (!board) {
    return (
      <div className="loading">
        <p>Este tablero está vacío.</p>
        <button type="button" className="primary" onClick={() => void newStarter()}>
          Crear un tablero de ejemplo
        </button>
        <button type="button" onClick={() => setShowLibraries(true)}>
          Ver mis tableros
        </button>
      </div>
    )
  }

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

  // Carpetas: crear (vacía o con vocabulario) y entrar a editarlas
  // `replace`: una celda que ya existe y pasa a ser carpeta (conserva su sitio y su color)
  const createFolder = async (at: Cell, replace: boolean, name: string, words: string[], picto: number | undefined) => {
    const root = lib.boards[lib.rootId] ?? board
    const { board: sub, cell } = await buildFolder(name, words, { rows: root.rows, cols: root.cols })
    const folder: Cell = { ...cell, picto: picto ?? cell.picto, row: at.row, col: at.col }
    if (replace) Object.assign(folder, { id: at.id, category: at.category, hidden: at.hidden })
    setLib((l) => {
      if (!l) return l
      const host = l.boards[board.id]
      const cells = replace ? host.cells.map((c) => (c.id === at.id ? folder : c)) : [...host.cells, folder]
      return { ...l, boards: { ...l.boards, [sub.id]: sub, [board.id]: { ...host, cells } } }
    })
    setEditTarget(null)
    setNotice(`Carpeta «${name}» creada. Pulsa sobre ella y «Abrir carpeta» para editar su contenido.`)
  }

  // Modo predictivo: lo que encaja se ve normal y el resto, atenuado (nada cambia de sitio)
  const root = lib.boards[lib.rootId]
  const dynCfg = root?.dynamic?.enabled ? { ...DEFAULT_DYNAMIC, ...root.dynamic } : null
  const previewing = editing && preview !== null
  // En «Charla rápida» no se predice: son frases hechas, todas a la vista
  const inQuickChat = !!root?.quickChat && history.includes(root.quickChat)
  const highlights = dynCfg && !inQuickChat && (!editing || previewing) ? predictiveHighlights(lib, dynCfg, previewing ? preview! : sentence) : null

  // Carpeta abierta: se ve dentro de la zona de carpetas del principal y el resto no se mueve
  const openFolderCell = history.length && root ? root.cells.find((c) => c.kind === 'folder' && c.target === history[0]) : undefined
  const zoneArea = root && openFolderCell ? folderArea(root, openFolderCell.id) : null
  const area = !editing ? zoneArea : null
  const inline = area && root ? inlineFolder(root, board, area, folderPage) : null
  // Editando la carpeta: las fichas se ven donde se usan y solo se colocan dentro de la zona
  const editArea = editing && zoneArea && board.inZone ? zoneArea : null
  const shown = inline?.board ?? board

  // «Charla rápida»: frases hechas a un toque. La primera vez se crea con frases de ejemplo.
  const openQuickChat = async () => {
    const existing = root?.quickChat && lib.boards[root.quickChat] ? root.quickChat : null
    if (existing) {
      setHistory((h) => (h[h.length - 1] === existing ? [] : [existing])) // segundo toque: volver
      return
    }
    if (readOnly || !root) return
    const chat = await buildQuickChat({ rows: root.rows, cols: root.cols })
    setLib((l) => (l ? { ...l, boards: { ...l.boards, [chat.id]: chat, [l.rootId]: { ...l.boards[l.rootId], quickChat: chat.id } } } : l))
    setHistory([chat.id])
  }

  const onCellTap = (cell: Cell) => {
    if (cell.id === FOLDER_NEXT || cell.id === FOLDER_PREV) {
      setFolderPage((p) => p + (cell.id === FOLDER_NEXT ? 1 : -1))
      return
    }
    if (cell.kind === 'folder') {
      if (cell.target && lib.boards[cell.target]) setHistory((h) => [...h, cell.target!])
      scheduleIdleClear(sentence.length) // navegar también cuenta como actividad
      return
    }
    const next = [...sentence, cell]
    scheduleIdleClear(next.length)
    setSentence(next)
    if (settings.speakOnTap) say(realize(next)[next.length - 1] || cell.label)
    // Dentro de una carpeta: tras elegir una ficha se vuelve al tablero principal
    if (settings.returnHome && history.length > 0) setHistory([])
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
  // Filas y columnas son comunes a todos los tableros: las fichas miden lo mismo en todas partes
  const resize = (rows: number, cols: number) => {
    const next = resizeLibrary(lib, rows, cols)
    if (next) setLib(next)
    else setNotice('No se puede reducir: no queda ninguna fila o columna vacía. Mueve o elimina alguna ficha antes.')
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
              <button type="button" onClick={() => cloud.undo()} disabled={!cloud.canUndo} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">↶</button>
              <button type="button" onClick={() => cloud.redo()} disabled={!cloud.canRedo} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer">↷</button>
              {history.length > 0 && (
                <button type="button" onClick={() => setHistory((h) => h.slice(0, -1))} title="Volver al tablero anterior">
                  ↩ Volver
                </button>
              )}
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
              {board.id === lib.rootId && (
                <span className="dyn-switch">
                  <button
                    type="button"
                    className={dynCfg ? 'primary' : ''}
                    onClick={() => {
                      updateBoard(board.id, (b) => ({ ...b, dynamic: { ...DEFAULT_DYNAMIC, ...b.dynamic, enabled: !b.dynamic?.enabled } }))
                      setPreview(null)
                    }}
                    title="Modo predictivo: en cada momento se resalta lo que tiene sentido decir a continuación (nada cambia de sitio)"
                  >
                    {dynCfg ? '✓ Predictivo' : 'Modo predictivo'}
                  </button>
                  {dynCfg && (
                    <>
                      <select
                        value={preview === null ? 'edit' : preview.length === 0 ? 'start' : preview.length === 1 ? 'subject' : preview[1].id}
                        onChange={(e) => {
                          const v = e.target.value
                          const subject = board.cells.find((c) => c.category === 'pronoun') ?? board.cells.find((c) => c.category === 'person')
                          const verb = buildPool(lib).find((p) => p.cell.id === v)?.cell
                          setPreview(v === 'edit' ? null : v === 'start' ? [] : v === 'subject' ? (subject ? [subject] : []) : subject && verb ? [subject, verb] : verb ? [verb] : [])
                        }}
                        aria-label="Probar el modo predictivo"
                      >
                        <option value="edit">Editar fichas</option>
                        <option value="start">Probar: al empezar</option>
                        <option value="subject">Probar: tras la persona</option>
                        {buildPool(lib)
                          .filter((p) => p.cell.category === 'verb')
                          .map((p) => (
                            <option key={p.cell.id} value={p.cell.id}>
                              Probar: tras «{p.cell.label}»
                            </option>
                          ))}
                      </select>
                      <button type="button" onClick={() => setShowDynConfig(true)} aria-label="Configurar modo dinámico">⚙︎</button>
                    </>
                  )}
                </span>
              )}
              <button type="button" onClick={reorganize} title="Vuelve a colocar las celdas por columnas de categoría">
                ⇅<span className="btn-text"> Reordenar por categorías</span>
              </button>
            </div>
          )}
          <div className="topbar-tools">
            {!editing && (
              <button type="button" onClick={() => setShowLibraries(true)} title="Mis tableros: cambiar, crear, compartir">
                📚<span className="btn-text"> Mis tableros</span>
              </button>
            )}
            {editing && (
              <button type="button" onClick={() => setShowCreator(true)}>
                ✨<span className="btn-text"> Crear tablero</span>
              </button>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => {
                  if (!editChanged() || confirm('¿Salir sin guardar? Se perderán los cambios hechos desde que pulsaste «Editar».')) discardEdits()
                }}
              >
                ✕<span className="btn-text"> Cancelar</span>
              </button>
            )}
            {!readOnly && <button
              type="button"
              className={editing ? 'primary' : ''}
              onClick={() => {
                setEditing((e) => !e)
                setMovingId(null)
                cancelAutoClear()
              }}
            >
              {editing ? '✓' : '✎'}
              <span className="btn-text">{editing ? ' Guardar' : ' Editar'}</span>
            </button>}
            {!editing && (
              <button type="button" onClick={() => setShowSettings(true)} aria-label="Ajustes">⚙︎</button>
            )}
          </div>
        </nav>


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
        {!editing && board.cells.length === 0 && history.length === 0 && (
          <div className="notice">Tablero vacío. Pulsa «✎ Editar» para añadir fichas, o para crear un tablero entero a partir de un texto o de una foto (✨ Crear tablero).</div>
        )}

        {/* En uso, la barra de frase mide lo mismo que una fila del tablero */}
        <div
          className={`board-stack ${editing ? '' : 'use'}`}
          style={editing ? undefined : { gridTemplateRows: `calc((100% - ${shown.rows * 8}px) / ${shown.rows + 1}) minmax(0, 1fr)` }}
        >
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
            onQuickChat={root?.quickChat || !readOnly ? () => void openQuickChat() : undefined}
          />
        )}
        <main className="board-area">
          <BoardGrid
            board={shown}
            editing={editing && !previewing}
            onTap={editing ? () => {} : onCellTap}
            dimFor={highlights ? (c) => !highlights.lit.has(c.id) : undefined}
            activeArea={editArea}
            labelFor={settings.conjugateLabels ? (c) => verbFormFor(sentence, c) : undefined}
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
          onCreateFolder={(name, words, picto) => createFolder(editTarget.cell, !editTarget.isNew, name, words, picto)}
          suggestions={editTarget.isNew ? folderSuggestions(board, lib) : undefined}
          capacity={(lib.boards[lib.rootId] ?? board).rows * (lib.boards[lib.rootId] ?? board).cols}
          onOpenFolder={
            !editTarget.isNew && editTarget.cell.kind === 'folder' && editTarget.cell.target && lib.boards[editTarget.cell.target]
              ? () => {
                  setHistory((h) => [...h, editTarget.cell.target!])
                  setEditTarget(null)
                }
              : undefined
          }
        />
      )}
      {showCreator && (
        <Creator
          currentBoardName={board.name}
          onReplace={replaceLibrary}
          onCreateNew={(next) => {
            const name = prompt('Nombre del tablero nuevo', next.boards[next.rootId]?.name && next.boards[next.rootId].name !== 'Inicio' ? next.boards[next.rootId].name : 'Nuevo tablero')
            if (name === null) return
            void cloud.create(next, name)
            setShowCreator(false)
          }}
          onAddToCurrent={addToCurrent}
          onAddAsFolder={addAsFolder}
          onClose={() => setShowCreator(false)}
        />
      )}
      {showDynConfig && root && (
        <DynamicConfigPanel
          config={{ ...DEFAULT_DYNAMIC, ...root.dynamic }}
          onChange={(dynamic) => updateBoard(root.id, (b) => ({ ...b, dynamic }))}
          onClose={() => setShowDynConfig(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onResetBoards={() => {
            setShowSettings(false)
            void newStarter()
          }}
          onClose={() => setShowSettings(false)}
          cloud={cloud}
        />
      )}
    </div>
  )
}
