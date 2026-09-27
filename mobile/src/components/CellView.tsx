import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { type Cell, cellColors } from '../shared'
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
}

function CellViewBase({ cell, left, top, width, height, pressed, fired, editing, selected }: Props) {
  const { bg, border } = cellColors(cell.category, cell.kind)
  const fontSize = Math.max(10, Math.min(22, width * 0.15, height * 0.16))
  return (
    <View
      style={[
        styles.cell,
        { left, top, width, height, backgroundColor: bg, borderColor: border },
        cell.kind === 'folder' && styles.folder,
        editing && styles.editing,
        cell.hidden && styles.hidden,
        pressed && styles.pressed,
        fired && styles.fired,
        selected && styles.selected,
      ]}
    >
      <Picto id={cell.picto} />
      <Text style={[styles.label, { fontSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {cell.label}
      </Text>
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
  pressed: { borderColor: colors.accent, borderWidth: 4, transform: [{ scale: 0.95 }] },
  fired: { borderColor: colors.ok, borderWidth: 5 },
  selected: { borderColor: colors.accent, borderWidth: 5 },
  label: { fontWeight: '700', color: colors.text, marginTop: 2, textAlign: 'center' },
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
