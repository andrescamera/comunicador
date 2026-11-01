import type { SupabaseClient } from '@supabase/supabase-js'
import { signedUrl } from './photos'
import { uid } from './types'

/**
 * Sonidos de las fichas «Sonido» (al tocarlas solo suenan: animales, transportes…). Se buscan en
 * Freesound (solo dominio público, CC0) a través de la función «sonidos» del servidor, que guarda la
 * clave. El elegido se copia al espacio privado del tablero («<tablero>/<sonido>.mp3»): así suena sin
 * conexión y aunque desaparezca de Freesound.
 */
export const SOUND_BUCKET = 'sonidos'

export interface SoundResult {
  id: number
  name: string
  duration: number // segundos
  user: string
  preview: string // MP3 de Freesound para escucharlo antes de elegir
}

/** Enlace temporal para reproducir el sonido de una ficha */
export const soundUrl = (sb: SupabaseClient, path: string) => signedUrl(sb, SOUND_BUCKET, path)

// En Freesound casi todo está etiquetado en inglés: lo habitual se busca traducido
const ENGLISH: Record<string, string> = {
  vaca: 'cow moo', toro: 'bull', perro: 'dog bark', gato: 'cat meow', oveja: 'sheep bleat', cordero: 'lamb bleat',
  caballo: 'horse neigh', burro: 'donkey bray', cabra: 'goat', gallina: 'chicken cluck', gallo: 'rooster crow',
  pollito: 'chick chirp', pato: 'duck quack', pajaro: 'bird chirp', 'pájaro': 'bird chirp', buho: 'owl hoot',
  'búho': 'owl hoot', rana: 'frog croak', abeja: 'bee buzz', mosca: 'fly buzz', mosquito: 'mosquito', cerdo: 'pig oink',
  leon: 'lion roar', 'león': 'lion roar', tigre: 'tiger roar', elefante: 'elephant trumpet', mono: 'monkey',
  lobo: 'wolf howl', serpiente: 'snake hiss', oso: 'bear growl', pavo: 'turkey gobble', paloma: 'pigeon coo',
  grillo: 'cricket', delfin: 'dolphin', 'delfín': 'dolphin', ballena: 'whale', foca: 'seal bark', raton: 'mouse squeak',
  'ratón': 'mouse squeak', coche: 'car horn', moto: 'motorcycle', camion: 'truck horn', 'camión': 'truck horn',
  autobus: 'bus horn', 'autobús': 'bus horn', tren: 'train whistle', avion: 'airplane', 'avión': 'airplane',
  helicoptero: 'helicopter', 'helicóptero': 'helicopter', barco: 'ship horn', ambulancia: 'ambulance siren',
  bomberos: 'fire truck siren', policia: 'police siren', 'policía': 'police siren', bicicleta: 'bicycle bell',
  tractor: 'tractor', metro: 'subway train', cohete: 'rocket launch', timbre: 'doorbell', telefono: 'phone ring',
  'teléfono': 'phone ring', reloj: 'clock tick', despertador: 'alarm clock', lluvia: 'rain', trueno: 'thunder',
  viento: 'wind', mar: 'sea waves', agua: 'water', aplausos: 'applause', risa: 'laugh', tambor: 'drum',
  campana: 'bell', silbato: 'whistle', puerta: 'door knock',
}

/** Lo que se busca en Freesound (traducido si se conoce, también en plural; si no, tal cual) */
export function soundQuery(text: string): string {
  const w = text.trim().toLowerCase()
  const plain = w.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return ENGLISH[w] ?? ENGLISH[plain] ?? ENGLISH[plain.replace(/s$/, '')] ?? ENGLISH[plain.replace(/es$/, '')] ?? w
}

/** Nombre legible de un sonido de Freesound (sin extensión ni guiones bajos) */
export const soundName = (name: string) => name.replace(/\.(wav|aiff?|mp3|flac|ogg|m4a)$/i, '').replace(/_+/g, ' ').trim()

export async function searchSounds(sb: SupabaseClient, query: string): Promise<SoundResult[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await sb.functions.invoke(`sonidos?q=${encodeURIComponent(q)}`, { method: 'GET' })
  if (error) throw new Error('No se pudo buscar en Freesound')
  if (!Array.isArray(data)) throw new Error(data?.error ?? 'Respuesta inesperada de Freesound')
  return data as SoundResult[]
}

/** Crédito que se guarda con la ficha (CC0 no lo exige, pero se agradece) */
export const soundCredit = (s: SoundResult) => `«${soundName(s.name)}» de ${s.user} · Freesound #${s.id} (CC0)`

/** Copia el sonido elegido al tablero `libraryId` y devuelve su ruta, que se guarda en la ficha */
export async function copySound(sb: SupabaseClient, libraryId: string, s: SoundResult): Promise<string> {
  const r = await fetch(s.preview)
  if (!r.ok) throw new Error('No se pudo descargar el sonido de Freesound')
  const data = await r.arrayBuffer()
  const path = `${libraryId}/${uid('sonido')}.mp3`
  const { error } = await sb.storage.from(SOUND_BUCKET).upload(path, data, { contentType: 'audio/mpeg', upsert: false })
  if (error) throw new Error(`No se pudo guardar el sonido: ${error.message}`)
  return path
}
