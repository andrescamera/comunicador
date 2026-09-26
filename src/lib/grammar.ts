import type { Category, Cell } from './types'

// Persona gramatical: 0=yo 1=tú 2=él/ella 3=nosotros 4=vosotros 5=ellos
export type Person = 0 | 1 | 2 | 3 | 4 | 5

export const PRONOUNS: Record<string, Person> = {
  yo: 0,
  tú: 1,
  tu: 1,
  él: 2,
  ella: 2,
  usted: 2,
  nosotros: 3,
  nosotras: 3,
  vosotros: 4,
  vosotras: 4,
  ellos: 5,
  ellas: 5,
  ustedes: 5,
}

// "a mí me gusta": forma tónica que sustituye al sujeto con verbos tipo gustar
const DATIVE_TONIC: Record<string, string> = {
  yo: 'a mí',
  tú: 'a ti',
  tu: 'a ti',
  él: 'a él',
  ella: 'a ella',
  usted: 'a usted',
  nosotros: 'a nosotros',
  nosotras: 'a nosotras',
  vosotros: 'a vosotros',
  vosotras: 'a vosotras',
  ellos: 'a ellos',
  ellas: 'a ellas',
  ustedes: 'a ustedes',
}
const DATIVE_CLITIC = ['me', 'te', 'le', 'nos', 'os', 'les']
const REFLEXIVE_CLITIC = ['me', 'te', 'se', 'nos', 'os', 'se']

// Verbos que se construyen como "gustar": a mí me gusta X
const GUSTAR_LIKE = new Set(['gustar', 'encantar', 'doler', 'molestar', 'apetecer', 'importar', 'interesar'])

const FULL: Record<string, string[]> = {
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
  estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
  haber: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  oír: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
  dar: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
  ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
  saber: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
  decir: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
  oler: ['huelo', 'hueles', 'huele', 'olemos', 'oléis', 'huelen'],
  reír: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
  sonreír: ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonreís', 'sonríen'],
  caber: ['quepo', 'cabes', 'cabe', 'cabemos', 'cabéis', 'caben'],
}

type StemChange = 'ie' | 'ue' | 'i'
const STEM: Record<string, StemChange> = {
  querer: 'ie', pensar: 'ie', empezar: 'ie', entender: 'ie', cerrar: 'ie', despertar: 'ie',
  sentir: 'ie', preferir: 'ie', tener: 'ie', venir: 'ie', sentar: 'ie', merendar: 'ie',
  perder: 'ie', encender: 'ie', calentar: 'ie', fregar: 'ie', mentir: 'ie', comenzar: 'ie',
  poder: 'ue', dormir: 'ue', volver: 'ue', jugar: 'ue', contar: 'ue', encontrar: 'ue',
  doler: 'ue', llover: 'ue', mover: 'ue', acostar: 'ue', probar: 'ue', costar: 'ue',
  soñar: 'ue', recordar: 'ue', morder: 'ue', colgar: 'ue', almorzar: 'ue', mostrar: 'ue',
  pedir: 'i', repetir: 'i', vestir: 'i', servir: 'i', seguir: 'i', elegir: 'i', medir: 'i',
}

const YO: Record<string, string> = {
  tener: 'tengo', venir: 'vengo', hacer: 'hago', poner: 'pongo', salir: 'salgo',
  traer: 'traigo', caer: 'caigo', valer: 'valgo', seguir: 'sigo', elegir: 'elijo',
  coger: 'cojo', recoger: 'recojo', escoger: 'escojo', proteger: 'protejo', deshacer: 'deshago',
}

const ENDINGS = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
}

