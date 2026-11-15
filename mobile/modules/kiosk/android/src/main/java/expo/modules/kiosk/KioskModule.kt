package expo.modules.kiosk

import android.app.ActivityManager
import android.content.Context
import android.content.pm.ActivityInfo
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Fijación de pantalla de Android desde la app (y orientación solo horizontal). Sin ser «propietaria del dispositivo», startLockTask()
 * muestra el aviso del sistema («¿Fijar la aplicación?») y, al aceptarlo, la tablet queda en esta app.
 */
class KioskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Kiosk")

    // Solo en horizontal: se vuelve a pedir cada vez que la app pasa a primer plano (por si el sistema
    // la ha girado a vertical; ver plugins/withLandscapeOnly.js)
    OnActivityEntersForeground {
      appContext.currentActivity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
    }

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
