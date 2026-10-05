/** Voces en español del navegador (sin las «de juguete», que pronuncian mal) */
export function spanishVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return []
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es') && !NOVELTY.test(v.name))
}

// Voces «de juguete» que trae macOS: pronuncian mal (se comen sonidos: «tengo» -> «tego»)
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i
// Voces de buena calidad conocidas (Mac, Chrome, Edge/Windows, iOS)
const GOOD = /(m[oó]nica|marisol|jorge|luc[ií]a|google espa[nñ]ol|elvira|[aá]lvaro|helena|laura|pablo|siri)/i

/** La mejor voz en español: la elegida en Ajustes o, en automático, una buena de España */
function pickVoice(voiceURI: string): SpeechSynthesisVoice | undefined {
  const voices = spanishVoices()
  const chosen = voices.find((v) => v.voiceURI === voiceURI)
  if (chosen) return chosen
  const score = (v: SpeechSynthesisVoice) =>
    (NOVELTY.test(v.name) ? -100 : 0) + (GOOD.test(v.name) ? 20 : 0) + (v.lang === 'es-ES' ? 10 : 0) + (v.localService ? 1 : 0)
  return [...voices].sort((a, b) => score(b) - score(a))[0]
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
