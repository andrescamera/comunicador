import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'
import { pictoUrl } from '../shared'

export function Picto({ id, size }: { id?: number; size?: number }) {
  const style = size ? { width: size, height: size } : styles.flex
  if (!id) return <View style={[style, styles.empty]} />
  // memoria + disco: tras la primera carga funciona sin conexión y sin parpadeos
  return <Image source={pictoUrl(id)} style={style} contentFit="contain" cachePolicy="memory-disk" transition={0} />
}

const styles = StyleSheet.create({
  flex: { flex: 1, width: '100%' },
  empty: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8 },
})
