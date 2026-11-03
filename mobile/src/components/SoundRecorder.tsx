import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import { MAX_RECORDING } from '../shared'
import { play, stop as stopPlayback } from '../soundPlayer'
import { colors } from '../theme'

interface Props {
  /** Guardar la grabación (`uri`: el archivo .m4a en el dispositivo); al terminar se cierra el panel */
  onSave: (uri: string) => Promise<void>
  onClose: () => void
}

type Phase = 'idle' | 'recording' | 'recorded'

const two = (n: number) => String(n).padStart(2, '0')

/** Grabar el sonido de una ficha con el micrófono: grabar, escuchar, repetir y guardar (10 s como mucho) */
export function SoundRecorder({ onSave, onClose }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY) // AAC .m4a (≈ 160 KB en 10 s)
  const state = useAudioRecorderState(recorder, 200)
  const [phase, setPhase] = useState<Phase>('idle')
  const [take, setTake] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const wasRecording = useRef(false)

  const finish = async () => {
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    const uri = recorder.uri
    if (!uri) {
      setPhase('idle')
      return setError('No se grabó nada. Prueba otra vez.')
    }
    setTake(uri)
    setPhase('recorded')
  }

  // Al parar (con el botón o al llegar a los 10 s) queda la grabación lista para escuchar
  useEffect(() => {
    if (wasRecording.current && !state.isRecording && phase === 'recording') {
      void finish()
    }
    wasRecording.current = state.isRecording
  }, [state.isRecording])

  useEffect(
    () => () => {
      stopPlayback()
      if (recorder.isRecording) void recorder.stop().catch(() => {})
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    },
    [],
  )

  const start = async () => {
    setError('')
    stopPlayback()
    try {
      const { granted } = await requestRecordingPermissionsAsync()
      if (!granted) return setError('Sin permiso para usar el micrófono. Actívalo en los ajustes de la tablet.')
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      recorder.record({ forDuration: MAX_RECORDING })
      setTake(null)
      setPhase('recording')
    } catch (e) {
      setPhase('idle')
      setError(`No se pudo grabar: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const stop = async () => {
    try {
      await recorder.stop()
    } catch {
      /* ya estaba parado */
    }
    if (phase === 'recording' && !state.isRecording) void finish() // por si no llega el cambio de estado
  }

  const save = async () => {
    if (!take) return
    stopPlayback()
    setSaving(true)
    setError('')
    try {
      await onSave(take)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const seconds = Math.min(MAX_RECORDING, Math.floor(state.durationMillis / 1000))

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        {phase === 'idle' && (
          <>
            <Btn text="● Grabar" primary onPress={() => void start()} />
            <Text style={styles.muted}>Hasta {MAX_RECORDING} segundos.</Text>
          </>
        )}
        {phase === 'recording' && (
          <>
            <Btn text="■ Parar" primary onPress={() => void stop()} />
            <View style={styles.dot} />
            <Text style={styles.text}>Grabando… 0:{two(seconds)} / 0:{two(MAX_RECORDING)}</Text>
          </>
        )}
        {phase === 'recorded' && take && (
          <>
            <Btn text="▶ Escuchar" onPress={() => void play({ url: take })} />
            <Btn text="↺ Repetir" onPress={() => !saving && void start()} />
            <Btn text={saving ? 'Guardando…' : '✓ Guardar'} primary onPress={() => !saving && void save()} />
          </>
        )}
        {phase !== 'recording' && <Btn text="Cancelar" onPress={() => !saving && onClose()} />}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

function Btn({ text, onPress, primary }: { text: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, primary && styles.btnPrimary]}>
      <Text style={[styles.btnText, primary && { color: 'white' }]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 8, borderWidth: 1, borderColor: colors.accent, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  text: { color: colors.text },
  muted: { color: colors.muted },
  error: { color: '#c62828' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#d32f2f' },
  btn: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnText: { color: colors.text, fontWeight: '600' },
})