// Verbos regulares frecuentes (sirven para reconocer verbos y lematizar texto libre)
const COMMON_REGULAR = [
  'comer', 'beber', 'hablar', 'mirar', 'escuchar', 'tomar', 'ayudar', 'dibujar', 'pintar',
  'bailar', 'cantar', 'correr', 'saltar', 'lavar', 'duchar', 'bañar', 'levantar', 'necesitar',
  'gustar', 'encantar', 'abrir', 'escribir', 'leer', 'vivir', 'subir', 'bajar', 'esperar',
  'parar', 'terminar', 'andar', 'caminar', 'llamar', 'llorar', 'tocar', 'cocinar', 'comprar',
  'pasear', 'nadar', 'trabajar', 'estudiar', 'aprender', 'limpiar', 'montar', 'cambiar', 'usar',
  'dejar', 'llevar', 'sacar', 'meter', 'pasar', 'buscar', 'coger', 'guardar', 'cortar',
  'peinar', 'secar', 'desayunar', 'cenar', 'regalar', 'besar', 'abrazar', 'molestar',
  'apetecer', 'importar', 'interesar', 'lanzar', 'tirar', 'empujar', 'romper', 'ganar',
  'mandar', 'enseñar', 'preguntar', 'contestar', 'responder', 'descansar', 'quedar', 'gritar',
  'pegar', 'recortar', 'colorear', 'construir', 'mear', 'cagar', 'vomitar', 'toser',
]

const NOT_VERBS = new Set([
  'lugar', 'mujer', 'collar', 'taller', 'alfiler', 'placer', 'hogar', 'azúcar', 'dólar',
  'cáncer', 'ayer', 'altar', 'militar', 'familiar', 'nenúfar', 'radar', 'faquir', 'elixir',
  'tapir', 'pilar', 'polar', 'solar', 'celular', 'titular', 'popular', 'regular', 'lunar', 'chófer', 'suéter', 'póster', 'láser', 'cráter', 'carácter', 'alquiler', 'mercader',
])

export function isKnownVerb(word: string): boolean {
  const w = word.toLowerCase()
  const base = reflexiveBase(w) ?? w
  return base in FULL || base in STEM || base in YO || COMMON_REGULAR.includes(base)
}

/** "lavarse" -> "lavar"; devuelve null si no es reflexivo */
function reflexiveBase(verb: string): string | null {
  const m = verb.match(/^(.+(?:ar|er|ir|ír))se$/)
  return m ? m[1] : null
}

export function looksLikeVerb(word: string): boolean {
  const w = word.toLowerCase().trim()
  if (w.includes(' ')) return false
  if (isKnownVerb(w)) return true
  if (NOT_VERBS.has(w)) return false
  return /^[a-záéíóúñü]{3,}(ar|er|ir|ír)(se)?$/.test(w)
}

function replaceLast(s: string, find: string, repl: string): string {
  const i = s.lastIndexOf(find)
  return i < 0 ? s : s.slice(0, i) + repl + s.slice(i + find.length)
}

/** Presente de indicativo. */
export function conjugate(infinitive: string, person: Person): string {
  const verb = infinitive.toLowerCase()
  if (FULL[verb]) return FULL[verb][person]
  const cls = (verb.endsWith('ír') ? 'ir' : verb.slice(-2)) as keyof typeof ENDINGS
  if (!(cls in ENDINGS)) return verb
  let stem = verb.slice(0, -2)
  const endings = ENDINGS[cls]
  const stressedStem = person === 0 || person === 1 || person === 2 || person === 5

  if (person === 0 && YO[verb]) return YO[verb]

  // construir -> construyo, construyes...
  if (cls === 'ir' && /[^g]u$/.test(stem) && stressedStem) {
    return stem + 'y' + endings[person]
  }

  const change = STEM[verb]
  if (change && stressedStem) {
    if (change === 'ie') stem = replaceLast(stem, 'e', 'ie')
    else if (change === 'i') stem = replaceLast(stem, 'e', 'i')
    else if (verb === 'jugar') stem = 'jueg'
    else stem = replaceLast(stem, 'o', 'ue')
  }

  if (person === 0) {
    // conocer -> conozco, parecer -> parezco, conducir -> conduzco
    if (/[aeiou]c(er|ir)$/.test(verb) && verb !== 'hacer' && verb !== 'cocer') return stem.slice(0, -1) + 'zco'
    // recoger -> recojo
    if (/g(er|ir)$/.test(verb)) return stem.slice(0, -1) + 'jo'
    // seguir -> sigo
    if (/gu(ir)$/.test(verb)) return stem.slice(0, -1) + 'o'
  }

  // Ortografía: jugar -> juego (g), tocar sin cambios en presente
  return stem + endings[person]
}

