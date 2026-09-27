import { useSyncExternalStore } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { tapGuard } from '../tap'
import { colors } from '../theme'

/** Registro de toques (en Ajustes): qué pulsaciones se aceptaron y por qué se ignoraron las demás. */
export function TapLog() {
  const log = useSyncExternalStore(
    (cb) => tapGuard.subscribe(cb),
    () => tapGuard.log,
  )
  const ok = log.filter((e) => e.ok).length
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Registro de toques</Text>
        <Pressable onPress={() => tapGuard.clearLog()}>
          <Text style={styles.link}>Limpiar</Text>
        </Pressable>
      </View>
      <Text style={styles.summary}>
        <Text style={{ color: colors.ok }}>{ok} activados</Text> · <Text style={{ color: colors.bad }}>{log.length - ok} ignorados</Text>
      </Text>
      <ScrollView nestedScrollEnabled>
        {log.map((e) => (
          <View key={e.n} style={styles.item}>
            <Text style={styles.itemLabel}>{e.label}</Text>
            <Text style={{ color: e.ok ? colors.ok : colors.bad, fontSize: 12 }}>
              {e.ok ? '✓' : '⨯'} {e.reason}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { height: 260, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#f8f9fb', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { flex: 1, fontWeight: '700', color: colors.text },
  link: { color: colors.accent, fontWeight: '600' },
  summary: { padding: 10, fontSize: 13 },
  item: { paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eceff3' },
  itemLabel: { fontWeight: '600', color: colors.text, fontSize: 13 },
})
