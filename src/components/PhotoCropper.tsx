import { type PointerEvent, type WheelEvent, useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'

const FRAME = 300 // lado del recuadro en pantalla (px)

/**
 * Elegir qué parte de la foto se ve en la ficha: arrastrar para mover y acercar o alejar
 * (barra o rueda del ratón). Devuelve un JPEG cuadrado de `size` px.
 */
export function PhotoCropper({ file, size = 600, onDone, onCancel }: { file: Blob; size?: number; onDone: (jpeg: Blob) => void; onCancel: () => void }) {
  const [img, setImg] = useState<{ el: HTMLImageElement; url: string } | null>(null)
  const [zoom, setZoom] = useState(1) // 1 = la foto cubre justo el recuadro
  const [pos, setPos] = useState({ x: 0, y: 0 }) // esquina de la foto dentro del recuadro (px)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => setImg({ el, url })
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const cover = img ? FRAME / Math.min(img.el.naturalWidth, img.el.naturalHeight) : 1
  const scale = cover * zoom
  const w = (img?.el.naturalWidth ?? 0) * scale
  const h = (img?.el.naturalHeight ?? 0) * scale
  // La foto siempre cubre el recuadro: sin bordes vacíos
  const clamp = (p: { x: number; y: number }, ww = w, hh = h) => ({ x: Math.min(0, Math.max(FRAME - ww, p.x)), y: Math.min(0, Math.max(FRAME - hh, p.y)) })

  // Al cargar: centrada
  useEffect(() => {
    if (img) setPos(clamp({ x: (FRAME - w) / 2, y: (FRAME - h) / 2 }))
  }, [img]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Cambiar el zoom manteniendo fijo el centro del recuadro */
  const setZoomKeep = (z: number) => {
    const next = Math.min(4, Math.max(1, z))
    if (!img) return setZoom(next)
    const ns = cover * next
    const cx = (FRAME / 2 - pos.x) / scale
    const cy = (FRAME / 2 - pos.y) / scale
    const nw = img.el.naturalWidth * ns
    const nh = img.el.naturalHeight * ns
    setZoom(next)
    setPos(clamp({ x: FRAME / 2 - cx * ns, y: FRAME / 2 - cy * ns }, nw, nh))
  }

  const onDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (d) setPos(clamp({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }))
  }
  const onWheel = (e: WheelEvent) => setZoomKeep(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))

  const done = () => {
    if (!img) return
    // La parte de la foto original que se ve en el recuadro
    const sx = -pos.x / scale
    const sy = -pos.y / scale
    const side = FRAME / scale
    const out = Math.min(size, Math.round(side))
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = out
    canvas.getContext('2d')!.drawImage(img.el, sx, sy, side, side, 0, 0, out, out)
    canvas.toBlob((b) => b && onDone(b), 'image/jpeg', 0.85)
  }

  return (
    <Modal title="¿Qué parte de la foto se ve?" onClose={onCancel}>
      <div className="cropper">
        <div
          className="cropper-frame"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={onWheel}
        >
          {img ? (
            <img src={img.url} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
          ) : (
            <span className="muted">Cargando…</span>
          )}
        </div>
        <label className="cropper-zoom">
          <span aria-hidden>➖</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomKeep(Number(e.target.value))} aria-label="Acercar o alejar" />
          <span aria-hidden>➕</span>
        </label>
        <p className="muted">Arrastra la foto para elegir qué parte se ve en la ficha; acerca o aleja con la barra o la rueda del ratón.</p>
      </div>
      <footer className="modal-footer">
        <span className="spacer" />
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="button" className="primary" disabled={!img} onClick={done}>
          Usar esta parte
        </button>
      </footer>
    </Modal>
  )
}
