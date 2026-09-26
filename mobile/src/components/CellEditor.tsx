import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { type Category, CATEGORY_LABELS, type Cell, cellColors, classify, normalizeText, type PictoResult, searchPictos } from '../shared'
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
}

export function CellEditor({ cell, isNew, onSave, onDelete, onStartMove, onClose }: Props) {
  const [draft, setDraft] = useState<Cell>(cell)
  const [query, setQuery] = useState(cell.label)
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
    setQuery(label)
  }
  const { bg, border } = cellColors(draft.category, draft.kind)

  return (
    <Sheet
      title={isNew ? 'Nueva celda' : 'Editar celda'}
      onClose={onClose}
      wide
      footer={
        <>
          {onDelete && <Btn title="Eliminar" kind="danger" onPress={onDelete} />}
          {onStartMove && <Btn title="✥ Mover a otra casilla" onPress={onStartMove} />}
          <View style={{ flex: 1 }} />
          <Btn title="Cancelar" onPress={onClose} />
          <Btn title="Guardar" kind="primary" disabled={!draft.label.trim()} onPress={() => onSave({ ...draft, label: normalizeText(draft.label) })} />
        </>
      }
    >
      <View style={styles.top}>
        <View style={[styles.preview, { backgroundColor: bg, borderColor: border }]}>
          <Picto id={draft.picto} />
          <Text style={styles.previewLabel} numberOfLines={1}>
            {draft.label || '—'}
          </Text>
        </View>
        <View style={styles.fields}>
          <Text style={styles.label}>Texto</Text>
          <TextInput style={styles.input} value={draft.label} onChangeText={setLabel} autoFocus={isNew} />
          {draft.kind !== 'folder' && (
            <>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.chips}>
                {(['word', 'phrase'] as const).map((k) => (
                  <Chip key={k} active={draft.kind === k} onPress={() => setDraft({ ...draft, kind: k })} text={k === 'word' ? 'Palabra (se conjuga)' : 'Frase hecha'} />
                ))}
              </View>
              <Text style={styles.label}>Categoría (color y columna)</Text>
              <View style={styles.chips}>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <Chip key={c} active={draft.category === c} color={cellColors(c, 'word').bg} onPress={() => setDraft({ ...draft, category: c })} text={CATEGORY_LABELS[c]} />
                ))}
              </View>
            </>
          )}
          {!isNew && (
            <View style={styles.switchRow}>
              <Switch value={!!draft.hidden} onValueChange={(v) => setDraft({ ...draft, hidden: v })} />
              <Text style={styles.switchText}>Ocultar (conserva su sitio)</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.label}>Buscar pictograma</Text>
      <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="p. ej. galletas" />
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
