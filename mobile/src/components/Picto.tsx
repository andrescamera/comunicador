import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { supabase } from '../cloud'
import { photoUrl, pictoUrl, trimmedRect, usePictoBounds } from '../shared'

/**
 * El pictograma de una ficha o, si tiene, su foto propia.
 * `trimTo`: el hueco que ocupa; el dibujo lo llena sin el margen transparente de la imagen.
 */
export function Picto({ id, size, photo, trimTo }: { id?: number; size?: number; photo?: string; trimTo?: { width: number; height: number } }) {
  const style = size ? { width: size, height: size } : styles.flex
  const [url, setUrl] = useState<string | null>(null)
  const bounds = usePictoBounds(trimTo && !photo ? id : undefined)
  useEffect(() => {
    if (!photo) return setUrl(null)
    let alive = true
    void photoUrl(supabase, photo).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [photo])
  if (photo) {
    // La foto se guarda en el dispositivo por su ruta (no por el enlace temporal): sin conexión también se ve
    const uri = url ?? `https://foto.local/${photo}`
    return <Image source={{ uri, cacheKey: photo }} style={[style, styles.photo]} contentFit="contain" cachePolicy="memory-disk" transition={0} />
  }
  if (!id) return <View style={[style, styles.empty]} />
  // memoria + disco: tras la primera carga funciona sin conexión y sin parpadeos
  if (trimTo && bounds) {
    const { size: side, left, top } = trimmedRect(bounds, trimTo.width, trimTo.height)
    return (
      <View style={styles.trimmed}>
        <Image source={pictoUrl(id)} style={{ position: 'absolute', left, top, width: side, height: side }} contentFit="fill" cachePolicy="memory-disk" transition={0} />
      </View>
    )
  }
  return <Image source={pictoUrl(id)} style={style} contentFit="contain" cachePolicy="memory-disk" transition={0} />
}

const styles = StyleSheet.create({
  flex: { flex: 1, width: '100%' },
  trimmed: { flex: 1, width: '100%', overflow: 'hidden' },
  empty: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8 },
  photo: { borderRadius: 8 }, // entera: es la parte que se eligió al recortarla
})
