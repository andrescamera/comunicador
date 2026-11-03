import { useEffect, useRef, useState } from 'react'
import { MAX_RECORDING } from '../lib/sounds'

interface Props {
  /** Guardar la grabación (la sube al tablero); al terminar se cierra el panel */
  onSave: (audio: Blob, mime: string) => Promise<void>
  onClose: () => void
}

type Phase = 'idle' | 'recording' | 'recorded'

/** Formato de grabación: AAC (.m4a) si el navegador sabe; si no, Opus (.webm) */
function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
}

/** Grabar el sonido de una ficha con el micrófono: grabar, escuchar, repetir y guardar (10 s como mucho) */
export function SoundRecorder({ onSave, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [take, setTake] = useState<{ blob: Blob; mime: string; url: string } | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const audio = useRef<HTMLAudioElement | null>(null)

  const release = () => {
    window.clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }

  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null
        recorder.current.stop()
      }
      release()
      audio.current?.pause()
    },
    [],
  )
  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url)
  }, [take])

  const start = async () => {
    setError('')
    audio.current?.pause()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return setError('Este navegador no permite grabar con el micrófono.')
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return setError('No se pudo usar el micrófono. Revisa el permiso del navegador.')
    }
    const mime = pickMime()
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      release()
      const type = rec.mimeType || mime || 'audio/webm'
      const blob = new Blob(chunks, { type })
      if (!blob.size) {
        setPhase('idle')
        return setError('No se grabó nada. Prueba otra vez.')
      }
      setTake({ blob, mime: type, url: URL.createObjectURL(blob) })
      setPhase('recorded')
    }
    recorder.current = rec
    rec.start()
    setTake(null)
    setSeconds(0)
    setPhase('recording')
    const began = Date.now()
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000)
      setSeconds(s)
      if (s >= MAX_RECORDING) stop()
    }, 200)
  }

  const stop = () => {
    window.clearInterval(timer.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  const listen = () => {
    if (!take) return
    audio.current?.pause()
    audio.current = new Audio(take.url)
    void audio.current.play().catch(() => setError('No se pudo reproducir la grabación.'))
  }

  const save = async () => {
    if (!take) return
    audio.current?.pause()
    setSaving(true)
    setError('')
    try {
      await onSave(take.blob, take.mime)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sound-recorder">
      {phase === 'idle' && (
        <>
          <button type="button" className="primary" onClick={() => void start()}>● Grabar</button>
          <span className="muted">Hasta {MAX_RECORDING} segundos.</span>
        </>
      )}
      {phase === 'recording' && (
        <>
          <button type="button" className="primary" onClick={stop}>■ Parar</button>
          <span className="recording-dot" aria-hidden />
          <span>
            Grabando… 0:{String(seconds).padStart(2, '0')} / 0:{String(MAX_RECORDING).padStart(2, '0')}
          </span>
        </>
      )}
      {phase === 'recorded' && (
        <>
          <button type="button" className="small" onClick={listen}>▶ Escuchar</button>
          <button type="button" className="small" disabled={saving} onClick={() => void start()}>↺ Repetir</button>
          <button type="button" className="small primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Guardando…' : '✓ Guardar'}
          </button>
        </>
      )}
      {phase !== 'recording' && (
        <button type="button" className="small" disabled={saving} onClick={onClose}>Cancelar</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
