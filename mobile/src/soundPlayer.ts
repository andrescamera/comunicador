import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { Directory, File, Paths } from 'expo-file-system'
import { supabase } from './cloud'
import { soundUrl } from './shared'

/**
 * Sonidos de las fichas «Sonido» en la tablet: se guardan en el dispositivo la primera vez (por su
 * ruta), así luego suenan sin conexión. Un solo reproductor: un sonido nuevo corta el anterior.
 */
const dir = new Directory(Paths.document, 'sonidos')
const localFile = (path: string) => new File(dir, path.replace(/\//g, '_'))

let player: AudioPlayer | null = null
let modeSet = false

/** El archivo del sonido en el dispositivo (lo descarga si aún no está); null si no se puede */
export async function localSound(path: string): Promise<string | null> {
  const file = localFile(path)
  if (file.exists) return file.uri
  const url = await soundUrl(supabase, path)
  if (!url) return null
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
    return (await File.downloadFileAsync(url, file, { idempotent: true })).uri
  } catch {
    return null
  }
}

/**
 * Sube un sonido grabado en la tablet (`uri`: su .m4a) con `upload` y lo deja ya en la caché local con
 * su ruta definitiva, para que suene sin volver a descargarlo.
 */
export async function saveRecording(uri: string, upload: (data: ArrayBuffer) => Promise<string>): Promise<string> {
  const recorded = new File(uri)
  const path = await upload(await recorded.arrayBuffer())
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
    recorded.copy(localFile(path))
  } catch {
    /* ya se descargará la primera vez que suene */
  }
  return path
}

/** Guardar ya en el dispositivo los sonidos de un tablero (para que suenen aunque luego no haya red) */
export function prefetchSounds(paths: string[]) {
  for (const p of paths) void localSound(p)
}

/** Reproducir un sonido: de una ficha (su ruta) o una muestra de Freesound (un enlace) */
export async function play(source: { path: string } | { url: string }): Promise<boolean> {
  const uri = 'url' in source ? source.url : await localSound(source.path)
  if (!uri) return false
  if (!modeSet) {
    modeSet = true
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }
  if (!player) player = createAudioPlayer(uri)
  else player.replace(uri)
  await player.seekTo(0).catch(() => {})
  player.play()
  return true
}

export function stop() {
  player?.pause()
}
