import { Image } from 'expo-image'
import { useKeepAwake } from 'expo-keep-awake'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { BoardView } from './src/components/BoardView'
import { CellEditor } from './src/components/CellEditor'
import { Creator } from './src/components/Creator'
import { SentenceBar } from './src/components/SentenceBar'
import { SettingsSheet } from './src/components/SettingsSheet'
import { TapButton } from './src/components/TapButton'
import { TapLog } from './src/components/TapLog'
import {
  bestPicto,
  type Board,
  type Cell,
  classify,
  DEFAULT_SETTINGS,
  folderCell,
  generateLibrary,
  type Library,
  moveCellTo,
  type NewCell,
  parseText,
  pictoUrl,
  placeCell,
  realize,
  relayoutBoard,
  resizeBoard,
  SAMPLE_TEXT,
  sentenceText,
  type Settings,
  sortCells,
  uid,
  zoneOf,
} from './src/shared'
import { speak, warmUpSpeech } from './src/speech'
import { loadLibrary, loadSettings, saveLibrary, saveSettings } from './src/storage'
import { tapGuard } from './src/tap'
import { colors, radius } from './src/theme'

type EditTarget = { cell: Cell; isNew: boolean } | null

export default function App() {
  useKeepAwake() // la pantalla no se apaga mientras se usa el comunicador
  const { width, height } = useWindowDimensions()
  const compact = Math.min(width, height) < 600

  const [lib, setLib] = useState<Library | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [sentence, setSentence] = useState<Cell[]>([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [clearing, setClearing] = useState(0)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearGen = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  tapGuard.settings = settings

  const loadSample = useCallback(async () => {
    setLib(null)
    const sample = await generateLibrary(parseText(SAMPLE_TEXT))
    setLib(sample)
    setHistory([])
    setSentence([])
  }, [])

  // Arranque: ajustes + tableros guardados (o el ejemplo) + motor de voz listo
  useEffect(() => {
    void (async () => {
      const [savedLib, savedSettings] = await Promise.all([loadLibrary(), loadSettings()])
      setSettings(savedSettings)
      setLoaded(true)
      void warmUpSpeech()
      if (savedLib) setLib(savedLib)
      else await loadSample()
    })()
  }, [loadSample])

  useEffect(() => {
    if (loaded) saveSettings(settings)
  }, [settings, loaded])
  useEffect(() => {
    if (lib) saveLibrary(lib)
  }, [lib])
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 8000)
    return () => clearTimeout(t)
  }, [notice])

  // Precarga de todos los pictogramas: después funciona sin conexión y sin esperas
  const prefetched = useRef(new Set<number>())
  useEffect(() => {
    if (!lib) return
    const ids = Object.values(lib.boards)
      .flatMap((b) => b.cells.map((c) => c.picto))
      .filter((id): id is number => !!id && !prefetched.current.has(id))
    if (!ids.length) return
    ids.forEach((id) => prefetched.current.add(id))
    void Image.prefetch(ids.map((id) => pictoUrl(id)), 'memory-disk')
  }, [lib])

  // Reintento de pictogramas que faltaron (sin conexión, error de red...), una vez por sesión
  const repaired = useRef(false)
  useEffect(() => {
    if (!lib || repaired.current) return
    repaired.current = true
    const missing = Object.values(lib.boards).flatMap((b) => b.cells.filter((c) => !c.picto))
    if (!missing.length) return
    void (async () => {
      const found = new Map<string, number>()
      for (const cell of missing) {
        const proper = cell.category === 'person' && /^\p{Lu}/u.test(cell.label)
        const p = await bestPicto(cell.kind === 'folder' ? cell.label.toLowerCase() : cell.label, { exactOnly: proper })
        if (p) found.set(cell.id, p.id)
      }
      if (!found.size) return
      setLib((l) =>
        l && {
          ...l,
          boards: Object.fromEntries(
            Object.entries(l.boards).map(([id, b]) => [id, { ...b, cells: b.cells.map((c) => (!c.picto && found.has(c.id) ? { ...c, picto: found.get(c.id) } : c)) }]),
          ),
        },
      )
    })()
  }, [lib])

  if (!lib) {
    return (
      <View style={[styles.app, styles.center]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Preparando tableros…</Text>
      </View>
    )
  }

  const currentId = history[history.length - 1] ?? lib.rootId
  const board: Board = lib.boards[currentId] ?? lib.boards[lib.rootId]
  const say = (text: string, onEnd?: () => void) => speak(text, settingsRef.current, onEnd)

  // ---------- Borrado automático de la frase ----------
  const cancelAutoClear = () => {
    clearTimeout(clearTimer.current)
    clearGen.current += 1
    setClearing(0)
  }
  /** Sin decir la frase: se borra tras N segundos sin tocar nada. Cada toque reinicia la cuenta. */
  const scheduleIdleClear = (length: number) => {
    cancelAutoClear()
    if (!length || !settingsRef.current.autoClear) return
    setClearing(clearGen.current)
    clearTimer.current = setTimeout(() => {
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
      if (gen !== clearGen.current) return
      if (settingsRef.current.clearAfterSpeak) setSentence([])
      else scheduleIdleClear(sentence.length)
    })
  }

  const onCellTap = (cell: Cell) => {
    if (cell.kind === 'folder') {
      if (cell.target && lib.boards[cell.target]) setHistory((h) => [...h, cell.target!])
      scheduleIdleClear(sentence.length)
      return
    }
    const next = [...sentence, cell]
    scheduleIdleClear(next.length)
    setSentence(next)
    if (settings.speakOnTap) say(realize(next)[next.length - 1] || cell.label)
  }

  // ---------- Edición ----------
  const updateBoard = (id: string, fn: (b: Board) => Board) => setLib((l) => (l ? { ...l, boards: { ...l.boards, [id]: fn(l.boards[id]) } } : l))
  const strip = ({ row: _r, col: _c, ...cell }: Cell): NewCell => cell

  const saveCell = (cell: Cell, isNew: boolean) => {
    updateBoard(board.id, (b) => ({ ...b, cells: isNew ? [...b.cells, cell] : b.cells.map((c) => (c.id === cell.id ? cell : c)) }))
    setEditTarget(null)
  }
  const deleteCell = (id: string) => {
    updateBoard(board.id, (b) => ({ ...b, cells: b.cells.filter((c) => c.id !== id) }))
    setEditTarget(null)
  }
  const resize = (rows: number, cols: number) => {
    const next = resizeBoard(board, rows, cols)
    if (next) updateBoard(board.id, () => next)
    else setNotice('No se puede reducir: hay celdas en la fila o columna que quitarías. Muévelas o elimínalas antes.')
  }
  const reorganize = () =>
    Alert.alert('Reordenar por categorías', 'Todas las celdas de este tablero se vuelven a colocar por columnas de categoría (cambiarán de sitio).', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reordenar',
        onPress: () => {
          updateBoard(board.id, (b) =>
            relayoutBoard(b, (cells) =>
              sortCells(cells.map((c) => (c.kind === 'word' && c.category === 'noun' && classify(c.label) === 'person' ? { ...c, category: 'person' as const } : c))),
            ),
          )
          setNotice('Tablero reordenado por categorías.')
        },
      },
    ])
  const onTapSlot = (row: number, col: number, cell: Cell | undefined) => {
    if (movingId) {
      updateBoard(board.id, (b) => moveCellTo(b, movingId, row, col))
      setMovingId(null)
    } else if (cell) setEditTarget({ cell, isNew: false })
    else setEditTarget({ cell: { id: uid('c'), kind: 'word', label: '', category: 'noun', row, col }, isNew: true })
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
      const msgs: string[] = []
      if (updated.rows > host.rows) msgs.push(`No había huecos suficientes: se añadieron ${updated.rows - host.rows} fila(s).`)
      if (outside.length) msgs.push(`Su zona estaba llena y se colocaron en la casilla libre más cercana: ${outside.join(', ')}.`)
      if (msgs.length) setNotice(msgs.join(' '))
      const { [sub.rootId]: _root, ...folders } = sub.boards
      return { ...l, boards: { ...l.boards, ...folders, [host.id]: updated } }
    })
    setShowCreator(false)
  }
  const addAsFolder = async (sub: Library) => {
    const folder = await folderCell(sub.boards[sub.rootId])
    setLib((l) => (l ? { ...l, boards: { ...l.boards, ...sub.boards, [board.id]: placeCell(l.boards[board.id], folder) } } : l))
    setShowCreator(false)
  }

  const showLog = settings.showTapLog && !editing && width >= 900

  return (
    <View style={styles.app}>
      <StatusBar hidden />
      <View style={styles.row}>
        <View style={[styles.main, compact && styles.mainCompact]}>
          {/* Barra superior */}
          <View style={styles.topbar}>
            {!editing ? (
              <>
                <TapButton label="Inicio" onTap={() => (setHistory([]), scheduleIdleClear(sentence.length))} style={styles.navBtn}>
                  <Text style={styles.navText}>🏠{compact ? '' : ' Inicio'}</Text>
                </TapButton>
                <TapButton label="Atrás" disabled={!history.length} onTap={() => (setHistory((h) => h.slice(0, -1)), scheduleIdleClear(sentence.length))} style={styles.navBtn}>
                  <Text style={styles.navText}>↩{compact ? '' : ' Atrás'}</Text>
                </TapButton>
                <Text style={styles.title} numberOfLines={1}>
                  {board.name}
                </Text>
                <ToolBtn text={compact ? '✎' : '✎ Editar'} onPress={() => (setEditing(true), cancelAutoClear())} />
                <ToolBtn text="⚙︎" onPress={() => setShowSettings(true)} />
              </>
            ) : (
              <View style={styles.editBar}>
                <TextInput style={styles.nameInput} value={board.name} onChangeText={(t) => updateBoard(board.id, (b) => ({ ...b, name: t }))} />
                <Text style={styles.muted}>Filas</Text>
                <ToolBtn text="−" onPress={() => resize(board.rows - 1, board.cols)} />
                <Text style={styles.count}>{board.rows}</Text>
                <ToolBtn text="+" onPress={() => resize(board.rows + 1, board.cols)} />
                <Text style={styles.muted}>Columnas</Text>
                <ToolBtn text="−" onPress={() => resize(board.rows, board.cols - 1)} />
                <Text style={styles.count}>{board.cols}</Text>
                <ToolBtn text="+" onPress={() => resize(board.rows, Math.min(16, board.cols + 1))} />
                <ToolBtn text={compact ? '⇅' : '⇅ Reordenar'} onPress={reorganize} />
                <View style={{ flex: 1 }} />
                <ToolBtn text={compact ? '✨' : '✨ Crear desde texto'} onPress={() => setShowCreator(true)} />
                <ToolBtn text="✓ Terminar" primary onPress={() => (setEditing(false), setMovingId(null))} />
              </View>
            )}
          </View>

          {!editing && (
            <SentenceBar
              tokens={sentence}
              compact={compact}
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
            <View style={styles.hintRow}>
              <Text style={[styles.hint, movingId && { color: colors.accent, fontWeight: '700' }]}>
                {movingId
                  ? 'Toca la casilla de destino (si está ocupada, se intercambian).'
                  : 'Toca una celda para editarla o una casilla vacía para añadir. Las celdas nunca se mueven solas.'}
              </Text>
              {movingId && <ToolBtn text="Cancelar" onPress={() => setMovingId(null)} />}
            </View>
          )}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}

          <View style={styles.boardArea}>
            <BoardView
              board={board}
              editing={editing}
              gap={compact ? 5 : 8}
              onTapCell={onCellTap}
              onTapSlot={onTapSlot}
              movingId={movingId}
              onRenameZone={(zone, name) =>
                updateBoard(board.id, (b) => {
                  const zoneLabels = { ...b.zoneLabels }
                  if (name === null) delete zoneLabels[zone]
                  else zoneLabels[zone] = name
                  return { ...b, zoneLabels }
                })
              }
            />
          </View>
        </View>
        {showLog && <TapLog onClose={() => setSettings({ ...settings, showTapLog: false })} />}
      </View>

      {editTarget && (
        <CellEditor
          cell={editTarget.cell}
          isNew={editTarget.isNew}
          onSave={(c) => saveCell(c, editTarget.isNew)}
          onDelete={editTarget.isNew ? undefined : () => deleteCell(editTarget.cell.id)}
          onStartMove={editTarget.isNew ? undefined : () => (setMovingId(editTarget.cell.id), setEditTarget(null))}
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
        <SettingsSheet
          settings={settings}
          onChange={setSettings}
          onResetBoards={() => {
            setShowSettings(false)
            void loadSample()
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </View>
  )
}

function ToolBtn({ text, onPress, primary }: { text: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.tool, primary && styles.toolPrimary, pressed && { opacity: 0.6 }]}>
      <Text style={[styles.toolText, primary && { color: 'white' }]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, padding: 10, gap: 10 },
  mainCompact: { padding: 6, gap: 6 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  navBtn: { height: 48, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, borderRadius: radius },
  navText: { fontSize: 17, fontWeight: '700', color: colors.text },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text },
  editBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nameInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 17, fontWeight: '700', minWidth: 140, backgroundColor: colors.surface },
  count: { fontWeight: '800', fontSize: 16, color: colors.text, minWidth: 18, textAlign: 'center' },
  tool: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  toolPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  toolText: { fontSize: 15, fontWeight: '600', color: colors.text },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { flex: 1, color: colors.muted, fontSize: 13 },
  notice: { backgroundColor: '#fff4d6', borderColor: '#f0c75e', borderWidth: 1, borderRadius: 10, padding: 8, color: colors.text },
  boardArea: { flex: 1 },
  muted: { color: colors.muted },
})
