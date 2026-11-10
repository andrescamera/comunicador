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

/**
 * 🔍 Buscar una ficha en todos los tableros y llevar a ella, escribiendo o diciéndola (se elige tocando un
 * resultado). Con `voice` (ajuste «Buscar con la voz») al abrirse ya escucha; sin él, no hay micrófono.
 */
export function CellSearch({ lib, voice, onPick, onClose }: { lib: Library; voice: boolean; onPick: (hit: CellHit) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const rec = useRef<Recognition | null>(null)
  const [Impl] = useState(() => (voice ? recognitionImpl() : undefined))
  const hits = useMemo(() => searchCells(lib, query), [lib, query])

  useEffect(() => {
    listen() // al abrir ya escucha (si está el ajuste de voz)
    return () => {
      const r = rec.current
      rec.current = null
      r?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const listen = () => {
    if (!Impl) return
    if (listening) return rec.current?.abort()
    const r = new Impl()
    r.lang = 'es-ES'
    r.interimResults = true
    r.maxAlternatives = 3
    r.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      const alternatives = Array.from(result, (a) => clean(a.transcript)).filter(Boolean)
      if (!alternatives.length) return
      // La voz solo rellena la búsqueda (oye también lo que se habla alrededor): se elige tocando un resultado
      setQuery(result.isFinal ? bestSpoken(lib, alternatives) : alternatives[0])
    }
    r.onerror = (e) =>
      setMicError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'El navegador no deja usar el micrófono. Revisa el permiso del micrófono para esta página.'
          : e.error === 'no-speech'
            ? 'No se ha oído nada. Pulsa 🎤 y di la palabra.'
            : e.error === 'aborted'
              ? ''
              : 'No se ha podido reconocer la voz (hace falta conexión a internet).',
      )
    r.onend = () => {
      if (rec.current === r) setListening(false) // uno anterior que termina tarde no cuenta
    }
    rec.current = r
    setMicError('')
    setListening(true)
    r.start()
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
            rec.current?.abort() // si se escribe, deja de escuchar
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
            onClick={listen}
            aria-label={listening ? 'Dejar de escuchar' : 'Decir la palabra con el micrófono'}
            title={listening ? 'Dejar de escuchar' : 'Decir la palabra con el micrófono'}
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