/** Infinitivo con pronombre enclítico: "ducharse" + yo -> "ducharme" */
function infinitiveWithClitic(verb: string, person: Person): string {
  const base = reflexiveBase(verb)
  return base ? base + REFLEXIVE_CLITIC[person] : verb
}

function isPlural(label: string): boolean {
  const w = label.toLowerCase().trim()
  return /[aeiouáéó]s$/.test(w) || /[^aeiou]es$/.test(w)
}

/**
 * Convierte la secuencia de celdas en palabras correctamente conjugadas,
 * al estilo de Verbo: "yo + querer + comer" -> "yo quiero comer".
 * Devuelve una forma por celda (puede ser "" si la celda se absorbe).
 */
export function realize(tokens: Pick<Cell, 'label' | 'category' | 'kind'>[]): string[] {
  const out: string[] = tokens.map((t) => t.label)
  let person: Person = 0 // sujeto implícito: yo
  let subjectIdx = -1
  let verbDone = false

  tokens.forEach((t, i) => {
    const label = t.label.toLowerCase().trim()
    if (t.kind !== 'word') return

    if (t.category === 'pronoun' && label in PRONOUNS) {
      person = PRONOUNS[label]
      subjectIdx = i
      verbDone = false
      return
    }

    // Solo las personas actúan como sujeto: "agua querer" debe seguir siendo "quiero agua"
    if (t.category === 'person' && !verbDone && subjectIdx < 0) {
      person = isPlural(label) ? 5 : 2
      subjectIdx = i
      return
    }

    if (t.category !== 'verb' || !looksLikeVerb(label)) return

    if (verbDone) {
      out[i] = infinitiveWithClitic(label, person)
      return
    }
    verbDone = true

    if (GUSTAR_LIKE.has(label)) {
      // El sujeto real es lo que gusta: miramos si lo siguiente es plural
      const next = tokens.slice(i + 1).find((n) => n.kind === 'word' && n.category === 'noun')
      const verbPerson: Person = next && isPlural(next.label) ? 5 : 2
      const subjectLabel = subjectIdx >= 0 ? tokens[subjectIdx].label.toLowerCase().trim() : 'yo'
      const experiencer = subjectLabel in PRONOUNS ? PRONOUNS[subjectLabel] : 2
      if (subjectIdx >= 0 && tokens[subjectIdx].category === 'pronoun') {
        out[subjectIdx] = DATIVE_TONIC[subjectLabel] ?? out[subjectIdx]
      } else if (subjectIdx >= 0) {
        out[subjectIdx] = 'a ' + out[subjectIdx]
      }
      out[i] = `${DATIVE_CLITIC[experiencer]} ${conjugate(label, verbPerson)}`
      return
    }

    const base = reflexiveBase(label)
    if (base) {
      out[i] = `${REFLEXIVE_CLITIC[person]} ${conjugate(base, person)}`
      return
    }
    out[i] = conjugate(label, person)
  })

  return out
}

export function sentenceText(tokens: Pick<Cell, 'label' | 'category' | 'kind'>[]): string {
  return realize(tokens).filter(Boolean).join(' ')
}

// ---------- Lematización de texto libre ----------

let formIndex: Map<string, string> | null = null

/** "quiero" -> "querer", "juegan" -> "jugar". Null si no se reconoce. */
export function lemmatize(word: string): string | null {
  word = word.normalize('NFC')
  if (!formIndex) {
    formIndex = new Map()
    const verbs = new Set([...Object.keys(FULL), ...Object.keys(STEM), ...Object.keys(YO), ...COMMON_REGULAR])
    for (const v of verbs) {
      for (let p = 0; p < 6; p++) {
        const f = conjugate(v, p as Person)
        if (!formIndex.has(f)) formIndex.set(f, v)
      }
    }
  }
  return formIndex.get(word.toLowerCase()) ?? null
}

