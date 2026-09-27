import { type ReactNode, useState } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { useTapSurface } from '../tap'
import { colors } from '../theme'

interface Props {
  label: string
  onTap: () => void
  style?: StyleProp<ViewStyle>
  children: ReactNode
  disabled?: boolean
}

/** Botón del comunicador con la misma pulsación robusta que las celdas. */
export function TapButton({ label, onTap, style, children, disabled }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pressed, setPressed] = useState(false)
  const handlers = useTapSurface<'b'>({
    hitTest: (x, y) => (!disabled && x >= 0 && y >= 0 && x <= size.w && y <= size.h ? 'b' : null),
    onTap,
    label: () => label,
    onPressChange: (k) => setPressed(k !== null),
  })
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[styles.base, style, pressed && styles.pressed, disabled && styles.disabled]}
      {...handlers}
    >
      <View pointerEvents="none" style={styles.fill}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Valores explícitos: Android no restablece solo un estilo que se quita (escala, opacidad)
  base: { transform: [{ scale: 1 }], opacity: 1 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { borderColor: colors.accent, transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.4 },
})
