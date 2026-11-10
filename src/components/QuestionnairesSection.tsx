import { useEffect, useState } from 'react'
import { supabase } from '../lib/cloud'
import { answersToText } from '../lib/questionnaire'
import {
  createQuestionnaire,
  deleteQuestionnaire,
  listQuestionnaires,
  progressOf,
  type QuestionnaireRow,
  questionnaireUrl,
  reopenQuestionnaire,
  toAnswers,
} from '../lib/questionnaires'

interface Props {
  /** Crear un tablero con las respuestas: nombre propuesto y texto para el creador */
  onCreateBoard: (name: string, text: string) => void
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/**
 * «Mis tableros» → Cuestionarios: la logopeda crea uno por niño, comparte el enlace con el tutor
 * (lo rellena sin cuenta) y, cuando está enviado, crea el tablero con las respuestas.
 */
export function QuestionnairesSection({ onCreateBoard }: Props) {
  const [items, setItems] = useState<QuestionnaireRow[] | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = () =>
    listQuestionnaires(supabase)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  useEffect(() => {
    void load()
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const create = () => {
    const name = prompt('Nombre del niño o la niña')
    if (name?.trim()) void run(() => createQuestionnaire(supabase, name))
  }

  const copy = async (q: QuestionnaireRow) => {
    try {
      await navigator.clipboard.writeText(questionnaireUrl(q.token))
      setCopied(q.id)
      setTimeout(() => setCopied((c) => (c === q.id ? null : c)), 2000)
    } catch {
      prompt('Copie el enlace:', questionnaireUrl(q.token))
    }
  }

  const whatsapp = (q: QuestionnaireRow) => {
    const text = `Hola. Este es el cuestionario de vocabulario${q.child_name ? ` de ${q.child_name}` : ''} para preparar su tablero de comunicación. Se guarda solo y se puede rellenar en varias veces; al terminar, pulse «Enviar a la logopeda»: ${questionnaireUrl(q.token)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <section>
      <div className="row">
        <h2>Cuestionarios de vocabulario</h2>
        <span className="spacer" />
        <button type="button" onClick={create}>
          🧩 Nuevo cuestionario
        </button>
      </div>
      <p className="muted">
        Para un niño nuevo: cree un cuestionario y envíe el enlace a su familia, que lo rellena sin cuenta. Cuando lo envíen, cree el tablero
        con sus respuestas. Las respuestas son datos personales: borre el cuestionario cuando ya no lo necesite.
      </p>
      {error && <p className="error">{error}</p>}
      {items && items.length > 0 && (
        <ul className="q-list">
          {items.map((q) => {
            const progress = progressOf(q)
            return (
              <li key={q.id} className="q-item">
                <strong>{q.child_name || 'Sin nombre'}</strong>
                <span className={`q-badge ${progress.replace(' ', '-')}`}>{progress}</span>
                <span className="muted">
                  {q.submitted_at ? `enviado el ${fmt(q.submitted_at)}` : `creado el ${fmt(q.created_at)}`}
                </span>
                <span className="spacer" />
                {q.status === 'pendiente' ? (
                  <>
                    <button type="button" onClick={() => void copy(q)}>
                      {copied === q.id ? '✓ Copiado' : '🔗 Copiar enlace'}
                    </button>
                    <button type="button" onClick={() => whatsapp(q)}>
                      WhatsApp
                    </button>
                    <a className="button" href={questionnaireUrl(q.token)} target="_blank" rel="noopener">
                      Abrir
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Volver a abrir el cuestionario para que la familia pueda cambiarlo?')) void run(() => reopenQuestionnaire(supabase, q.id))
                    }}
                  >
                    Reabrir
                  </button>
                )}
                <button
                  type="button"
                  className={q.status === 'enviado' ? 'primary' : ''}
                  disabled={progress === 'sin empezar'}
                  onClick={() => {
                    const a = toAnswers(q.answers, q.child_name)
                    onCreateBoard(a.name ? `Tablero de ${a.name}` : 'Nuevo tablero', answersToText(a))
                  }}
                >
                  ✨ Crear tablero
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (confirm(`¿Borrar el cuestionario${q.child_name ? ` de ${q.child_name}` : ''} y sus respuestas? El enlace dejará de funcionar. No se puede deshacer.`))
                      void run(() => deleteQuestionnaire(supabase, q.id))
                  }}
                >
                  Borrar
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
