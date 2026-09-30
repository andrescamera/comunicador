import { useEffect, useState } from 'react'
import { speak, spanishVoices } from '../lib/speech'
import type { Settings } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { Modal } from './Modal'
import { AccountPanel } from './AccountPanel'
import type { CloudSync } from '../lib/useCloudSync'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onResetBoards: () => void
  onClose: () => void
  cloud: CloudSync
}

export function SettingsPanel({ settings, onChange, onResetBoards, onClose, cloud }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(spanishVoices())
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoices(spanishVoices())
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })

  return (
    <Modal title="Ajustes" onClose={onClose}>
      <section className="settings">
        <h3>Cuenta y sincronización</h3>
        <AccountPanel cloud={cloud} />

        <h3>Pulsación</h3>
        <label className="radio">
          <input type="radio" checked={settings.activateOn === 'release'} onChange={() => set('activateOn', 'release')} />
          Activar al <strong>soltar</strong> (recomendado: permite corregir deslizando fuera)
        </label>
        <label className="radio">
          <input type="radio" checked={settings.activateOn === 'press'} onChange={() => set('activateOn', 'press')} />
          Activar al <strong>pulsar</strong> (más rápido, como Verbo)
        </label>

        <label>
          Bloqueo tras activar: <strong>{settings.lockoutMs} ms</strong>
          <input type="range" min={0} max={2000} step={50} value={settings.lockoutMs} onChange={(e) => set('lockoutMs', +e.target.value)} />
          <small>Durante este tiempo se ignora cualquier otro toque (evita repeticiones y rebotes).</small>
        </label>
        <label>
          Pulsación mínima: <strong>{settings.minHoldMs} ms</strong>
          <input type="range" min={0} max={1500} step={50} value={settings.minHoldMs} onChange={(e) => set('minHoldMs', +e.target.value)} />
          <small>Ignora roces muy breves. 0 = desactivado.</small>
        </label>
        <label>
          Tolerancia de movimiento: <strong>{settings.moveTolerancePx} px</strong>
          <input type="range" min={2} max={80} step={1} value={settings.moveTolerancePx} onChange={(e) => set('moveTolerancePx', +e.target.value)} />
          <small>Si el dedo se desliza más que esto, la pulsación se cancela.</small>
        </label>

        <h3>Frase</h3>
        <label className="check">
          <input type="checkbox" checked={settings.clearAfterSpeak} onChange={(e) => set('clearAfterSpeak', e.target.checked)} />
          Borrar la frase después de decirla entera (al tocar la barra de la frase)
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.autoClear} onChange={(e) => set('autoClear', e.target.checked)} />
          Borrar la frase si no se toca nada durante un tiempo
        </label>
        {settings.autoClear && (
          <label>
            Tiempo sin tocar: <strong>{settings.autoClearSeconds} s</strong>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={settings.autoClearSeconds}
              onChange={(e) => set('autoClearSeconds', +e.target.value)}
            />
            <small>Cada toque reinicia la cuenta. Una barra bajo la frase muestra el tiempo que queda.</small>
          </label>
        )}

        <h3>Carpetas</h3>
        <label className="check">
          <input type="checkbox" checked={settings.returnHome} onChange={(e) => set('returnHome', e.target.checked)} />
          Volver al tablero principal después de elegir una ficha dentro de una carpeta
        </label>

        <h3>Voz</h3>
        <label className="check">
          <input type="checkbox" checked={settings.speakOnTap} onChange={(e) => set('speakOnTap', e.target.checked)} />
          Decir cada palabra al tocarla
        </label>
        <label>
          Voz
          <select value={settings.voiceURI} onChange={(e) => set('voiceURI', e.target.value)}>
            <option value="">Automática (español de España)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <label>
          Velocidad: <strong>{settings.rate.toFixed(2)}</strong>
          <input type="range" min={0.5} max={1.5} step={0.05} value={settings.rate} onChange={(e) => set('rate', +e.target.value)} />
        </label>
        <button type="button" onClick={() => speak('Hola, esta es mi voz', settings)}>Probar voz</button>

        <h3>Pruebas</h3>
        <label className="check">
          <input type="checkbox" checked={settings.showTapLog} onChange={(e) => set('showTapLog', e.target.checked)} />
          Mostrar registro de toques
        </label>
        <div className="row">
          <button type="button" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Restaurar ajustes</button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              onResetBoards()
            }}
          >
            Nuevo tablero de ejemplo
          </button>
        </div>
      </section>
    </Modal>
  )
}
