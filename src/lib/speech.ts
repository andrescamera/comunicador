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

/**
 * Habla el texto cortando cualquier locución anterior:
 * nunca se solapan ni se encolan sonidos.
 */
export function speak(text: string, opts: { rate: number; voiceURI: string }): void {
  if (!('speechSynthesis' in window) || !text.trim()) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-ES'
  u.rate = opts.rate
  const voice = pickVoice(opts.voiceURI)
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
