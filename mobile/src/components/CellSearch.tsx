import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { bestSpoken, type CellHit, type Library, searchCells } from '../shared'
import { colors } from '../theme'
import { Picto } from './Picto'
import { Sheet } from './Sheet'

const clean = (s: string) => s.replace(/[.,;:!?¿¡"]/g, '').trim()

const ERRORS: Record<string, string> = {
  'not-allowed': 'Sin permiso para el micrófono. Actívalo en los ajustes de la tablet (Aplicaciones › Comunicador › Permisos).',
  'service-not-allowed': 'El reconocimiento de voz de Google no está disponible en esta tablet. Escribe la palabra.',
  'language-not-supported': 'El reconocimiento de voz no tiene el español instalado. Escribe la palabra.',
  busy: 'El micrófono está ocupado. Prueba otra vez en un momento.',
}

// Fallos que no se arreglan volviendo a escuchar: se para y se avisa (el resto, se vuelve a escuchar)
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported', 'network', 'audio-capture'])
const RESTART_MS = 300

/**
 * 🔍 Buscar una ficha en todos los tableros y llevar a ella. Con `voice` (ajuste «Buscar con la voz») escucha
 * todo el rato mientras está abierta (al acabar cada frase o tras un silencio vuelve a escuchar) y lo dicho
 * rellena la búsqueda; sin él, no hay micrófono. Deja de escuchar si se escribe o se pulsa 🎤 (otra vez 🎤
 * vuelve a escuchar). La hoja solo se cierra al tocar un resultado (la voz oye también lo que se habla alrededor).
 */
export function CellSearch({ lib, voice, onPick, onClose }: { lib: Library; voice: boolean; onPick: (hit: CellHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const hits = useMemo(() => searchCells(lib, query), [lib, query])
  // Los avisos del reconocimiento llegan fuera de React: siempre con lo último
  const latest = useRef(lib)
  useEffect(() => {
    latest.current = lib
  })
  // Por qué no hay que volver a escuchar: se escribió, se paró con 🎤, un fallo sin arreglo o ya se cerró
  const stopped = useRef<'typed' | 'paused' | 'fatal' | 'closed' | null>(null)
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const start = () => {
    if (stopped.current) return
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'es-ES',
        interimResults: true,
        maxAlternatives: 3,
        continuous: false,
        // Para palabras sueltas Google recomienda este modelo (con el de dictado a veces no devuelve nada)
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search' },
      })
    } catch {
      stopped.current = 'fatal'
      setMicError('No se ha podido usar el reconocimiento de voz. Escribe la palabra.')
    }
  }

  useSpeechRecognitionEvent('start', () => setListening(true))
  useSpeechRecognitionEvent('end', () => {
    setListening(false)
    // Mientras la lupa esté abierta, vuelve a escuchar
    clearTimeout(restartTimer.current)
    if (!stopped.current) restartTimer.current = setTimeout(start, RESTART_MS)
  })
  useSpeechRecognitionEvent('result', (e) => {
    if (stopped.current === 'typed') return
    const alternatives = e.results.map((r) => clean(r.transcript)).filter(Boolean)
    if (!alternatives.length) return
    setMicError('')
    setQuery(e.isFinal ? bestSpoken(latest.current, alternatives) : alternatives[0])
  })
  useSpeechRecognitionEvent('error', (e) => {
    // Silencio, no se entendió, ocupado...: se vuelve a escuchar sin avisar
    if (!FATAL.has(e.error)) {
      clearTimeout(restartTimer.current)
      if (!stopped.current) restartTimer.current = setTimeout(start, RESTART_MS * 3) // por si no llega «end»
      return
    }
    stopped.current = 'fatal'
    setMicError(ERRORS[e.error] ?? 'No se ha podido reconocer la voz. Escribe la palabra.')
  })

  // 🎤: para o vuelve a escuchar
  const toggle = async () => {
    clearTimeout(restartTimer.current)
    if (listening) {
      stopped.current = 'paused'
      return ExpoSpeechRecognitionModule.abort()
    }
    setMicError('')
    stopped.current = null
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!granted) {
        stopped.current = 'fatal'
        return setMicError(ERRORS['not-allowed'])
      }
      start()
    } catch {
      stopped.current = 'fatal'
      setMicError('No se ha podido usar el reconocimiento de voz. Escribe la palabra.')
    }
  }

  useEffect(() => {
    if (voice) void toggle() // al abrir ya escucha
    return () => {
      stopped.current = 'closed'
      clearTimeout(restartTimer.current)
      ExpoSpeechRecognitionModule.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet title="Buscar una ficha" onClose={onClose} wide>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => {
            if (voice && stopped.current !== 'closed') {
              stopped.current = 'typed' // si se escribe, deja de escuchar (🎤 vuelve a escuchar)
              clearTimeout(restartTimer.current)
              ExpoSpeechRecognitionModule.abort()
            }
            setQuery(t)
          }}
          placeholder={listening ? 'Escuchando… di la palabra' : voice ? 'Escribe o di una palabra: agua, mamá, parque…' : 'Escribe una palabra: agua, mamá, parque…'}
          placeholderTextColor={listening ? colors.accent : colors.muted}
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => hits[0] && onPick(hits[0])}
        />
        {voice && (
          <Pressable
            onPress={() => void toggle()}
            style={[styles.mic, listening && styles.micOn]}
            accessibilityLabel={listening ? 'Dejar de escuchar' : 'Volver a escuchar'}
          >
            <Text style={styles.micText}>🎤</Text>
          </Pressable>
        )}
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
