import { type InputHTMLAttributes, useEffect, useState } from 'react'
import { loadWords, suggestWords } from '../lib/suggest'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (text: string) => void
  /** Al elegir una sugerencia (clic o Intro). Si no se pasa, la sugerencia sustituye al texto. */
  onPick?: (word: string) => void
  /** Palabras que no se sugieren (p. ej. las que ya están en la carpeta) */
  exclude?: string[]
}

/** Campo de texto con sugerencias de palabras que tienen pictograma (flechas + Intro, o clic). */
export function WordInput({ value, onChange, onPick, exclude, ...rest }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [, setReady] = useState(0) // redibuja cuando llega la lista completa de ARASAAC

  useEffect(() => {
    void loadWords().then(() => setReady((n) => n + 1))
  }, [])

  const suggestions = open ? suggestWords(value, 8, exclude) : []
  const pick = (w: string) => {
    if (onPick) onPick(w)
    else onChange(w)
    setOpen(false)
    setActive(-1)
  }

  return (
    <div className="word-input">
      <input
        {...rest}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!suggestions.length) {
            if (e.key === 'Enter' && onPick && value.trim()) {
              e.preventDefault()
              pick(value.trim())
            }
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => (a + 1) % suggestions.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (active >= 0) pick(suggestions[active])
            else if (onPick && value.trim()) pick(value.trim())
            else setOpen(false)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {suggestions.length > 0 && (
        <ul className="word-suggestions" role="listbox">
          {suggestions.map((w, i) => (
            <li
              key={w}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // mousedown (antes del blur del campo) para que el clic llegue
              onMouseDown={(e) => {
                e.preventDefault()
                pick(w)
              }}
            >
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
