import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { type Cell, cellColors, realize } from '../shared'
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
  /** Tamaño de una celda del tablero: la barra es la primera fila de la misma cuadrícula */
  height: number
  cellWidth: number
  gap: number
  hint: string
  /** Botón fijo «Charla rápida» (frases hechas) */
  onQuickChat?: () => void
}

export function SentenceBar({ tokens, onSpeak, onBackspace, onClear, clearingMs, clearingKey, height, cellWidth, gap, hint, onQuickChat }: Props) {
  const words = realize(tokens)
  const progress = useRef(new Animated.Value(1)).current

  useEffect(() => {
    progress.stopAnimation()
    progress.setValue(1)
    if (clearingMs > 0) {
      Animated.timing(progress, { toValue: 0, duration: clearingMs, easing: Easing.linear, useNativeDriver: true }).start()
    }
  }, [clearingMs, clearingKey, progress])

  // Cada palabra de la frase se ve como una celda pequeña, con el mismo pictograma y color
  const tokenH = height - 8
  const tokenW = Math.max(40, cellWidth - 8)
  const fontSize = Math.max(10, Math.min(20, tokenW * 0.14, tokenH * 0.15))
  const [barWidth, setBarWidth] = useState(0)
  const maxVisible = Math.max(1, Math.floor((barWidth || 600) / (tokenW + 4)))
  const start = Math.max(0, tokens.length - maxVisible) // si no cabe, se ven las últimas palabras

  return (
    <View style={[styles.bar, { height, gap }]}>
      <TapButton label="Frase (hablar)" onTap={onSpeak} style={styles.sentence}>
        <View style={styles.tokens} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {tokens.length === 0 && <Text style={styles.hint}>{hint}</Text>}
          {tokens.slice(start).map((t, i) => {
            const { bg, border } = cellColors(t.category, t.kind)
            return (
              <View key={start + i} style={[styles.token, { width: tokenW, height: tokenH, backgroundColor: bg, borderColor: border }]}>
                <Picto id={t.picto} />
                <Text style={[styles.word, { fontSize }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {words[start + i]}
                </Text>
              </View>
            )
          })}
        </View>
        {clearingMs > 0 && <Animated.View style={[styles.countdown, { transform: [{ scaleX: progress }] }]} />}
      </TapButton>
      <TapButton label="Borrar última" onTap={onBackspace} style={[styles.action, { width: cellWidth }]}>
        <Text style={[styles.icon, { fontSize: Math.min(height, cellWidth) * 0.3 }]}>⌫</Text>
        <Text style={styles.actionText}>Borrar</Text>
      </TapButton>
      <TapButton label="Borrar todo" onTap={onClear} style={[styles.action, { width: cellWidth }]}>
        <Text style={[styles.icon, { fontSize: Math.min(height, cellWidth) * 0.3 }]}>✕</Text>
        <Text style={styles.actionText}>Todo</Text>
      </TapButton>
      {onQuickChat && (
        <TapButton label="Charla rápida" onTap={onQuickChat} style={[styles.action, styles.quick, { width: cellWidth }]}>
          <Text style={[styles.icon, { fontSize: Math.min(height, cellWidth) * 0.3 }]}>💬</Text>
          <Text style={[styles.actionText, { textAlign: 'center' }]} numberOfLines={2}>
            Charla rápida
          </Text>
        </TapButton>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  quick: { backgroundColor: '#ffd9e8', borderColor: '#e0578f' },
  bar: { flex: 1, flexDirection: 'row' },
  sentence: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius,
    overflow: 'hidden',
  },
  tokens: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3, gap: 4 },
  hint: { color: colors.muted, fontSize: 15, paddingHorizontal: 8 },
  token: { borderWidth: 2, borderRadius: 10, padding: 3, alignItems: 'center' },
  word: { fontWeight: '700', color: colors.text },
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
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius,
  },
  icon: { color: colors.text },
  actionText: { fontWeight: '700', color: colors.text, fontSize: 13 },
})
