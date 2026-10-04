import { Image } from 'expo-image'
import { useKeepAwake } from 'expo-keep-awake'
import { NavigationBar } from 'expo-navigation-bar'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { BoardView } from './src/components/BoardView'
import { CellEditor } from './src/components/CellEditor'
import { Creator } from './src/components/Creator'
import { SentenceBar } from './src/components/SentenceBar'
import { SettingsSheet } from './src/components/SettingsSheet'
import { TapButton } from './src/components/TapButton'
import {
  bestPicto,
  type Board,
  buildFolder,
  type Cell,
  classify,
  DEFAULT_SETTINGS,
  folderCell,
  starterLibrary,
  generateLibrary,
  type Library,
  moveCellTo,
  type NewCell,
  parseText,
  pictoUrl,
  placeCell,
  realize,
  relayoutBoard,
  normalizeLibrary,
  resizeLibrary,
  sentenceText,
  type Settings,
  sortCells,
  STARTER_NAME,
  useLibraries,
  uid,
  verbFormFor,
  DEFAULT_DYNAMIC,
  predictiveView,
  predictionKey,
  NEXT_PAGE,
  PREV_PAGE,
  OTHER_WORDS,
  categoryFor,
  missingWords,
  zoneOf,
} from './src/shared'
import { speak, warmUpSpeech } from './src/speech'
import { appStore, supabase } from './src/cloud'
import { Btn } from './src/components/Sheet'
import { loadSettings, saveSettings } from './src/storage'
import { tapGuard } from './src/tap'
import { colors, radius } from './src/theme'

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
  useKeepAwake() // la pantalla no se apaga mientras se usa el comunicador
  const { width, height } = useWindowDimensions()
  const compact = Math.min(width, height) < 600

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [sentence, setSentence] = useState<Cell[]>([])
  const [editing, setEditing] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [dynPage, setDynPage] = useState(0) // modo predictivo: página del momento actual
  const [showAll, setShowAll] = useState(false) // «otras palabras»: el tablero completo para la siguiente palabra
  const [notice, setNotice] = useState('')
  const [clearing, setClearing] = useState(0)
  const [area, setArea] = useState({ w: 0, h: 0 }) // espacio útil (sin márgenes) para barra + tablero
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearGen = useRef(0)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  tapGuard.settings = settings

  // Tableros (varios por usuario) y sincronización en la nube
  const cloud = useLibraries({
    supabase,
    store: appStore,
    makeStarter: starterLibrary,
    onOpened: () => (setHistory([]), setSentence([]), setEditing(false)),
  })
  const { lib, setLib, readOnly } = cloud
  const newStarter = async () => cloud.create(await starterLibrary(), STARTER_NAME)

  // Arranque: ajustes + motor de voz listo (los tableros los carga useLibraries)
  useEffect(() => {
    void (async () => {
      const savedSettings = await loadSettings()
      setSettings(savedSettings)
      setLoaded(true)
      void warmUpSpeech(savedSettings)
    })()
  }, [])

  useEffect(() => {
    if (loaded) saveSettings(settings)
  }, [settings, loaded])
  // Todos los tableros con la cuadrícula del principal (también los que llegan de otro dispositivo)
  useEffect(() => {
    if (!lib || readOnly || cloud.downloading) return
    const n = normalizeLibrary(lib)
    if (n !== lib) setLib(n)
  }, [lib])
  const predKey = predictionKey(sentence)
  useEffect(() => setDynPage(0), [predKey])
  useEffect(() => {
    if (!sentence.length) setShowAll(false) // frase nueva: otra vez con predicción
  }, [sentence.length])
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
  const repaired = useRef<string | null>(null)
  useEffect(() => {
    if (!lib || readOnly || cloud.downloading || repaired.current === cloud.activeId) return
    repaired.current = cloud.activeId
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

  if (!lib || cloud.downloading) {
    return (
      <View style={[styles.app, styles.center]}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>{cloud.downloading ? `Descargando «${cloud.active?.name ?? 'tablero'}»…` : 'Preparando tableros…'}</Text>
      </View>
    )
  }

  const currentId = history[history.length - 1] ?? lib.rootId
  // Red de seguridad: si falta el tablero (p. ej. borrado desde otro dispositivo), se usa el principal o el primero
  const board: Board | undefined = lib.boards[currentId] ?? lib.boards[lib.rootId] ?? Object.values(lib.boards)[0]
  if (!board) {
    return (
      <View style={[styles.app, styles.center]}>
        <StatusBar hidden />
        <Text style={styles.muted}>Este tablero está vacío.</Text>
        <Btn title="Crear un tablero de ejemplo" kind="primary" onPress={() => void newStarter()} />
      </View>
    )
  }
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
    setNotice(`Carpeta «${name}» creada. Tócala y pulsa «Abrir carpeta» para editar su contenido.`)
  }

  // Modo dinámico (solo el tablero principal y fuera de edición): lo que encaja en el momento de la frase
  const root = lib.boards[lib.rootId]
  const dynCfg = root?.dynamic?.enabled ? { ...DEFAULT_DYNAMIC, ...root.dynamic } : null
  const view =
    dynCfg && board.id === lib.rootId && !editing && !showAll
      ? predictiveView(lib, dynCfg, sentence, dynPage, area.h > 0 ? area.w / area.h : 1.6).board
      : null

  const onCellTap = (cell: Cell) => {
    if (cell.id === NEXT_PAGE || cell.id === PREV_PAGE) {
      setDynPage((p) => p + (cell.id === NEXT_PAGE ? 1 : -1))
      return
    }
    if (cell.id === OTHER_WORDS) {
      setShowAll(true)
      return
    }
    // Tras elegir una palabra del tablero completo, se vuelve a la predicción
    if (cell.kind !== 'folder') setShowAll(false)
    if (cell.kind === 'folder') {
      if (cell.target && lib.boards[cell.target]) setHistory((h) => [...h, cell.target!])
      scheduleIdleClear(sentence.length)
      return
    }
    const next = [...sentence, cell]
    scheduleIdleClear(next.length)
    setSentence(next)
    if (settings.speakOnTap) say(realize(next)[next.length - 1] || cell.label)
    // Dentro de una carpeta: tras elegir una ficha se vuelve al tablero principal
    if (settings.returnHome && history.length > 0) setHistory([])
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
  // Filas y columnas son comunes a todos los tableros: las fichas miden lo mismo en todas partes
  const resize = (rows: number, cols: number) => {
    const next = resizeLibrary(lib, rows, cols)
    if (next) setLib(next)
    else setNotice('No se puede reducir: no queda ninguna fila o columna vacía. Mueve o elimina alguna ficha antes.')
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

  // Toda la pantalla es una cuadrícula: la primera fila (frase y botones) y debajo las filas del
  // tablero, todas del mismo alto y con las mismas columnas
  const gap = compact ? 4 : 6
  // La geometría sale del tablero principal: fichas y barra superior idénticas en todos los tableros
  const grid = lib.boards[lib.rootId] ?? board
  const cellW = area.w ? (area.w - gap * (grid.cols - 1)) / grid.cols : 90
  const barH = area.h ? Math.max(44, (area.h - gap * grid.rows) / (grid.rows + 1)) : 90
  const icon = Math.min(barH, cellW) * 0.32

  return (
    <View style={styles.app}>
      {/* Pantalla completa: sin barra de estado ni barra de navegación de Android */}
      <StatusBar hidden />
      <NavigationBar hidden />
      <View style={styles.row}>
        <View style={[styles.main, { padding: gap }]}>
          <View style={styles.flex} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {!editing ? (
              // Barra única: navegación · frase · borrar · herramientas del terapeuta
              <View style={[styles.useBar, { height: barH, gap, marginBottom: gap }]}>
                <TapButton label="Inicio" onTap={() => (setHistory([]), scheduleIdleClear(sentence.length))} style={[styles.navBtn, { width: cellW }]}>
                  <Text style={{ fontSize: icon }}>🏠</Text>
                  <Text style={styles.navLabel}>Inicio</Text>
                </TapButton>
                <TapButton
                  label="Atrás"
                  disabled={!history.length}
                  onTap={() => (setHistory((h) => h.slice(0, -1)), scheduleIdleClear(sentence.length))}
                  style={[styles.navBtn, { width: cellW }]}
                >
                  <Text style={{ fontSize: icon, color: colors.text }}>↩</Text>
                  <Text style={styles.navLabel}>Atrás</Text>
                </TapButton>
                <SentenceBar
                  tokens={sentence}
                  height={barH}
                  cellWidth={cellW}
                  gap={gap}
                  hint={history.length ? `${board.name} · toca los pictogramas para formar una frase` : 'Toca los pictogramas para formar una frase'}
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
                <View style={[styles.tools, { width: cellW, gap }]}>
                  {!readOnly && <ToolBtn text="✎" onPress={() => (setEditing(true), cancelAutoClear())} small />}
                  <ToolBtn text="⚙︎" onPress={() => setShowSettings(true)} small />
                </View>
              </View>
            ) : (
              <View style={[styles.editBar, { marginBottom: gap }]}>
                {history.length > 0 && <ToolBtn text="↩ Volver" onPress={() => setHistory((h) => h.slice(0, -1))} />}
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
                {board.id === lib.rootId && (
                  <ToolBtn
                    text={board.dynamic?.enabled ? '✓ Predictivo' : 'Predictivo'}
                    primary={!!board.dynamic?.enabled}
                    onPress={() => updateBoard(board.id, (b) => ({ ...b, dynamic: { ...DEFAULT_DYNAMIC, ...b.dynamic, enabled: !b.dynamic?.enabled } }))}
                  />
                )}
                <ToolBtn text={compact ? '✨' : '✨ Crear tablero'} onPress={() => setShowCreator(true)} />
                <ToolBtn text="✓ Terminar" primary onPress={() => (setEditing(false), setMovingId(null))} />
              </View>
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
          {!editing && board.cells.length === 0 && history.length === 0 && (
            <Text style={styles.notice}>Tablero vacío. Añade fichas desde el ordenador (se sincronizan solas) o pulsa Editar.</Text>
          )}

          <View style={styles.boardArea}>
            <BoardView
              board={view ?? board}
              editing={editing}
              gap={gap}
              labelFor={settings.conjugateLabels ? (c) => verbFormFor(sentence, c) : undefined}
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
        </View>
      </View>

      {editTarget && (
        <CellEditor
          cell={editTarget.cell}
          isNew={editTarget.isNew}
          onSave={(c) => saveCell(c, editTarget.isNew)}
          onDelete={editTarget.isNew ? undefined : () => deleteCell(editTarget.cell.id)}
          onStartMove={editTarget.isNew ? undefined : () => (setMovingId(editTarget.cell.id), setEditTarget(null))}
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
            void newStarter()
          }}
          onClose={() => setShowSettings(false)}
          cloud={cloud}
        />
      )}
    </View>
  )
}

function ToolBtn({ text, onPress, primary, small }: { text: string; onPress: () => void; primary?: boolean; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.tool, small && styles.toolSmall, primary && styles.toolPrimary, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.toolText, primary && { color: 'white' }]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, padding: 10 },
  flex: { flex: 1 },
  useBar: { flexDirection: 'row' },
  navBtn: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, borderRadius: radius },
  navLabel: { fontSize: 13, fontWeight: '700', color: colors.text, paddingHorizontal: 2 },
  tools: {},
  editBar: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nameInput: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 17, fontWeight: '700', minWidth: 140, backgroundColor: colors.surface },
  count: { fontWeight: '800', fontSize: 16, color: colors.text, minWidth: 18, textAlign: 'center' },
  tool: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  toolSmall: { flex: 1, paddingHorizontal: 0, paddingVertical: 0, alignItems: 'center', justifyContent: 'center' },
  toolPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  toolText: { fontSize: 15, fontWeight: '600', color: colors.text },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  hint: { flex: 1, color: colors.muted, fontSize: 13 },
  notice: { backgroundColor: '#fff4d6', borderColor: '#f0c75e', borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6, color: colors.text },
  boardArea: { flex: 1 },
  muted: { color: colors.muted },
})
