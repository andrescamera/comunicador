import { useEffect, useState } from 'react'
import { bestPicto } from '../lib/arasaac'
import { fold } from '../lib/suggest'
import { Picto } from './Picto'
import { WordInput } from './WordInput'

interface Props {
  /** Palabras propuestas (las de la categoría elegida) */
  words: string[]
  picked: string[]
  onChange: (update: (picked: string[]) => string[]) => void
  /** Casillas de cada tablero: para avisar si lo elegido no cabe */
  capacity?: number
}

/**
 * Elegir qué palabras entran en una carpeta: se marcan tocando la ficha y se pueden añadir
 * otras escribiéndolas (con sugerencias).
 */
export function WordPicker({ words, picked, onChange, capacity }: Props) {
  const [extra, setExtra] = useState<string[]>([]) // añadidas a mano, fuera de la categoría
  const [text, setText] = useState('')
  const pictos = usePictos([...words, ...extra])
  const all = [...words, ...extra.filter((w) => !words.some((x) => fold(x) === fold(w)))]
  const isPicked = (w: string) => picked.includes(w)
  // Se guarda en el orden de la lista (el de la categoría), no en el de los clics
  const toggle = (w: string) => onChange((p) => all.filter((x) => (x === w ? !p.includes(x) : p.includes(x))))
  const add = (w: string) => {
    const word = w.trim()
    if (!word) return
    const existing = all.find((x) => fold(x) === fold(word))
    if (existing) {
      if (!isPicked(existing)) toggle(existing)
    } else {
      setExtra((e) => [...e, word])
      onChange((p) => [...p, word])
    }
    setText('')
  }

  return (
    <div className="word-picker">
      <div className="row">
        <span>
          {picked.length} elegida{picked.length === 1 ? '' : 's'}
          {capacity !== undefined && picked.length > capacity && (
            <span className="warn"> · no caben en {capacity} casillas: crecerán todos los tableros</span>
          )}
        </span>
        <span className="spacer" />
        <button type="button" onClick={() => onChange(() => all)}>Todas</button>
        <button type="button" onClick={() => onChange(() => [])}>Ninguna</button>
      </div>
      <div className="word-grid">
        {all.map((w) => (
          <button key={w} type="button" className={`word-option ${isPicked(w) ? 'selected' : ''}`} onClick={() => toggle(w)} aria-pressed={isPicked(w)}>
            <Picto id={pictos[w]} alt={w} />
            <span>{w}</span>
          </button>
        ))}
      </div>
      <WordInput value={text} onChange={setText} onPick={add} exclude={all} placeholder="Añadir otra palabra…" />
    </div>
  )
}

/** Pictogramas de una lista de palabras, pedidos de pocos en pocos para no saturar ARASAAC. */
export function usePictos(words: string[]): Record<string, number | undefined> {
  const [found, setFound] = useState<Record<string, number | undefined>>({})
  const key = words.join('|')
  useEffect(() => {
    let cancelled = false
    const queue = words.filter((w) => !(w in found))
    const worker = async () => {
      for (let w = queue.shift(); w !== undefined && !cancelled; w = queue.shift()) {
        const p = await bestPicto(w)
        if (!cancelled) setFound((f) => ({ ...f, [w]: p?.id }))
      }
    }
    void Promise.all(Array.from({ length: 6 }, worker))
    return () => {
      cancelled = true
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return found
}

/** Palabras propuestas para una ficha nueva (p. ej. los animales que faltan en la carpeta «Animales») */
export function WordSuggestions({ title, words, selected, onPick }: { title: string; words: string[]; selected?: string; onPick: (word: string, picto: number | undefined) => void }) {
  const pictos = usePictos(words)
  if (!words.length) return null
  return (
    <div className="word-picker">
      <strong>{title}</strong>
      <div className="word-grid">
        {words.map((w) => (
          <button key={w} type="button" className={`word-option ${selected === w ? 'selected' : 'suggested'}`} onClick={() => onPick(w, pictos[w])}>
            <Picto id={pictos[w]} alt={w} />
            <span>{w}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
