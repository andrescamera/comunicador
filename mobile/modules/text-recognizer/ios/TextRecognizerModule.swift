import ExpoModulesCore
import UIKit
import Vision

/** Reconoce el texto de una imagen y devuelve cada línea con su posición (en píxeles de la imagen). */
public class TextRecognizerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextRecognizer")

    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      guard let url = URL(string: uri),
            let data = try? Data(contentsOf: url),
            let image = UIImage(data: data),
            let cgImage = image.cgImage else {
        promise.reject("ERR_OCR", "No se pudo abrir la imagen")
        return
      }
      let width = CGFloat(cgImage.width)
      let height = CGFloat(cgImage.height)
      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("ERR_OCR", error.localizedDescription)
          return
        }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        let lines: [[String: Any]] = observations.compactMap { obs in
          guard let text = obs.topCandidates(1).first?.string else { return nil }
          let box = obs.boundingBox // normalizado, origen abajo a la izquierda
          return [
            "text": text,
            "x": box.minX * width,
            "y": (1 - box.maxY) * height,
            "width": box.width * width,
            "height": box.height * height,
          ]
        }
        promise.resolve(["width": width, "height": height, "lines": lines])
      }
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["es-ES"]
      request.usesLanguageCorrection = true
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
        } catch {
          promise.reject("ERR_OCR", error.localizedDescription)
        }
      }
    }
  }
}
