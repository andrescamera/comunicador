import { requireOptionalNativeModule } from 'expo'

export interface RecognizedBox {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface RecognizedLine extends RecognizedBox {
  elements?: RecognizedBox[] // palabras de la línea (Android)
}

export interface RecognitionResult {
  width: number
  height: number
  lines: RecognizedLine[]
}

interface TextRecognizerNative {
  recognize(uri: string): Promise<RecognitionResult>
}

// Opcional: en web (o en Expo Go) no existe y la función se desactiva
const native = requireOptionalNativeModule<TextRecognizerNative>('TextRecognizer')

export const isTextRecognitionSupported = native !== null

export function recognizeText(uri: string): Promise<RecognitionResult> {
  if (!native) return Promise.reject(new Error('El reconocimiento de texto solo está disponible en la app instalada'))
  return native.recognize(uri)
}
