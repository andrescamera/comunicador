import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { type Category, CATEGORY_LABELS, type Cell, cellColors, classify, FOLDER_TEMPLATES, fold, loadWords, normalizeText, type PictoResult, searchPictos, suggestWords } from '../shared'
import { colors } from '../theme'
import { Picto } from './Picto'
import { Btn, Sheet } from './Sheet'

interface Props {
  cell: Cell
  isNew?: boolean
  onSave: (cell: Cell) => void
  onDelete?: () => void
  onStartMove?: () => void
  onClose: () => void
  /** Crear una carpeta (vacía o con las palabras elegidas), nueva o en lugar de esta celda */
  onCreateFolder?: (name: string, words: string[], picto: number | undefined, folderColor?: Category | 'folder') => Promise<void>
  /** Casillas de cada tablero (para avisar si las palabras elegidas no caben) */
  capacity?: number
  /** Ficha nueva dentro de una carpeta: palabras de su categoría que aún no están */
  suggestions?: { category: string; words: string[] }
  /** Entrar en la carpeta para editar lo que tiene dentro */
  onOpenFolder?: () => void
}

export function CellEditor({ cell, isNew, onSave, onDelete, onStartMove, onClose, onCreateFolder, onOpenFolder, capacity, suggestions }: Props) {
  const [draft, setDraft] = useState<Cell>(cell)
  const [template, setTemplate] = useState<string | undefined>(undefined)
  const [picked, setPicked] = useState<string[]>([]) // palabras elegidas para la carpeta
  const [extra, setExtra] = useState('') // palabra que se escribe para añadir a la carpeta
  const [creating, setCreating] = useState(false)
  // Carpeta nueva: una celda vacía o una palabra que se convierte en carpeta
  const newFolder = draft.kind === 'folder' && cell.kind !== 'folder'
  const [typing, setTyping] = useState(false) // mostrar sugerencias solo mientras se escribe
  const [, setReady] = useState(0)

  useEffect(() => {
    void loadWords().then(() => setReady((n) => n + 1))
  }, [])

  const options = [...(template ? FOLDER_TEMPLATES[template] : []), ...picked.filter((w) => !(template ? FOLDER_TEMPLATES[template] : []).includes(w))]
  const togglePick = (w: string) => setPicked((p) => (p.includes(w) ? p.filter((x) => x !== w) : [...p, w]))
  const addExtra = (w: string) => {
    const word = w.trim()
    if (word && !picked.some((x) => fold(x) === fold(word))) setPicked((p) => [...p, word])
    setExtra('')
  }
  const [query, setQuery] = useState(cell.label)
  // Buscar un pictograma distinto del texto (p. ej. «Navidad» para la ficha «Papá Noel»)
  const [customQuery, setCustomQuery] = useState(false)
  const [results, setResults] = useState<PictoResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (!q) return setResults([])
    setLoading(true)
    const t = setTimeout(async () => {
      setResults(await searchPictos(q))
      setLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const setLabel = (label: string) => {
    setDraft((d) => ({ ...d, label, category: d.kind === 'word' && isNew ? classify(label) : d.category }))
    if (!customQuery) setQuery(label) // los pictogramas siguen al texto salvo que se busque otro
  }
  const { bg, border } = cellColors(draft.category, draft.kind, draft.folderColor)

  return (
    <Sheet
      title={isNew ? 'Nueva celda' : 'Editar celda'}
      onClose={onClose}
      wide
      footer={
        <>
          {onDelete && <Btn title="Eliminar" kind="danger" onPress={onDelete} />}
          {onStartMove && <Btn title="✥ Mover a otra casilla" onPress={onStartMove} />}
          {onOpenFolder && <Btn title="📂 Abrir carpeta" onPress={onOpenFolder} />}
          <View style={{ flex: 1 }} />
          <Btn title="Cancelar" onPress={onClose} />
          <Btn
            title={creating ? 'Creando carpeta…' : newFolder ? (isNew ? 'Crear carpeta' : 'Convertir en carpeta') : 'Guardar'}
            kind="primary"
            disabled={!draft.label.trim() || creating}
            onPress={async () => {
              if (newFolder && onCreateFolder) {
                setCreating(true)
                await onCreateFolder(normalizeText(draft.label), options.filter((w) => picked.includes(w)), draft.picto, draft.folderColor)
                setCreating(false)
              } else onSave({ ...draft, label: normalizeText(draft.label) })
            }}
          />
        </>
      }
    >
      {isNew && suggestions && draft.kind !== 'folder' && (
        <>
          <Text style={styles.label}>{suggestions.category}: toca una para añadirla</Text>
          <Suggestions words={suggestions.words} onPick={setLabel} />
        </>
      )}
      <View style={styles.top}>
        <View style={[styles.preview, { backgroundColor: bg, borderColor: border }]}>
          <Picto id={draft.picto} />
          <Text style={styles.previewLabel} numberOfLines={1}>
            {draft.label || '—'}
          </Text>
        </View>
        <View style={styles.fields}>
          <Text style={styles.label}>Texto</Text>
          <TextInput
            style={styles.input}
            value={draft.label}
            onChangeText={(t) => {
              setLabel(t)
              setTyping(true)
            }}
            autoFocus={isNew}
            autoCorrect={false}
          />
          {typing && (
            <Suggestions
              words={suggestWords(draft.label, 8)}
              onPick={(w) => {
                setLabel(w)
                setTyping(false)
              }}
            />
          )}
          {cell.kind !== 'folder' && (
            <>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.chips}>
                {(onCreateFolder ? (['word', 'phrase', 'folder'] as const) : (['word', 'phrase'] as const)).map((k) => (
                  <Chip
                    key={k}
                    active={draft.kind === k}
                    onPress={() => setDraft({ ...draft, kind: k })}
                    text={k === 'word' ? 'Palabra (se conjuga)' : k === 'phrase' ? 'Frase hecha' : 'Carpeta'}
                  />
                ))}
              </View>
            </>
          )}
          {newFolder && (
            <>
              <Text style={styles.label}>Categoría (luego eliges las palabras)</Text>
              <View style={styles.chips}>
                {[undefined, ...Object.keys(FOLDER_TEMPLATES)].map((t) => (
                  <Chip
                    key={t ?? 'vacia'}
                    active={template === t}
                    onPress={() => {
                      setTemplate(t)
                      setPicked([])
                      if (t && (!draft.label.trim() || (template && draft.label === template))) setLabel(t)
                    }}
                    text={t ?? 'Vacía'}
                  />
                ))}
              </View>
              <View style={[styles.chips, { alignItems: 'center' }]}>
                <Text style={styles.muted}>
                  {picked.length} elegida{picked.length === 1 ? '' : 's'}
                  {capacity !== undefined && picked.length > capacity ? ` · no caben en ${capacity} casillas: crecerán todos los tableros` : ''}
                </Text>
                <Chip text="Todas" active={false} onPress={() => setPicked(options)} />
                <Chip text="Ninguna" active={false} onPress={() => setPicked([])} />
              </View>
              <View style={styles.chips}>
                {options.map((w) => (
                  <Chip key={w} text={w} active={picked.includes(w)} color={picked.includes(w) ? colors.accentSoft : undefined} onPress={() => togglePick(w)} />
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={extra}
                onChangeText={setExtra}
                onSubmitEditing={() => addExtra(extra)}
                placeholder="Añadir otra palabra…"
                autoCorrect={false}
                returnKeyType="done"
              />
              {!!extra.trim() && <Suggestions words={suggestWords(extra, 8, options)} onPick={addExtra} />}
            </>
          )}
          {draft.kind === 'folder' && (
            <>
              <Text style={styles.label}>Color</Text>
              <View style={styles.chips}>
                <Chip active={!draft.folderColor} onPress={() => setDraft({ ...draft, folderColor: undefined })} text="Como su grupo" />
                <Chip active={draft.folderColor === 'folder'} color={cellColors('misc', 'folder').bg} onPress={() => setDraft({ ...draft, folderColor: 'folder' })} text="Marrón (carpeta)" />
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <Chip key={c} active={draft.folderColor === c} color={cellColors(c, 'word').bg} onPress={() => setDraft({ ...draft, folderColor: c })} text={CATEGORY_LABELS[c]} />
                ))}
              </View>
            </>
          )}
          {draft.kind !== 'folder' && (
            <>
              <Text style={styles.label}>Categoría (color y columna)</Text>
              <View style={styles.chips}>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <Chip key={c} active={draft.category === c} color={cellColors(c, 'word').bg} onPress={() => setDraft({ ...draft, category: c })} text={CATEGORY_LABELS[c]} />
                ))}
              </View>
            </>
          )}
          {draft.kind !== 'folder' && (
            <View style={styles.switchRow}>
              <Switch value={!!draft.textOnly} onValueChange={(v) => setDraft({ ...draft, textOnly: v || undefined })} />
              <Text style={styles.switchText}>Solo la palabra, en grande (sin pictograma)</Text>
            </View>
          )}
          {!isNew && (
            <View style={styles.switchRow}>
              <Switch value={!!draft.hidden} onValueChange={(v) => setDraft({ ...draft, hidden: v })} />
              <Text style={styles.switchText}>Ocultar (conserva su sitio)</Text>
            </View>
          )}
        </View>
      </View>
      {/* Los pictogramas siguen a lo escrito en «Texto» */}
      <Text style={styles.label}>Pictograma</Text>
      <View style={[styles.chips, { alignItems: 'center' }]}>
        <TextInput
          style={[styles.input, { flex: 1, minWidth: 220 }]}
          value={customQuery ? query : ''}
          onChangeText={(t) => {
            setQuery(t || draft.label)
            setCustomQuery(!!t)
          }}
          placeholder={`Buscar otro pictograma (ahora: «${draft.label || '…'}»)`}
          autoCorrect={false}
        />
        {customQuery && <Chip text="↺ Usar el texto" active={false} onPress={() => (setCustomQuery(false), setQuery(draft.label))} />}
      </View>
      {loading && <Text style={styles.muted}>Buscando…</Text>}
      {!loading && results.length === 0 && !!query.trim() && <Text style={styles.muted}>Sin resultados en ARASAAC.</Text>}
      <View style={styles.results}>
        {results.map((r) => (
          <Pressable key={r.id} onPress={() => setDraft({ ...draft, picto: r.id })} style={[styles.option, draft.picto === r.id && styles.optionSel]}>
            <Picto id={r.id} size={70} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.credit}>Pictogramas: Sergio Palao · ARASAAC (Gobierno de Aragón) · CC BY-NC-SA</Text>
    </Sheet>
  )
}

/** Sugerencias de palabras (con pictograma en ARASAAC) mientras se escribe */
function Suggestions({ words, onPick }: { words: string[]; onPick: (w: string) => void }) {
  if (!words.length) return null
  return (
    <View style={styles.chips}>
      {words.map((w) => (
        <Chip key={w} text={w} active={false} onPress={() => onPick(w)} />
      ))}
    </View>
  )
}

function Chip({ text, active, onPress, color }: { text: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, color ? { backgroundColor: color } : null, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { fontWeight: '700' }]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  preview: { width: 130, height: 150, borderWidth: 3, borderRadius: 14, padding: 8, alignItems: 'center' },
  previewLabel: { fontWeight: '700', fontSize: 16, color: colors.text },
  fields: { flex: 1, minWidth: 260, gap: 6 },
  label: { fontWeight: '600', color: colors.text, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.accent, borderWidth: 2 },
  chipText: { fontSize: 13, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  switchText: { color: colors.text },
  muted: { color: colors.muted },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 6 },
  optionSel: { borderColor: colors.accent, borderWidth: 3, backgroundColor: colors.accentSoft },
  credit: { fontSize: 11, color: colors.muted },
})
