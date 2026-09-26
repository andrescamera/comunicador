import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { type Cell, generateLibrary, GRID_SIZES, type GridSize, type Library, parseText, SAMPLE_TEXT } from '../shared'
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

  const parsed = useMemo(() => parseText(text), [text])
  const count = parsed.reduce((n, b) => n + b.items.length, 0)

  const generate = async () => {
    setProgress(0)
    const lib = await generateLibrary(parsed, (d, t) => setProgress(Math.round((d / t) * 100)), size)
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
      title="Crear tableros desde texto"
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
      <Text style={styles.muted}>
        Palabras separadas por comas, o texto libre (se extraen las palabras clave). "Comillas" = frase completa en una celda. Todo va al tablero
        principal; empieza una línea con «carpeta Nombre:» para crear una carpeta. Las líneas con # son comentarios.
      </Text>
      <ScrollView horizontal contentContainerStyle={styles.examples} showsHorizontalScrollIndicator={false}>
        {EXAMPLES.map((ex) => (
          <Btn key={ex.name} title={`Ejemplo: ${ex.name}`} onPress={() => setText(ex.text)} />
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
      {parsed.length > 0 && (
        <View style={styles.parsed}>
          {parsed.map((b, i) => (
            <Text key={i} style={styles.parsedLine}>
              <Text style={{ fontWeight: '700' }}>{b.name}</Text>
              <Text style={styles.muted}>{i === 0 ? ' (principal)' : ' (carpeta)'}</Text>: {b.items.map((it) => (it.kind === 'phrase' ? `“${it.label}”` : it.label)).join(' · ')}
            </Text>
          ))}
        </View>
      )}
      <Text style={styles.label}>Cuadrícula</Text>
      <View style={styles.sizes}>
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
})
