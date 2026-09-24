import type { Settings } from './types'

/**
 * Gestor de pulsaciones robusto.
 *
 * Problema en Verbo: un toque impreciso hace sonar varias celdas o la misma varias veces.
 * Reglas aquí:
 *  - Una pulsación activa como mucho UNA celda (la que se tocó al empezar).
 *  - Por defecto se activa al LEVANTAR el dedo, y solo si sigue dentro de la misma celda.
 *  - Si el dedo/cursor se desplaza más de `moveTolerancePx`, se cancela.
 *  - Si hay más de un dedo a la vez (palma, dos dedos), se cancela todo el gesto.
 *  - Tras una activación hay un tiempo de bloqueo global (`lockoutMs`): los rebotes se ignoran.
 *  - Clic secundario (dos dedos en el trackpad) se ignora.
 */

export type TapOutcome = 'ok' | 'ignored'
export interface TapLogEntry {
  n: number
  time: number
  label: string
  outcome: TapOutcome
  reason: string
  pointer: string
  holdMs?: number
}

type Handler = () => void

interface Gesture {
  pointerId: number
  el: HTMLElement | null
  x: number
  y: number
  t: number
  valid: boolean
  done: boolean
}

const handlers = new WeakMap<Element, Handler>()

/** Ref callback: registra el elemento como objetivo de pulsación. */
export function tapRef(onTap: Handler) {
  return (el: HTMLElement | null) => {
    if (el) handlers.set(el, onTap)
  }
}

class TapManager {
  settings: Settings | null = null
  private gestures = new Map<number, Gesture>()
  private lastActivation = -Infinity
  private log: TapLogEntry[] = []
  private counter = 0
  private listeners = new Set<() => void>()
  private attached = false

  attach() {
    if (this.attached) return
    this.attached = true
    document.addEventListener('pointerdown', this.onDown, { capture: true })
    document.addEventListener('pointermove', this.onMove, { capture: true })
    document.addEventListener('pointerup', this.onUp, { capture: true })
    document.addEventListener('pointercancel', this.onCancel, { capture: true })
    document.addEventListener('contextmenu', (e) => {
      if ((e.target as Element | null)?.closest?.('[data-tap]')) e.preventDefault()
    })
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  getLog() {
    return this.log
  }
  clearLog() {
    this.log = []
    this.emit()
  }
  private emit() {
    this.listeners.forEach((l) => l())
  }

  private record(el: HTMLElement | null, outcome: TapOutcome, reason: string, e: PointerEvent, holdMs?: number) {
    this.counter += 1
    const entry: TapLogEntry = {
      n: this.counter,
      time: performance.now(),
      label: el?.dataset.label ?? '—',
      outcome,
      reason,
      pointer: e.pointerType || 'mouse',
      holdMs,
    }
    this.log = [entry, ...this.log].slice(0, 80)
    this.emit()
  }

  private tapTarget(e: Event): HTMLElement | null {
    const t = e.target as Element | null
    const el = t?.closest?.('[data-tap]') as HTMLElement | null
    return el && handlers.has(el) ? el : null
  }

  private flash(el: HTMLElement | null, cls: string, ms: number) {
    if (!el) return
    el.classList.remove(cls)
    void el.offsetWidth // reinicia la animación
    el.classList.add(cls)
    window.setTimeout(() => el.classList.remove(cls), ms)
  }

  private unpress(g: Gesture) {
    g.el?.classList.remove('tap-pressed')
  }

  private tryActivate(g: Gesture, e: PointerEvent, holdMs?: number) {
    const s = this.settings!
    const now = performance.now()
    const since = now - this.lastActivation
    if (since < s.lockoutMs) {
      this.record(g.el, 'ignored', `bloqueo: repetido a los ${Math.round(since)} ms`, e, holdMs)
      this.flash(g.el, 'tap-rejected', 350)
      return
    }
    this.lastActivation = now
    this.record(g.el, 'ok', 'activado', e, holdMs)
    this.flash(g.el, 'tap-fired', 450)
    handlers.get(g.el!)?.()
  }

  private onDown = (e: PointerEvent) => {
    if (!this.settings) return
    const el = this.tapTarget(e)

    if (e.pointerType === 'mouse' && e.button !== 0) {
      if (el) this.record(el, 'ignored', 'clic secundario', e)
      return
    }

    if (this.gestures.size > 0) {
      // Segundo contacto simultáneo: palma o dos dedos. Se anula todo.
      for (const g of this.gestures.values()) {
        if (g.valid && !g.done) this.record(g.el, 'ignored', 'varios dedos a la vez', e)
        g.valid = false
        this.unpress(g)
      }
      this.gestures.set(e.pointerId, { pointerId: e.pointerId, el, x: e.clientX, y: e.clientY, t: performance.now(), valid: false, done: false })
      return
    }

    const g: Gesture = { pointerId: e.pointerId, el, x: e.clientX, y: e.clientY, t: performance.now(), valid: !!el, done: false }
    this.gestures.set(e.pointerId, g)
    if (!el) return

    e.preventDefault()
    el.classList.add('tap-pressed')

    if (this.settings.activateOn === 'press') {
      g.done = true
      this.unpress(g)
      this.tryActivate(g, e)
    }
  }

  private onMove = (e: PointerEvent) => {
    const g = this.gestures.get(e.pointerId)
    if (!g || !g.valid || g.done || !this.settings) return
    const d = Math.hypot(e.clientX - g.x, e.clientY - g.y)
    if (d > this.settings.moveTolerancePx) {
      g.valid = false
      this.unpress(g)
      this.record(g.el, 'ignored', `se movió ${Math.round(d)} px`, e)
    }
  }

  private onUp = (e: PointerEvent) => {
    const g = this.gestures.get(e.pointerId)
    if (!g) return
    this.gestures.delete(e.pointerId)
    this.unpress(g)
    if (!g.valid || g.done || !g.el || !this.settings) return

    const holdMs = Math.round(performance.now() - g.t)
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-tap]')
    if (under !== g.el) {
      this.record(g.el, 'ignored', 'soltado fuera de la celda', e, holdMs)
      return
    }
    if (holdMs < this.settings.minHoldMs) {
      this.record(g.el, 'ignored', `demasiado corto (${holdMs} ms)`, e, holdMs)
      return
    }
    this.tryActivate(g, e, holdMs)
  }

  private onCancel = (e: PointerEvent) => {
    const g = this.gestures.get(e.pointerId)
    if (!g) return
    this.gestures.delete(e.pointerId)
    this.unpress(g)
    if (g.valid && !g.done) this.record(g.el, 'ignored', 'cancelado por el sistema', e)
  }
}

export const tapManager = new TapManager()
