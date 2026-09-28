import type { CloudSync } from '../lib/useCloudSync'
import { AccountPanel } from './AccountPanel'

/** Pantalla de acceso de la web: sin sesión no se muestra ningún tablero. */
export function LoginScreen({ cloud }: { cloud: CloudSync }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1>Comunicador</h1>
        <p className="muted">
          Acceso para preparar y editar los tableros. Los cambios aparecen solos en la tablet. Solo se guardan tu email y tus tableros, en servidores
          de la UE.
        </p>
        <AccountPanel cloud={cloud} intro={false} />
      </div>
    </div>
  )
}
