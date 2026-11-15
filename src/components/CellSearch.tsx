import { useEffect, useMemo, useRef, useState } from 'react'
import { bestSpoken, type CellHit, searchCells } from '../lib/search'
import type { Library } from '../lib/types'
import { Modal } from './Modal'
import { Picto } from './Picto'

// Reconocimiento de voz del navegador (Chrome, Edge, Safari; Firefox no lo tiene)
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}
const recognitionImpl = (): (new () => Recognition) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition

const clean = (s: string) => s.replace(/[.,;:!?¿¡"]/g, '').trim()

// Fallos que no se arreglan volviendo a escuchar: se para y se avisa (el resto, se vuelve a escuchar)
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported'])
const RESTART_MS = 300

/**
 * 🔍 Buscar una ficha en todos los tableros y llevar a ella, escribiendo o diciéndola (se elige tocando un
 * resultado). Con `voice` (ajuste «Buscar con la voz») escucha todo el rato mientras está abierta (al acabar
 * cada frase o tras un silencio vuelve a escuchar); sin él, no hay micrófono. Deja de escuchar si se escribe
 * o se pulsa 🎤 (otra vez 🎤 vuelve a escuchar).
 */
export function CellSearch({ lib, voice, onPick, onClose }: { lib: Library; voice: boolean; onPick: (hit: CellHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const [Impl] = useState(() => (voice ? recognitionImpl() : undefined))
  const hits = useMemo(() => searchCells(lib, query), [lib, query])
  const latest = useRef(lib)
  useEffect(() => {
    latest.current = lib
  })
  // Por qué no hay que volver a escuchar: se escribió, se paró con 🎤, un fallo sin arreglo o ya se cerró
  const stopped = useRef<'typed' | 'paused' | 'fatal' | 'closed' | null>(null)
  const restartTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    start() // al abrir ya escucha (si está el ajuste de voz)
    return () => {
      stopped.current = 'closed'
      window.clearTimeout(restartTimer.current)
      const r = rec.current
      rec.current = null
      r?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stop = (why: 'typed' | 'paused') => {
    stopped.current = why
    window.clearTimeout(restartTimer.current)
    rec.current?.abort()
  }

  const start = () => {
    if (!Impl || stopped.current) return
    const r = new Impl()
    r.lang = 'es-ES'
    r.interimResults = true
    r.maxAlternatives = 3
    r.onresult = (e) => {
      if (stopped.current === 'typed') return
      const result = e.results[e.results.length - 1]
      const alternatives = Array.from(result, (a) => clean(a.transcript)).filter(Boolean)
      if (!alternatives.length) return
      // La voz solo rellena la búsqueda (oye también lo que se habla alrededor): se elige tocando un resultado
      setQuery(result.isFinal ? bestSpoken(latest.current, alternatives) : alternatives[0])
    }
    r.onerror = (e) => {
      // Silencio, no se entendió...: se vuelve a escuchar sin avisar
      if (!FATAL.has(e.error)) return
      stopped.current = 'fatal'
      setMicError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'El navegador no deja usar el micrófono. Revisa el permiso del micrófono para esta página.'
          : 'No se ha podido reconocer la voz (hace falta conexión a internet).',
      )
    }
    r.onend = () => {
      if (rec.current !== r) return // uno anterior que termina tarde no cuenta
      setListening(false)
      // Mientras la lupa esté abierta, vuelve a escuchar
      window.clearTimeout(restartTimer.current)
      if (!stopped.current) restartTimer.current = window.setTimeout(start, RESTART_MS)
    }
    rec.current = r
    setMicError('')
    setListening(true)
    try {
      r.start()
    } catch {
      stopped.current = 'fatal'
      setListening(false)
      setMicError('No se ha podido usar el reconocimiento de voz.')
    }
  }

  // 🎤: para o vuelve a escuchar
  const toggle = () => {
    if (listening) return stop('paused')
    stopped.current = null
    start()
  }

  return (
    <Modal title="Buscar una ficha" onClose={onClose}>
      <div className="search-row">
        <input
          className="search-input"
          type="search"
          autoFocus
          value={query}
          placeholder={listening ? 'Escuchando… di la palabra' : Impl ? 'Escribe o di una palabra: agua, mamá, parque…' : 'Escribe una palabra: agua, mamá, parque…'}
          onChange={(e) => {
            if (rec.current) stop('typed') // si se escribe, deja de escuchar (🎤 vuelve a escuchar)
            setQuery(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && hits[0]) onPick(hits[0])
            if (e.key === 'Escape') onClose()
          }}
          aria-label="Buscar una ficha"
        />
        {Impl && (
          <button
            type="button"
            className={`search-mic${listening ? ' listening' : ''}`}
            onClick={toggle}
            aria-label={listening ? 'Dejar de escuchar' : 'Volver a escuchar'}
            title={listening ? 'Dejar de escuchar' : 'Volver a escuchar'}
          >
            🎤
          </button>
        )}
      </div>
      {micError && <p className="muted">{micError}</p>}
      {query.trim() && !hits.length && !listening && <p className="muted">Ninguna ficha se llama así.</p>}
      <ul className="search-results">
        {hits.map((h) => (
          <li key={`${h.board.id}/${h.cell.id}`}>
            <button type="button" onClick={() => onPick(h)}>
              {h.cell.textOnly ? <span className="picto picto-empty" aria-hidden /> : <Picto id={h.cell.picto} photo={h.cell.photo} alt="" />}
              <span className="search-label">
                {h.cell.kind === 'folder' ? '📁 ' : h.cell.kind === 'sound' ? '🔊 ' : ''}
                {h.cell.label}
              </span>
              <span className="search-trail">{h.trail.length ? `🏠 › ${h.trail.join(' › ')}` : '🏠 Tablero principal'}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
