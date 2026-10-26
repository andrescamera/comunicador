import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { supabase } from '../cloud'
import { photoUrl, pictoUrl } from '../shared'

/** El pictograma de una ficha o, si tiene, su foto propia */
export function Picto({ id, size, photo }: { id?: number; size?: number; photo?: string }) {
  const style = size ? { width: size, height: size } : styles.flex
  const [url, setUrl] = useState<string | null>(null)
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
    return <Image source={{ uri, cacheKey: photo }} style={[style, styles.photo]} contentFit="cover" cachePolicy="memory-disk" transition={0} />
  }
  if (!id) return <View style={[style, styles.empty]} />
  // memoria + disco: tras la primera carga funciona sin conexión y sin parpadeos
  return <Image source={pictoUrl(id)} style={style} contentFit="contain" cachePolicy="memory-disk" transition={0} />
}

const styles = StyleSheet.create({
  flex: { flex: 1, width: '100%' },
  empty: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8 },
  photo: { borderRadius: 8 },
})
