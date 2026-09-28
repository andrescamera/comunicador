import { useState } from 'react'
import { statusText, type CloudSync } from '../lib/useCloudSync'

/** Cuenta y sincronización (en Ajustes): inicio de sesión con código por email. */
export function AccountPanel({ cloud }: { cloud: CloudSync }) {
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (cloud.email) {
    return (
      <div className="account">
        <p>
          Conectado como <strong>{cloud.email}</strong>
        </p>
        <p className={cloud.status.state === 'error' ? 'error' : 'muted'}>{statusText(cloud.status)}</p>
        <div className="row">
          <button type="button" onClick={() => void cloud.syncNow()}>Sincronizar ahora</button>
          <button type="button" onClick={() => void cloud.signOut()}>Cerrar sesión</button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm('Se borrarán la cuenta y todos sus tableros del servidor. Los de este navegador se quedan. No se puede deshacer. ¿Continuar?'))
                void run(cloud.deleteAccount)
            }}
          >
            Borrar mi cuenta y datos
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="account">
      <p className="muted">
        Inicia sesión para editar los tableros aquí y tenerlos sincronizados con la tablet. Solo se guardan tu email y tus tableros, en servidores de
        la UE.
      </p>
      {step === 'email' ? (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => (await cloud.sendCode(address), setStep('code')))
          }}
        >
          <input type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="tu@email.com" autoComplete="email" required />
          <button type="submit" className="primary" disabled={busy}>
            Enviarme un código
          </button>
        </form>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            void run(() => cloud.verifyCode(address, code))
          }}
        >
          <span>Código enviado a {address}:</span>
          <input className="code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" maxLength={8} />
          <button type="submit" className="primary" disabled={busy || code.trim().length < 6}>
            Entrar
          </button>
          <button type="button" onClick={() => (setStep('email'), setCode(''))}>
            Cambiar email
          </button>
        </form>
      )}
      {busy && <p className="muted">Un momento…</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
