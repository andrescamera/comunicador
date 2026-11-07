import { useEffect, useState } from 'react'
import { pictoUrl } from '../lib/arasaac'
import { supabase } from '../lib/cloud'
import { photoUrl } from '../lib/photos'
import { usePictoBounds } from '../lib/pictoBounds'
import { connectPictoBounds } from '../lib/storage'

connectPictoBounds()

/**
 * El pictograma de una ficha o, si tiene, su foto propia.
 * `trim`: sin el margen transparente de la imagen, para que el dibujo llene el hueco.
 */
export function Picto({ id, alt, photo, trim }: { id?: number; alt: string; photo?: string; trim?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const bounds = usePictoBounds(trim && !photo ? id : undefined)
  useEffect(() => {
    if (!photo) return setUrl(null)
    let alive = true
    void photoUrl(supabase, photo).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [photo])
  if (photo) return url ? <img className="picto picto-photo" src={url} alt={alt} draggable={false} /> : <div className="picto picto-empty" aria-hidden />
  if (!id) return <div className="picto picto-empty" aria-hidden />
  if (bounds) {
    const [x0, y0, x1, y1, side] = bounds
    return (
      <svg className="picto" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} role="img" aria-label={alt}>
        <image href={pictoUrl(id)} width={side} height={side} />
      </svg>
    )
  }
  return <img className="picto" src={pictoUrl(id)} alt={alt} draggable={false} loading="lazy" />
}
