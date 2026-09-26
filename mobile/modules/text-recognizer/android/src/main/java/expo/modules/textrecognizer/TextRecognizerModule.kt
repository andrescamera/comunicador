package expo.modules.textrecognizer

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Reconoce el texto de una imagen y devuelve cada línea con su posición (en píxeles de la imagen). */
class TextRecognizerModule : Module() {
  private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

  override fun definition() = ModuleDefinition {
    Name("TextRecognizer")

    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_OCR", "La aplicación no está lista", null)
        return@AsyncFunction
      }
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_OCR", "No se pudo abrir la imagen", e)
        return@AsyncFunction
      }
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
            val box = line.boundingBox ?: return@mapNotNull null
            mapOf(
              "text" to line.text,
              "x" to box.left,
              "y" to box.top,
              "width" to box.width(),
              "height" to box.height(),
            )
          }
          promise.resolve(mapOf("width" to image.width, "height" to image.height, "lines" to lines))
        }
        .addOnFailureListener { e -> promise.reject("ERR_OCR", "No se pudo reconocer el texto", e) }
    }
  }
}
