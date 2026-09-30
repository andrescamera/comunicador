import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { type Category, CATEGORY_LABELS, type Cell, cellColors, classify, FOLDER_TEMPLATES, normalizeText, type PictoResult, searchPictos } from '../shared'
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
  /** Crear una carpeta nueva (vacía o con el vocabulario de una plantilla) */
  onCreateFolder?: (name: string, template: string | undefined, picto: number | undefined) => Promise<void>
  /** Entrar en la carpeta para editar lo que tiene dentro */
  onOpenFolder?: () => void
}

export function CellEditor({ cell, isNew, onSave, onDelete, onStartMove, onClose, onCreateFolder, onOpenFolder }: Props) {
  const [draft, setDraft] = useState<Cell>(cell)
  const [template, setTemplate] = useState<string | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const newFolder = !!isNew && draft.kind === 'folder'
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
          {onOpenFolder && <Btn title="📂 Abrir carpeta" onPress={onOpenFolder} />}
          <View style={{ flex: 1 }} />
          <Btn title="Cancelar" onPress={onClose} />
          <Btn
            title={creating ? 'Creando carpeta…' : newFolder ? 'Crear carpeta' : 'Guardar'}
            kind="primary"
            disabled={!draft.label.trim() || creating}
            onPress={async () => {
              if (newFolder && onCreateFolder) {
                setCreating(true)
                await onCreateFolder(normalizeText(draft.label), template, draft.picto)
                setCreating(false)
              } else onSave({ ...draft, label: normalizeText(draft.label) })
            }}
          />
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
          {(draft.kind !== 'folder' || isNew) && (
            <>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.chips}>
                {(isNew ? (['word', 'phrase', 'folder'] as const) : (['word', 'phrase'] as const)).map((k) => (
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
              <Text style={styles.label}>Contenido de la carpeta</Text>
              <View style={styles.chips}>
                {[undefined, ...Object.keys(FOLDER_TEMPLATES)].map((t) => (
                  <Chip
                    key={t ?? 'vacia'}
                    active={template === t}
                    onPress={() => {
                      setTemplate(t)
                      if (t && !draft.label.trim()) setLabel(t)
                    }}
                    text={t ?? 'Vacía'}
                  />
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
