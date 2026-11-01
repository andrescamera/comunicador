import { useEffect, useRef, useState } from 'react'
import { soundCredit, soundName, soundQuery, type SoundResult } from '../lib/sounds'

export interface SoundsApi {
  search: (query: string) => Promise<SoundResult[]>
  /** Copia el sonido elegido al tablero y devuelve su ruta */
  pick: (s: SoundResult) => Promise<string>
  /** Reproducir un sonido ya guardado */
  play: (path: string) => void
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
  const [playing, setPlaying] = useState<number | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!custom) setQuery(soundQuery(label)) // la búsqueda sigue al texto salvo que se escriba otra
  }, [label, custom])

  useEffect(() => {
    const q = query.trim()
    if (!api || !q) return setResults([])
    setLoading(true)
    setError('')
    let alive = true
    const timer = window.setTimeout(() => {
      api
        .search(soundQuery(q)) // lo escrito a mano también se traduce si se conoce
        .then((r) => alive && setResults(r))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setLoading(false))
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [query, api])

  useEffect(() => () => audio.current?.pause(), [])

  const preview = (r: SoundResult) => {
    audio.current?.pause()
    if (playing === r.id) return setPlaying(null)
    audio.current = new Audio(r.preview)
    audio.current.onended = () => setPlaying(null)
    setPlaying(r.id)
    void audio.current.play().catch(() => setPlaying(null))
  }

  const choose = async (r: SoundResult) => {
    if (!api) return
    audio.current?.pause()
    setPlaying(null)
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

  if (!api) return <p className="muted sound-picker">Para elegir sonidos, inicia sesión: el tablero tiene que estar en tu cuenta.</p>

  return (
    <div className="sound-picker">
      <div className="sound-current">
        <strong>Sonido</strong>
        {sound ? (
          <>
            <button type="button" className="small" onClick={() => api.play(sound)}>▶ Escuchar</button>
            <span className="muted">{credit}</span>
          </>
        ) : (
          <span className="muted">Aún no tiene: elige uno de la lista.</span>
        )}
      </div>
      <div className="picto-search">
        <input
          value={custom ? query : ''}
          onChange={(e) => {
            setCustom(!!e.target.value)
            setQuery(e.target.value || soundQuery(label))
          }}
          placeholder={`Buscar otro sonido (ahora: «${soundQuery(query) || '…'}»; mejor en inglés: cow, train…)`}
          aria-label="Buscar otro sonido"
        />
        {custom && (
          <button type="button" onClick={() => setCustom(false)}>
            ↺ Usar el texto
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="sound-results">
        {loading && <p className="muted">Buscando…</p>}
        {!loading && !error && results.length === 0 && query.trim() && <p className="muted">Sin resultados en Freesound. Prueba en inglés.</p>}
        {results.map((r) => (
          <div key={r.id} className={`sound-option${playing === r.id ? ' playing' : ''}`}>
            <button type="button" className="small" onClick={() => preview(r)} aria-label={playing === r.id ? 'Parar' : 'Escuchar'}>
              {playing === r.id ? '■' : '▶'}
            </button>
            <span className="sound-name" title={r.name}>{soundName(r.name)}</span>
            <span className="muted">{r.duration} s</span>
            <button type="button" className="small primary" disabled={saving !== null} onClick={() => void choose(r)}>
              {saving === r.id ? 'Guardando…' : 'Usar este'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
