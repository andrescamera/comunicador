import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { soundCredit, soundName, soundQuery, type SoundResult } from '../shared'
import { play, stop } from '../soundPlayer'
import { colors } from '../theme'

export interface SoundsApi {
  search: (query: string) => Promise<SoundResult[]>
  /** Copia el sonido elegido al tablero y devuelve su ruta */
  pick: (s: SoundResult) => Promise<string>
}

interface Props {
  label: string
  sound?: string
  credit?: string
  onChange: (sound: string, credit: string) => void
  api?: SoundsApi
}

/** Elegir el sonido de una ficha «Sonido»: se busca en Freesound mientras se escribe, como los pictogramas */
export function SoundPicker({ label, sound, credit, onChange, api }: Props) {
  const [custom, setCustom] = useState(false)
  const [query, setQuery] = useState(soundQuery(label))
  const [results, setResults] = useState<SoundResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    if (!custom) setQuery(soundQuery(label))
  }, [label, custom])

  useEffect(() => {
    const q = query.trim()
    if (!api || !q) return setResults([])
    setLoading(true)
    setError('')
    let alive = true
    const timer = setTimeout(() => {
      api
        .search(soundQuery(q)) // lo escrito a mano también se traduce si se conoce
        .then((r) => alive && setResults(r))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setLoading(false))
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query, api])

  useEffect(() => () => stop(), [])

  const choose = async (r: SoundResult) => {
    if (!api) return
    stop()
    setSaving(r.id)
    setError('')
    try {
      onChange(await api.pick(r), soundCredit(r))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(null)
    }
  }

  if (!api) return <Text style={styles.muted}>Para elegir sonidos, inicia sesión: el tablero tiene que estar en tu cuenta.</Text>

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={styles.label}>Sonido</Text>
        {sound ? (
          <>
            <Small text="▶ Escuchar" onPress={() => void play({ path: sound })} />
            <Text style={[styles.muted, { flex: 1 }]} numberOfLines={1}>{credit}</Text>
          </>
        ) : (
          <Text style={styles.muted}>Aún no tiene: elige uno de la lista.</Text>
        )}
      </View>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={custom ? query : ''}
          onChangeText={(t) => {
            setCustom(!!t)
            setQuery(t || soundQuery(label))
          }}
          placeholder={`Buscar otro sonido (ahora: «${soundQuery(query) || '…'}»; mejor en inglés)`}
          autoCorrect={false}
        />
        {custom && <Small text="↺ Usar el texto" onPress={() => setCustom(false)} />}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading && <ActivityIndicator />}
      {!loading && !error && results.length === 0 && !!query.trim() && <Text style={styles.muted}>Sin resultados en Freesound. Prueba en inglés.</Text>}
      {results.map((r) => (
        <View key={r.id} style={styles.option}>
          <Small text="▶" onPress={() => void play({ url: r.preview })} />
          <Text style={styles.name} numberOfLines={1}>{soundName(r.name)}</Text>
          <Text style={styles.muted}>{r.duration} s</Text>
          <Small text={saving === r.id ? 'Guardando…' : 'Usar este'} primary onPress={() => saving === null && void choose(r)} />
        </View>
      ))}
    </View>
  )
}

function Small({ text, onPress, primary }: { text: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, primary && styles.btnPrimary]}>
      <Text style={[styles.btnText, primary && { color: 'white' }]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: { gap: 6, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '600', color: colors.text, fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: colors.text },
  muted: { color: colors.muted },
  error: { color: '#c62828' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 6 },
  name: { flex: 1, color: colors.text },
  btn: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { color: colors.text, fontWeight: '600' },
})
