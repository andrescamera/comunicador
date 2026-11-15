import * as Speech from 'expo-speech'

let generation = 0

export async function spanishVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync()
    // Primero las de España; dentro, las que funcionan sin conexión
    return voices.filter((v) => v.language.toLowerCase().startsWith('es')).sort((a, b) => score(b) - score(a))
  } catch {
    return []
  }
}

const isSpain = (v: Speech.Voice) => /^es[-_]es$/i.test(v.language)
// Las de Google acaban en «-network» si necesitan conexión: mejor las del dispositivo
const score = (v: Speech.Voice) => (isSpain(v) ? 100 : 0) + (/network/i.test(v.identifier) ? 0 : 10) + (v.quality === Speech.VoiceQuality.Enhanced ? 1 : 0)

/**
 * Nombre para Ajustes: las de Google se llaman por su código («es-es-x-eee-local»). La misma voz con y sin
 * conexión lleva el mismo número.
 */
export function voiceLabel(v: Speech.Voice, all: Speech.Voice[]): string {
  const code = (x: Speech.Voice) => x.identifier.match(/^[a-z]{2}-[a-z]{2}-x-([a-z]+)-/i)?.[1]
  const region = isSpain(v) ? 'España' : /^es[-_]us$/i.test(v.language) ? 'Latinoamérica' : v.language
  if (/-language$/.test(v.identifier)) return `${region} · la del sistema`
  if (!code(v)) return `${v.name} (${v.language})`
  const codes = [...new Set(all.filter((x) => x.language === v.language).map(code).filter(Boolean))]
  return `${region} · voz ${codes.indexOf(code(v)) + 1}${/network/i.test(v.identifier) ? ' (necesita conexión)' : ''}`
}

/** En «Automática»: la mejor voz de español de España (si la tablet no tiene ninguna, la del sistema) */
let autoVoice: string | undefined
const voiceFor = (voiceURI: string) => voiceURI || autoVoice

/**
 * Android no arranca el motor de voz (ni carga la voz en español) hasta la primera locución:
 * eso es el retraso del primer toque. Se arranca al abrir la app diciendo algo en silencio.
 */
export async function warmUpSpeech(opts: { rate: number; voiceURI: string }): Promise<void> {
  const voices = await spanishVoices()
  autoVoice = voices.find(isSpain)?.identifier
  Speech.speak('hola', { language: 'es-ES', voice: voiceFor(opts.voiceURI), rate: opts.rate, volume: 0 })
}

/**
 * Habla cortando cualquier locución anterior: nunca se solapan ni se encolan sonidos.
 * `onEnd` se llama una sola vez al terminar (no si otra locución la interrumpe).
 */
export function speak(text: string, opts: { rate: number; voiceURI: string }, onEnd?: () => void): void {
  const gen = ++generation
  let done = false
  const finish = () => {
    if (done || gen !== generation) return
    done = true
    onEnd?.()
  }
  if (!text.trim()) return finish()
  Speech.stop()
  Speech.speak(text, {
    language: 'es-ES',
    rate: opts.rate,
    voice: voiceFor(opts.voiceURI),
    onDone: finish,
    onError: finish,
  })
  // Respaldo por si el motor no avisa del final
  setTimeout(finish, 1500 + (text.length * 90) / opts.rate)
}