// ---------- Clasificación ----------

/**
 * Algunos teclados (macOS, iOS) escriben "á" como "a" + tilde combinada (NFD).
 * Se normaliza a NFC para que "papá" siempre sea la misma palabra.
 */
export function normalizeText(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** ¿Es una palabra que conocemos (léxico propio o verbo)? */
/** ¿Está en el léxico propio como palabra que no es verbo? ("ayuda", "más", "mamá"...) */
export function isLexiconWord(label: string): boolean {
  const w = normalizeText(label).toLowerCase()
  return w in PRONOUNS || QUESTIONS.has(w) || NEGATIONS.has(w) || SOCIAL.has(w) || MISC.has(w) || PEOPLE.has(w)
}

export function isKnownWord(label: string): boolean {
  const w = normalizeText(label).toLowerCase()
  return (
    w in PRONOUNS || QUESTIONS.has(w) || NEGATIONS.has(w) || SOCIAL.has(w) || MISC.has(w) || PEOPLE.has(w) ||
    isKnownVerb(w) || lemmatize(w) !== null
  )
}

const QUESTIONS = new Set(['qué', 'quién', 'dónde', 'cuándo', 'cómo', 'cuál', 'por qué', 'cuánto', 'cuántos', 'para qué'])
const NEGATIONS = new Set(['no', 'nada', 'nunca', 'nadie'])
const SOCIAL = new Set([
  'hola', 'adiós', 'gracias', 'por favor', 'sí', 'vale', 'perdón', 'buenos días', 'buenas tardes',
  'buenas noches', 'hasta luego', 'de nada', 'lo siento', 'genial', 'ayuda',
])
const MISC = new Set([
  'más', 'otra vez', 'también', 'ya', 'ahora', 'después', 'antes', 'aquí', 'allí', 'y', 'con',
  'eso', 'esto', 'todo', 'otro', 'otra', 'algo',
  'mucho', 'poco', 'muy', 'hoy', 'mañana', 'ayer', 'para', 'en', 'de', 'a', 'el', 'la', 'un', 'una',
])
const PEOPLE = new Set([
  'mamá', 'papá', 'abuelo', 'abuela', 'hermano', 'hermana', 'profe', 'profesor', 'profesora',
  'amigo', 'amiga', 'amigos', 'bebé', 'niño', 'niña', 'médico', 'médica', 'tío', 'tía', 'primo', 'prima',
  'terapeuta', 'logopeda', 'mama', 'mami', 'papi', 'yaya', 'yayo', 'abu', 'tata', 'nene', 'nena',
  'abuelos', 'hermanos', 'padres', 'familia', 'maestro', 'maestra', 'seño',
])

const ARASAAC_TYPE: Record<number, Category> = {
  1: 'person', // nombre propio
  2: 'noun',
  3: 'verb',
  4: 'adjective',
  5: 'social',
  6: 'misc',
}

/** Categoría a partir del léxico propio; si no lo sabe, usa el tipo de ARASAAC. */
export function classify(label: string, arasaacType?: number): Category {
  const w = normalizeText(label).toLowerCase()
  if (w in PRONOUNS) return 'pronoun'
  if (QUESTIONS.has(w)) return 'question'
  if (NEGATIONS.has(w)) return 'negation'
  if (SOCIAL.has(w)) return 'social'
  if (MISC.has(w)) return 'misc'
  if (PEOPLE.has(w)) return 'person'
  if (isKnownVerb(w)) return 'verb'
  if (arasaacType && ARASAAC_TYPE[arasaacType]) return ARASAAC_TYPE[arasaacType]
  if (looksLikeVerb(w)) return 'verb'
  return 'noun'
}

// Orden en el tablero (clave de Fitzgerald: de izquierda a derecha)
export const CATEGORY_ORDER: Category[] = [
  'pronoun', 'person', 'question', 'verb', 'negation', 'adjective', 'noun', 'misc', 'social',
]
