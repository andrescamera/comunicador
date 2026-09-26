import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { type Cell, realize } from '../shared'
import { colors, radius } from '../theme'
import { Picto } from './Picto'
import { TapButton } from './TapButton'

interface Props {
  tokens: Cell[]
  onSpeak: () => void
  onBackspace: () => void
  onClear: () => void
  /** > 0 mientras hay un borrado automático pendiente */
  clearingMs: number
  clearingKey: number
  compact?: boolean
}

const MAX_VISIBLE = 10

export function SentenceBar({ tokens, onSpeak, onBackspace, onClear, clearingMs, clearingKey, compact }: Props) {
  const words = realize(tokens)
  // Se muestran las últimas palabras si la frase es muy larga
  const start = Math.max(0, tokens.length - MAX_VISIBLE)
  const progress = useRef(new Animated.Value(1)).current

  useEffect(() => {
    progress.stopAnimation()
    progress.setValue(1)
    if (clearingMs > 0) {
      Animated.timing(progress, { toValue: 0, duration: clearingMs, easing: Easing.linear, useNativeDriver: true }).start()
    }
  }, [clearingMs, clearingKey, progress])

  const height = compact ? 70 : 110
  return (
    <View style={[styles.bar, { height }]}>
      <TapButton label="Frase (hablar)" onTap={onSpeak} style={styles.sentence}>
        <View style={styles.tokens}>
          {tokens.length === 0 && <Text style={styles.hint}>Toca los pictogramas para formar una frase</Text>}
          {tokens.slice(start).map((t, i) => (
            <View key={start + i} style={styles.token}>
              <Picto id={t.picto} size={height - 44} />
              <Text style={styles.word} numberOfLines={1}>
                {words[start + i]}
              </Text>
            </View>
          ))}
        </View>
        {clearingMs > 0 && <Animated.View style={[styles.countdown, { transform: [{ scaleX: progress }] }]} />}
      </TapButton>
      <TapButton label="Borrar última" onTap={onBackspace} style={styles.action}>
        <Text style={styles.icon}>⌫</Text>
        <Text style={styles.actionText}>Borrar</Text>
      </TapButton>
      <TapButton label="Borrar todo" onTap={onClear} style={styles.action}>
        <Text style={styles.icon}>✕</Text>
        <Text style={styles.actionText}>Todo</Text>
      </TapButton>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8 },
  sentence: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius,
    overflow: 'hidden',
  },
  tokens: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  hint: { color: colors.muted, fontSize: 16 },
  token: { alignItems: 'center', minWidth: 56, maxWidth: 110 },
  word: { fontWeight: '700', fontSize: 15, color: colors.text },
  countdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: colors.accent,
    transformOrigin: 'left',
  },
  action: {
    width: 84,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius,
  },
  icon: { fontSize: 26, color: colors.text },
  actionText: { fontWeight: '700', color: colors.text },
})
