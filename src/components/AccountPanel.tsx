import { useState } from 'react'
import { statusText, type CloudSync } from '../lib/useCloudSync'

/** Cuenta y sincronización (en Ajustes): inicio de sesión con email y contraseña. */
export function AccountPanel({ cloud, intro = true }: { cloud: CloudSync; intro?: boolean }) {
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setInfo('')
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

  const valid = /.+@.+\..+/.test(address) && password.length >= 6
  return (
    <div className="account">
      {intro && (
        <p className="muted">
          Inicia sesión para editar los tableros aquí y tenerlos sincronizados con la tablet. Solo se guardan tu email y tus tableros, en servidores
          de la UE.
        </p>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => cloud.signIn(address, password))
        }}
      >
        <input type="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="tu@email.com" autoComplete="email" required />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña (mín. 6)"
          autoComplete="current-password"
          required
        />
        <button type="submit" className="primary" disabled={busy || !valid}>
          Entrar
        </button>
        <button
          type="button"
          disabled={busy || !valid}
          onClick={() =>
            void run(async () => {
              const mustConfirm = await cloud.signUp(address, password)
              if (mustConfirm) setInfo(`Cuenta creada. Te hemos enviado un email a ${address}: abre el enlace para confirmarla y después pulsa «Entrar».`)
            })
          }
        >
          Crear cuenta
        </button>
      </form>
      {busy && <p className="muted">Un momento…</p>}
      {info && <p className="info">{info}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
