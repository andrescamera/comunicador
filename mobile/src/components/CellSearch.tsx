import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { type CellHit, foldText, type Library, searchCells } from '../shared'
import { colors } from '../theme'
import { Picto } from './Picto'
import { Sheet } from './Sheet'

const clean = (s: string) => s.replace(/[.,;:!?¿¡"]/g, '').trim()

const ERRORS: Record<string, string> = {
  'not-allowed': 'Sin permiso para el micrófono. Actívalo en los ajustes de la tablet (Aplicaciones › Comunicador › Permisos).',
  'service-not-allowed': 'El reconocimiento de voz de Google no está disponible en esta tablet. Escribe la palabra.',
  'language-not-supported': 'El reconocimiento de voz no tiene el español instalado. Escribe la palabra.',
  'no-speech': 'No se ha oído nada. Pulsa 🎤 y di la palabra.',
  'speech-timeout': 'No se ha oído nada. Pulsa 🎤 y di la palabra.',
  network: 'Sin conexión no se reconoce la voz (salvo que la tablet tenga el español descargado). Escribe la palabra.',
  busy: 'El micrófono está ocupado. Prueba otra vez en un momento.',
}

/**
 * 🔍 Buscar una ficha en todos los tableros y llevar a ella. Al abrirse ya escucha: si lo dicho coincide
 * con una ficha, va directamente a ella; si no, queda la lista para elegir (o se escribe).
 */
export function CellSearch({ lib, onPick, onClose }: { lib: Library; onPick: (hit: CellHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const hits = useMemo(() => searchCells(lib, query), [lib, query])
  // Los avisos del reconocimiento llegan fuera de React: siempre con lo último
  const latest = useRef({ lib, onPick })
  useEffect(() => {
    latest.current = { lib, onPick }
  })

  useSpeechRecognitionEvent('start', () => setListening(true))
  useSpeechRecognitionEvent('end', () => setListening(false))
  useSpeechRecognitionEvent('result', (e) => {
    const alternatives = e.results.map((r) => clean(r.transcript)).filter(Boolean)
    if (!alternatives.length) return
    if (!e.isFinal) return setQuery(alternatives[0])
    const { lib: l, onPick: pick } = latest.current
    // Si lo dicho coincide con una ficha (en cualquiera de las alternativas), se va directamente a ella
    for (const said of alternatives) {
      const exact = searchCells(l, said).find((h) => foldText(h.cell.label) === foldText(said))
      if (exact) return pick(exact)
    }
    setQuery(alternatives.find((a) => searchCells(l, a).length) ?? alternatives[0])
  })
  useSpeechRecognitionEvent('nomatch', () => setMicError('No se ha entendido. Pulsa 🎤 y di la palabra otra vez.'))
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'aborted') return
    setMicError(ERRORS[e.error] ?? 'No se ha podido reconocer la voz. Escribe la palabra.')
  })

  const listen = async () => {
    if (listening) return ExpoSpeechRecognitionModule.abort()
    setMicError('')
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!granted) return setMicError(ERRORS['not-allowed'])
      ExpoSpeechRecognitionModule.start({
        lang: 'es-ES',
        interimResults: true,
        maxAlternatives: 3,
        continuous: false,
        // Para palabras sueltas Google recomienda este modelo (con el de dictado a veces no devuelve nada)
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
      })
    } catch {
      setMicError('No se ha podido usar el reconocimiento de voz. Escribe la palabra.')
    }
  }

  useEffect(() => {
    void listen() // al abrir ya escucha
    return () => ExpoSpeechRecognitionModule.abort()
  }, [])

  return (
    <Sheet title="Buscar una ficha" onClose={onClose} wide>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => {
            if (listening) ExpoSpeechRecognitionModule.abort() // si se escribe, deja de escuchar
            setQuery(t)
          }}
          placeholder={listening ? 'Escuchando… di la palabra' : 'Escribe o di una palabra: agua, mamá, parque…'}
          placeholderTextColor={listening ? colors.accent : colors.muted}
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => hits[0] && onPick(hits[0])}
        />
        <Pressable
          onPress={() => void listen()}
          style={[styles.mic, listening && styles.micOn]}
          accessibilityLabel={listening ? 'Dejar de escuchar' : 'Decir la palabra con el micrófono'}
        >
          <Text style={styles.micText}>🎤</Text>
        </Pressable>
      </View>
      {!!micError && <Text style={styles.muted}>{micError}</Text>}
      {!!query.trim() && !hits.length && !listening && <Text style={styles.muted}>Ninguna ficha se llama así.</Text>}
      {hits.map((h) => (
        <Pressable key={`${h.board.id}/${h.cell.id}`} onPress={() => onPick(h)} style={({ pressed }) => [styles.hit, pressed && styles.hitPressed]}>
          {h.cell.textOnly ? <View style={styles.picto} /> : <Picto id={h.cell.picto} photo={h.cell.photo} size={48} />}
          <Text style={styles.label} numberOfLines={1}>
            {h.cell.kind === 'folder' ? '📁 ' : h.cell.kind === 'sound' ? '🔊 ' : ''}
            {h.cell.label}
          </Text>
          <Text style={styles.trail} numberOfLines={1}>
            {h.trail.length ? `🏠 › ${h.trail.join(' › ')}` : '🏠 Tablero principal'}
          </Text>
        </Pressable>
      ))}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 22,
    color: colors.text,
  },
  mic: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { borderColor: '#d32f2f', backgroundColor: '#fde8e8' },
  micText: { fontSize: 30 },
  muted: { color: colors.muted, marginBottom: 6 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  hitPressed: { backgroundColor: colors.line },
  picto: { width: 48, height: 48 },
  label: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
  trail: { flex: 1, textAlign: 'right', color: colors.muted },
})
