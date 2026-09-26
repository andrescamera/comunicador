import * as Speech from 'expo-speech'

let generation = 0

export async function spanishVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync()
    return voices.filter((v) => v.language.toLowerCase().startsWith('es'))
  } catch {
    return []
  }
}

/**
 * Android no arranca el motor de voz (ni carga la voz en español) hasta la primera locución:
 * eso es el retraso del primer toque. Se arranca al abrir la app diciendo algo en silencio.
 */
export async function warmUpSpeech(opts: { rate: number; voiceURI: string }): Promise<void> {
  await spanishVoices()
  Speech.speak('hola', { language: 'es-ES', voice: opts.voiceURI || undefined, rate: opts.rate, volume: 0 })
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
    voice: opts.voiceURI || undefined,
    onDone: finish,
    onError: finish,
  })
  // Respaldo por si el motor no avisa del final
  setTimeout(finish, 1500 + (text.length * 90) / opts.rate)
}
