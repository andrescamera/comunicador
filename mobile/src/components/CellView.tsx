import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type Category, type Cell, cellColors } from '../shared'
import { colors } from '../theme'
import { Picto } from './Picto'

interface Props {
  cell: Cell
  left: number
  top: number
  width: number
  height: number
  pressed: boolean
  fired: boolean
  editing: boolean
  selected: boolean
  /** Texto que se ve, si no es la etiqueta (verbos conjugados según la frase) */
  displayLabel?: string
  /** Modo predictivo: no encaja ahora (atenuada, pero se puede tocar) */
  dimmed?: boolean
  /** Color del grupo en el que está (las carpetas lo toman si no tienen uno propio) */
  groupColor?: Category
}

function CellViewBase({ cell, left, top, width, height, pressed, fired, editing, selected, displayLabel, dimmed, groupColor }: Props) {
  const label = displayLabel ?? cell.label
  const { bg, border } = cellColors(cell.category, cell.kind, cell.folderColor, groupColor)
  const fontSize = Math.max(10, Math.min(22, width * 0.15, height * 0.16))
  return (
    <View
      style={[
        styles.cell,
        { left, top, width, height, backgroundColor: bg, borderColor: border },
        cell.kind === 'folder' && styles.folder,
        editing && styles.editing,
        cell.hidden && styles.hidden,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
        fired && styles.fired,
        selected && styles.selected,
      ]}
    >
      {cell.textOnly ? (
        // Solo la palabra, ocupando la casilla
        <Text
          style={[styles.label, styles.bigText, { fontSize: Math.min(width * 0.36, height * 0.55) }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.3}
        >
          {label}
        </Text>
      ) : (
        <>
          <Picto id={cell.picto} />
          <Text style={[styles.label, { fontSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {label}
          </Text>
        </>
      )}
      {editing && cell.hidden && <Text style={styles.badge}>oculta</Text>}
    </View>
  )
}

export const CellView = memo(CellViewBase)

const styles = StyleSheet.create({
  // Valores explícitos (borde continuo, opacidad 1, escala 1): Android reutiliza la vista y no
  // restablece solo un estilo que se quita (p. ej. el borde punteado de la edición)
  cell: {
    position: 'absolute',
    borderWidth: 3,
    borderStyle: 'solid',
    opacity: 1,
    transform: [{ scale: 1 }],
    borderRadius: 14,
    padding: 5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  folder: { borderTopWidth: 10 },
  editing: { borderStyle: 'dashed' },
  hidden: { opacity: 0.35 },
  dimmed: { opacity: 0.22 },
  pressed: { borderColor: colors.accent, borderWidth: 4, transform: [{ scale: 0.95 }] },
  fired: { borderColor: colors.ok, borderWidth: 5 },
  selected: { borderColor: colors.accent, borderWidth: 5 },
  label: { fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'center' },
  bigText: { flex: 1, marginTop: 0, fontWeight: '600', textAlignVertical: 'center', includeFontPadding: false },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.text,
    color: 'white',
    fontSize: 10,
    paddingHorizontal: 5,
    borderRadius: 6,
    overflow: 'hidden',
  },
})
