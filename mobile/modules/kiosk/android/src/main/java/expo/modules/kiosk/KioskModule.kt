package expo.modules.kiosk

import android.app.ActivityManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Fijación de pantalla de Android desde la app. Sin ser «propietaria del dispositivo», startLockTask()
 * muestra el aviso del sistema («¿Fijar la aplicación?») y, al aceptarlo, la tablet queda en esta app.
 */
class KioskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Kiosk")

    Function("pin") {
      val activity = appContext.currentActivity
      activity?.runOnUiThread { activity.startLockTask() }
      null
    }

    Function("unpin") {
      val activity = appContext.currentActivity
      activity?.runOnUiThread {
        try {
          activity.stopLockTask()
        } catch (_: Exception) {
          // no estaba fijada
        }
      }
      null
    }

    Function("isPinned") {
      val context = appContext.reactContext ?: return@Function false
      val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }
  }
}
