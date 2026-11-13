import { requireOptionalNativeModule } from 'expo'

/**
 * Fijar el Comunicador en la pantalla (la «fijación de pantalla» de Android, con `startLockTask`):
 * sin barra de navegación ni notificaciones y sin poder cambiar de app. Android pide confirmación al
 * fijar; se desfija desde la app o con el gesto del sistema (mantener Atrás + Recientes).
 */
interface KioskNative {
  pin(): void
  unpin(): void
  isPinned(): boolean
}

// Opcional: en web, en iOS o en Expo Go no existe y la opción no se muestra
const native = requireOptionalNativeModule<KioskNative>('Kiosk')

export const isPinSupported = native !== null

export const pinApp = () => native?.pin()
export const unpinApp = () => native?.unpin()
export const isAppPinned = () => native?.isPinned() ?? false
