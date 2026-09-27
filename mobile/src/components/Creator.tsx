import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { isTextRecognitionSupported, recognizeText } from '../../modules/text-recognizer'
import { type Cell, generateLibrary, GRID_SIZES, type GridSize, gridFromLines, gridToText, type Library, parseText, type PhotoGrid, SAMPLE_TEXT } from '../shared'
import { colors } from '../theme'
import { BoardView } from './BoardView'
import { CellEditor } from './CellEditor'
import { Btn, Sheet } from './Sheet'

const EXAMPLES = [
  { name: 'Lista de palabras', text: 'Desayuno: yo, querer, más, leche, galletas, zumo, cereales, tostada, terminado, no, "no me gusta"' },
  { name: 'Texto libre', text: 'Recreo: quiero jugar con mis amigos a la pelota en el tobogán y comer el bocadillo' },
  { name: 'Con carpeta', text: 'Merienda: yo, querer, comer, beber, galletas, leche, más, terminado\ncarpeta Parque: columpio, tobogán, arena, "otra vez"' },
  { name: 'Vocabulario núcleo', text: SAMPLE_TEXT },
]

interface Props {
  currentBoardName: string
  onReplace: (lib: Library) => void
  onAddToCurrent: (lib: Library) => void
  onAddAsFolder: (lib: Library) => void
  onClose: () => void
}

