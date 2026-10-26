import { useEffect, useState } from 'react'
import { pictoUrl } from '../lib/arasaac'
import { supabase } from '../lib/cloud'
import { photoUrl } from '../lib/photos'

/** El pictograma de una ficha o, si tiene, su foto propia */
export function Picto({ id, alt, photo }: { id?: number; alt: string; photo?: string }) {
  const [url, setUrl] = useState<string | null>(null)
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
  return <img className="picto" src={pictoUrl(id)} alt={alt} draggable={false} loading="lazy" />
}
