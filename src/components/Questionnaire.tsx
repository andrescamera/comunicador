import { type ReactNode, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/cloud'
import { type Answers, inflect, SECTIONS, sectionCount } from '../lib/questionnaire'
import { fetchByToken, type QuestionnaireStatus, saveByToken, toAnswers } from '../lib/questionnaires'

/**
 * Página del cuestionario de vocabulario a pantalla completa (/cuestionario/<token>). La abre el
 * tutor con el enlace que le pasa la logopeda, sin cuenta: lo que marca se guarda solo en el
 * servidor y al final lo envía. Una pantalla por sección, como el cuestionario en papel.
 */
export function QuestionnairePage({ token }: { token: string }) {
  const [a, setA] = useState<Answers | null>(null)
  const [status, setStatus] = useState<QuestionnaireStatus>('pendiente')
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState<'guardado' | 'guardando' | 'sin guardar'>('guardado')
  const [sending, setSending] = useState(false)
  const dirty = useRef(false)

  useEffect(() => {
    fetchByToken(supabase, token)
      .then((q) => {
        if (!q) return setNotFound(true)
        setA(toAnswers(q.answers, q.child_name))
        setStatus(q.status)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  // Guardar solo, un segundo después del último cambio
  useEffect(() => {
    if (!a || !dirty.current || status === 'enviado') return
    setSaved('sin guardar')
    const t = setTimeout(() => {
      setSaved('guardando')
      saveByToken(supabase, token, a)
        .then((s) => {
          setStatus(s)
          setSaved('guardado')
          setError('')
        })
        .catch((e: unknown) => {
          setSaved('sin guardar')
          setError(`No se ha podido guardar: ${e instanceof Error ? e.message : String(e)}. Revise la conexión.`)
        })
    }, 1000)
    return () => clearTimeout(t)
  }, [a, token, status])

  // Avisar antes de cerrar la página con cambios sin guardar
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saved !== 'guardado') e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])

  const change = (next: Answers) => {
    dirty.current = true
    setA(next)
  }

  const send = async () => {
    if (!a || !confirm('¿Enviar el cuestionario a la logopeda? Después ya no se podrá cambiar.')) return
    setSending(true)
    try {
      setStatus(await saveByToken(supabase, token, a, true))
      setSaved('guardado')
      setError('')
    } catch (e) {
      setError(`No se ha podido enviar: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSending(false)
    }
  }

  if (notFound) {
    return (
      <div className="q-page q-message">
        <h1>Cuestionario no encontrado</h1>
        <p>El enlace no es correcto o el cuestionario se ha borrado. Pida a la logopeda que se lo vuelva a enviar.</p>
      </div>
    )
  }
  if (!a) {
    return <div className="q-page q-message">{error ? <p className="error">{error}</p> : <p className="muted">Cargando el cuestionario…</p>}</div>
  }
  if (status === 'enviado') {
    return (
      <div className="q-page q-message">
        <h1>✅ Cuestionario enviado</h1>
        <p>Muchas gracias. La logopeda ya tiene las respuestas{a.name ? ` de ${a.name}` : ''} para preparar su tablero de comunicación.</p>
        <p className="muted">Si quiere cambiar algo, pídale que vuelva a abrir el cuestionario.</p>
      </div>
    )
  }

  return (
    <div className="q-page">
      <QuestionnaireForm
        answers={a}
        onChange={change}
        footer={
          <>
            <span className="muted">
              {saved === 'guardado' ? '✓ Guardado' : saved === 'guardando' ? 'Guardando…' : 'Cambios sin guardar'}
            </span>
            <button type="button" className="primary" disabled={sending} onClick={send}>
              {sending ? 'Enviando…' : 'Enviar a la logopeda'}
            </button>
          </>
        }
        error={error}
      />
    </div>
  )
}

interface FormProps {
  answers: Answers
  onChange: (a: Answers) => void
  /** Botones del final (a la derecha de Atrás / Siguiente) */
  footer: ReactNode
  error?: string
}

/** El cuestionario en sí: índice de secciones, la sección elegida y Atrás / Siguiente */
export function QuestionnaireForm({ answers: a, onChange, footer, error }: FormProps) {
  const [step, setStep] = useState(0) // 0 = presentación; 1..n = secciones
  const [renaming, setRenaming] = useState<string | null>(null) // «sección:palabra» que se está cambiando
  const body = useRef<HTMLDivElement>(null)
  const section = step > 0 ? SECTIONS[step - 1] : null
  const last = step === SECTIONS.length

  const go = (s: number) => {
    setStep(s)
    setRenaming(null)
    body.current?.scrollTo(0, 0)
    window.scrollTo(0, 0)
  }
  const toggle = (sid: string, w: string) => {
    const cur = a.checked[sid] ?? []
    onChange({ ...a, checked: { ...a.checked, [sid]: cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w] } })
  }
  const setField = (id: string, v: string) => onChange({ ...a, fields: { ...a.fields, [id]: v } })
  const setRenamed = (key: string, v: string) => onChange({ ...a, renamed: { ...a.renamed, [key]: v } })

  return (
    <div className="questionnaire">
      <header className="q-header">
        <h1>Cuestionario de vocabulario{a.name ? ` · ${a.name}` : ''}</h1>
        <span className="muted">
          {step === 0 ? 'Presentación' : `Sección ${step} de ${SECTIONS.length}`}
        </span>
      </header>
      <div className="q-main">
        <nav className="q-steps" aria-label="Secciones">
          <button type="button" className={step === 0 ? 'active' : ''} onClick={() => go(0)}>
            Presentación
          </button>
          {SECTIONS.map((s, i) => {
            const n = sectionCount(s, a)
            return (
              <button key={s.id} type="button" className={step === i + 1 ? 'active' : ''} onClick={() => go(i + 1)}>
                {s.title}
                {n > 0 && <span className="q-count">{n}</span>}
              </button>
            )
          })}
        </nav>

        <div className="q-body" ref={body}>
          {!section ? (
            <>
              <p>
                Este cuestionario ayuda a elegir las palabras del tablero de comunicación
                {a.name ? ` de ${a.name}` : ''}. Piense en lo que querría decir a lo largo del día.
              </p>
              <ul>
                <li>Intente responder a cada sección. Puede ir y volver entre secciones con la lista.</li>
                <li>Marque las palabras que usaría. Si dice una palabra a su manera (por ejemplo «chu-chu» en lugar de «tren»), márquela y pulse ✏️ para escribir cómo la dice.</li>
                <li>Todo se guarda solo: puede dejarlo a medias y seguir más tarde con el mismo enlace.</li>
                <li>Cuando termine, pulse «Enviar a la logopeda».</li>
              </ul>
              <label className="q-field">
                Nombre del niño o la niña
                <input value={a.name} onChange={(e) => onChange({ ...a, name: e.target.value })} />
              </label>
              <div className="q-field">
                Las palabras como «cansado/a» se escriben en
                <div className="q-radios">
                  <label className="check">
                    <input type="radio" checked={a.gender === 'nino'} onChange={() => onChange({ ...a, gender: 'nino' })} /> masculino
                  </label>
                  <label className="check">
                    <input type="radio" checked={a.gender === 'nina'} onChange={() => onChange({ ...a, gender: 'nina' })} /> femenino
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2>
                {step}. {section.title}
              </h2>
              {section.words && (
                <>
                  <p>{section.prompt}:</p>
                  <div className="q-words">
                    {section.words.map((w) => {
                      const key = `${section.id}:${w}`
                      const on = a.checked[section.id]?.includes(w) ?? false
                      const alias = a.renamed?.[key]?.trim()
                      return (
                        <span key={w} className={`q-word ${on ? 'on' : ''}`}>
                          <label>
                            <input type="checkbox" checked={on} onChange={() => toggle(section.id, w)} />
                            {alias ? (
                              <span>
                                <s>{inflect(w, a.gender)}</s> {alias}
                              </span>
                            ) : (
                              <span>{inflect(w, a.gender)}</span>
                            )}
                          </label>
                          {on &&
                            (renaming === key ? (
                              <input
                                className="q-alias"
                                value={a.renamed?.[key] ?? ''}
                                placeholder="cómo lo dice"
                                autoFocus
                                onChange={(e) => setRenamed(key, e.target.value)}
                                onBlur={() => setRenaming(null)}
                                onKeyDown={(e) => e.key === 'Enter' && setRenaming(null)}
                              />
                            ) : (
                              <button type="button" className="icon-btn" title="Lo dice de otra forma" aria-label={`${w}: lo dice de otra forma`} onClick={() => setRenaming(key)}>
                                ✏️
                              </button>
                            ))}
                        </span>
                      )
                    })}
                  </div>
                </>
              )}
              {section.fields?.map((f) => (
                <label key={f.id} className="q-field">
                  {f.label}
                  <textarea
                    rows={3}
                    value={a.fields[f.id] ?? ''}
                    placeholder={f.placeholder ? `Por ejemplo: ${f.placeholder}` : 'Separe las palabras con comas'}
                    onChange={(e) => setField(f.id, e.target.value)}
                  />
                </label>
              ))}
            </>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
      <footer className="q-footer">
        <button type="button" disabled={step === 0} onClick={() => go(step - 1)}>
          ◀ Atrás
        </button>
        {!last && (
          <button type="button" onClick={() => go(step + 1)}>
            Siguiente ▶
          </button>
        )}
        <span className="spacer" />
        {footer}
      </footer>
    </div>
  )
}
