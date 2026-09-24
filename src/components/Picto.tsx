import { pictoUrl } from '../lib/arasaac'

export function Picto({ id, alt }: { id?: number; alt: string }) {
  if (!id) return <div className="picto picto-empty" aria-hidden />
  return <img className="picto" src={pictoUrl(id)} alt={alt} draggable={false} loading="lazy" />
}
