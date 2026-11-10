import type { SupabaseClient } from '@supabase/supabase-js'
import { type Answers, emptyAnswers } from './questionnaire'

/**
 * Cuestionarios en el servidor (migración 009). La logopeda los crea y ve los suyos; el tutor los
 * abre con el enlace /cuestionario/<token>, sin cuenta, y solo puede leer y guardar ese.
 */

export type QuestionnaireStatus = 'pendiente' | 'enviado'

export interface QuestionnaireRow {
  id: string
  token: string
  child_name: string
  answers: Partial<Answers>
  status: QuestionnaireStatus
  created_at: string
  updated_at: string
  submitted_at: string | null
}

async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}

const COLUMNS = 'id, token, child_name, answers, status, created_at, updated_at, submitted_at'

/** Dirección del enlace para el tutor */
export const questionnaireUrl = (token: string, origin = window.location.origin) => `${origin}/cuestionario/${token}`

/** Token de la dirección actual (/cuestionario/<token>), o null si no es la página del cuestionario */
export function tokenFromPath(path: string): string | null {
  const m = path.match(/^\/cuestionario\/([0-9a-f]{64})\/?$/)
  return m ? m[1] : null
}

/** Respuestas guardadas -> respuestas completas (lo que falte, vacío) */
export function toAnswers(saved: Partial<Answers> | null | undefined, childName = ''): Answers {
  const a = { ...emptyAnswers(), ...(saved ?? {}) }
  return { ...a, name: a.name || childName, checked: a.checked ?? {}, fields: a.fields ?? {}, renamed: a.renamed ?? {} }
}

/** Sin empezar / a medias / enviado (para la lista de la logopeda) */
export function progressOf(q: Pick<QuestionnaireRow, 'status' | 'answers'>): 'sin empezar' | 'a medias' | 'enviado' {
  if (q.status === 'enviado') return 'enviado'
  const a = q.answers ?? {}
  const any = Object.values(a.checked ?? {}).some((l) => l.length) || Object.values(a.fields ?? {}).some((t) => t.trim())
  return any ? 'a medias' : 'sin empezar'
}

// ---------- La logopeda ----------

export const listQuestionnaires = async (sb: SupabaseClient) =>
  ((await check(sb.from('questionnaires').select(COLUMNS).order('created_at', { ascending: false }))) ?? []) as QuestionnaireRow[]

export const createQuestionnaire = async (sb: SupabaseClient, childName: string) =>
  (await check(
    sb.from('questionnaires').insert({ child_name: childName.trim().slice(0, 80), answers: { name: childName.trim() } }).select(COLUMNS).single(),
  )) as QuestionnaireRow

/** Volver a abrir uno enviado para que el tutor pueda cambiarlo */
export const reopenQuestionnaire = (sb: SupabaseClient, id: string) =>
  check(sb.from('questionnaires').update({ status: 'pendiente', submitted_at: null }).eq('id', id))

export const deleteQuestionnaire = (sb: SupabaseClient, id: string) => check(sb.from('questionnaires').delete().eq('id', id))

// ---------- El tutor (con el enlace) ----------

export async function fetchByToken(sb: SupabaseClient, token: string) {
  const rows = (await check(sb.rpc('questionnaire_by_token', { p_token: token }))) as
    | { child_name: string; answers: Partial<Answers>; status: QuestionnaireStatus; updated_at: string }[]
    | null
  return rows?.[0] ?? null
}

export const saveByToken = async (sb: SupabaseClient, token: string, answers: Answers, submit = false) =>
  (await check(sb.rpc('questionnaire_save', { p_token: token, p_answers: answers, p_submit: submit }))) as QuestionnaireStatus