export function Creator({ currentBoardName, onReplace, onAddToCurrent, onAddAsFolder, onClose }: Props) {
  const [text, setText] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<Library | null>(null)
  const [tab, setTab] = useState('')
  const [editing, setEditing] = useState<Cell | null>(null)
  const [size, setSize] = useState<GridSize>('auto')
  const [photo, setPhoto] = useState<{ uri: string; grid: PhotoGrid } | null>(null)
  // Mantener filas y columnas: cada línea es una fila y cada palabra entre comas, una columna
  const [gridMode, setGridMode] = useState(false)
  const [reading, setReading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  /** Foto de otro tablero -> texto reconocido en el dispositivo -> filas y columnas -> texto editable */
  const fromPhoto = async () => {
    setPhotoError('')
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 })
    if (picked.canceled || !picked.assets?.[0]) return
    const uri = picked.assets[0].uri
    setReading(true)
    try {
      const result = await recognizeText(uri)
      const grid = gridFromLines(result.lines)
      if (!grid.cells.length) {
        setPhotoError('No se ha encontrado texto en la foto. Prueba con una foto más nítida, de frente y con buena luz.')
        return
      }
      setPhoto({ uri, grid })
      setGridMode(true)
      setText(gridToText(grid))
    } catch (e) {
      setPhotoError(`No se pudo leer la foto: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setReading(false)
    }
  }

  const parsed = useMemo(() => parseText(text, { grid: gridMode }), [text, gridMode])
  const count = parsed.reduce((n, b) => n + b.items.length, 0)

  const generate = async () => {
    setProgress(0)
    // En modo cuadrícula el tamaño y las posiciones salen del propio texto
    const lib = await generateLibrary(parsed, (d, t) => setProgress(Math.round((d / t) * 100)), gridMode ? 'auto' : size)
    setProgress(null)
    setPreview(lib)
    setTab(lib.rootId)
  }
  const updateBoard = (fn: (cells: Cell[]) => Cell[]) =>
    preview && setPreview({ ...preview, boards: { ...preview.boards, [tab]: { ...preview.boards[tab], cells: fn(preview.boards[tab].cells) } } })

  const board = preview?.boards[tab]
  const missing = preview ? Object.values(preview.boards).flatMap((b) => b.cells).filter((c) => !c.picto).length : 0

  if (preview && board) {
    return (
      <Sheet
        title="Revisar tableros"
        onClose={onClose}
        wide
        scroll={false}
        footer={
          <>
            <Btn title="◀ Volver al texto" onPress={() => setPreview(null)} />
            <View style={{ flex: 1 }} />
            <Btn title={`Como carpeta en «${currentBoardName}»`} onPress={() => onAddAsFolder(preview)} />
            <Btn title={`Añadir a «${currentBoardName}»`} onPress={() => onAddToCurrent(preview)} />
            <Btn title="Usar como principal" kind="primary" onPress={() => onReplace(preview)} />
          </>
        }
      >
        <View style={styles.tabs}>
          {Object.values(preview.boards).map((b) => (
            <Pressable key={b.id} onPress={() => setTab(b.id)} style={[styles.tab, b.id === tab && styles.tabActive]}>
              <Text style={[styles.tabText, b.id === tab && { color: 'white' }]}>{b.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.muted}>
          Pulsa una celda para cambiar su pictograma, texto o color.{missing > 0 ? ` ${missing} sin pictograma.` : ''}
        </Text>
        <View style={styles.previewBox}>
          <BoardView board={board} editing onTapCell={() => {}} onTapSlot={(_r, _c, cell) => cell && setEditing(cell)} gap={6} />
        </View>
        {editing && (
          <CellEditor
            cell={editing}
            onClose={() => setEditing(null)}
            onSave={(c) => {
              updateBoard((cells) => cells.map((x) => (x.id === c.id ? c : x)))
              setEditing(null)
            }}
            onDelete={() => {
              updateBoard((cells) => cells.filter((x) => x.id !== editing.id))
              setEditing(null)
            }}
          />
        )}
      </Sheet>
    )
  }

  return (
    <Sheet
      title="Crear tablero"
      onClose={onClose}
      wide
      footer={
        <>
          <Text style={[styles.muted, { alignSelf: 'center' }]}>
            {count} celdas{parsed.length > 1 ? `, ${parsed.length - 1} carpeta(s)` : ''}
          </Text>
          <View style={{ flex: 1 }} />
          <Btn title={progress !== null ? `Buscando pictogramas… ${progress}%` : 'Generar tableros'} kind="primary" disabled={!count || progress !== null} onPress={generate} />
        </>
      }
    >
      {isTextRecognitionSupported && (
        <View style={styles.photoBox}>
          <View style={styles.photoRow}>
            <Text style={styles.section}>📷 Desde una foto</Text>
            <Btn title={reading ? 'Leyendo la foto…' : 'Elegir foto de la galería'} kind="primary" disabled={reading} onPress={fromPhoto} />
            {reading && <ActivityIndicator color={colors.accent} />}
          </View>
          <Text style={styles.muted}>Elige una foto o captura del tablero y recórtala para que se vea solo la cuadrícula. El texto se lee en la tablet, sin enviarlo a ningún sitio.</Text>
          {!!photoError && <Text style={styles.error}>{photoError}</Text>}
          {photo && (
            <View style={styles.photoRow}>
              <Image source={photo.uri} style={styles.thumb} contentFit="contain" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.label}>
                  {photo.grid.cells.length} palabras en {photo.grid.rows} filas × {photo.grid.cols} columnas
                </Text>
                <Text style={styles.muted}>Revisa el texto de abajo y corrige las palabras mal leídas. Cada línea es una fila de la foto; «_» es una casilla vacía.</Text>
              </View>
            </View>
          )}
        </View>
      )}
      <Text style={styles.section}>✏️ Desde texto</Text>
      <Text style={styles.muted}>
        Palabras separadas por comas, o texto libre (se extraen las palabras clave). "Comillas" = frase completa en una celda. Todo va al tablero
        principal; empieza una línea con «carpeta Nombre:» para crear una carpeta. Las líneas con # son comentarios.
      </Text>
      <ScrollView horizontal contentContainerStyle={styles.examples} showsHorizontalScrollIndicator={false}>
        {EXAMPLES.map((ex) => (
          <Btn key={ex.name} title={`Ejemplo: ${ex.name}`} onPress={() => (setText(ex.text), setPhoto(null))} />
        ))}
      </ScrollView>
      <TextInput
        style={styles.textarea}
        multiline
        value={text}
        onChangeText={setText}
        placeholder={'Desayuno: yo, querer, leche, galletas, más, terminado\ncarpeta Parque: columpio, tobogán, "otra vez"'}
        textAlignVertical="top"
        autoCapitalize="none"
      />
      <View style={styles.photoRow}>
        <Switch value={gridMode} onValueChange={setGridMode} />
        <Text style={{ flex: 1, color: colors.text }}>
          Mantener filas y columnas: cada línea es una fila y las palabras quedan en el orden escrito («_» = casilla vacía). Si se desactiva, se ordenan
          por categorías.
        </Text>
      </View>
      {count > 0 && (
        <View style={styles.parsed}>
          {parsed.map((b, i) => (
            <Text key={i} style={styles.parsedLine}>
              <Text style={{ fontWeight: '700' }}>{b.name}</Text>
              <Text style={styles.muted}>
                {i === 0 ? ' (principal)' : ' (carpeta)'}
                {b.gridRows ? ` · ${b.gridRows} filas × ${b.gridCols} columnas` : ''}
              </Text>
              : {b.items.map((it) => (it.kind === 'phrase' ? `“${it.label}”` : it.label)).join(' · ')}
            </Text>
          ))}
        </View>
      )}
      {!gridMode && <Text style={styles.label}>Cuadrícula</Text>}
      <View style={[styles.sizes, gridMode && { display: 'none' }]}>
        {(['auto', ...GRID_SIZES] as GridSize[]).map((g) => {
          const key = g === 'auto' ? 'auto' : `${g.rows}x${g.cols}`
          const active = size === 'auto' ? key === 'auto' : key === `${size.rows}x${size.cols}`
          return (
            <Pressable key={key} onPress={() => setSize(g)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && { color: 'white' }]}>{g === 'auto' ? 'Automática' : `${g.rows}×${g.cols}`}</Text>
            </Pressable>
          )
        })}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 14 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text },
  label: { fontWeight: '600', color: colors.text },
  examples: { gap: 8 },
  textarea: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    fontFamily: 'monospace',
    color: colors.text,
  },
  parsed: { backgroundColor: '#f6f8fa', borderRadius: 10, padding: 10, gap: 4 },
  parsedLine: { fontSize: 13, color: colors.text },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.text, fontWeight: '600' },
  previewBox: { height: 420, maxHeight: '100%' },
  photoBox: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.accentSoft },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 120, height: 90, borderRadius: 8, backgroundColor: 'white' },
  error: { color: colors.bad },
})
