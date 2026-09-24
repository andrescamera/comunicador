export function spanishVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'))
}

function pickVoice(voiceURI: string): SpeechSynthesisVoice | undefined {
  const voices = spanishVoices()
  return (
    voices.find((v) => v.voiceURI === voiceURI) ??
    voices.find((v) => v.lang === 'es-ES' && v.localService) ??
    voices.find((v) => v.lang === 'es-ES') ??
    voices[0]
  )
}

let generation = 0

/**
 * Habla el texto cortando cualquier locución anterior:
 * nunca se solapan ni se encolan sonidos.
 * `onEnd` se llama una sola vez cuando termina (no si otra locución la interrumpe).
 */
export function speak(text: string, opts: { rate: number; voiceURI: string }, onEnd?: () => void): void {
  const gen = ++generation
  let done = false
  const finish = () => {
    if (done || gen !== generation) return
    done = true
    onEnd?.()
  }
  if (!('speechSynthesis' in window) || !text.trim()) {
    finish()
    return
  }
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = opts.rate
  const voice = pickVoice(opts.voiceURI)
  if (voice) u.voice = voice
  u.onend = finish
  u.onerror = finish
  speechSynthesis.speak(u)
  // Algunos navegadores no disparan "end": respaldo según la duración estimada
  window.setTimeout(finish, 1500 + (text.length * 90) / opts.rate)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
