import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  scroll?: boolean
}

/** Ventana modal del editor (interfaz del terapeuta). */
export function Sheet({ title, onClose, children, footer, wide, scroll = true }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.card, wide && styles.wide]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.flex]}>{children}</View>
          )}
          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export function Btn({ title, onPress, kind, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'danger' && styles.btnDanger,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.7 },
      ]}
    >
      <Text style={[styles.btnText, kind === 'primary' && { color: 'white' }, kind === 'danger' && { color: colors.bad }]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,30,45,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: colors.surface, borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '96%' },
  wide: { maxWidth: 1000 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.text },
  close: { fontSize: 20, color: colors.muted },
  body: { padding: 16, gap: 12 },
  flex: { flexShrink: 1 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.line, justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnDanger: { borderColor: '#f0b8b8' },
  btnText: { fontSize: 15, fontWeight: '600', color: colors.text },
})
