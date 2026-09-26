import { useRef } from 'react'
import type { GestureResponderEvent, GestureResponderHandlers } from 'react-native'
import type { Settings } from './shared'

/**
 * Pulsación robusta (misma lógica que la versión web):
 *  - Una pulsación activa como mucho UN objetivo: el que se tocó al empezar.
 *  - Por defecto se activa al LEVANTAR el dedo, y solo si sigue sobre el mismo objetivo.
 *  - Si el dedo se desplaza más de `moveTolerancePx`, se cancela.
 *  - Si hay más de un dedo a la vez (palma, dos dedos), se cancela el gesto entero.
 *  - Tras una activación hay un bloqueo global (`lockoutMs`) que ignora rebotes y repeticiones.
 * Los hijos de una superficie deben tener pointerEvents="none": así las coordenadas son siempre
 * relativas a la superficie y el objetivo se calcula con `hitTest`.
 */

export interface TapLogEntry {
  n: number
  label: string
  ok: boolean
  reason: string
}

type Listener = () => void

class TapGuard {
  settings: Settings | null = null
  lastActivation = -Infinity
  log: TapLogEntry[] = []
  private n = 0
  private listeners = new Set<Listener>()

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
  record(label: string, ok: boolean, reason: string) {
    this.log = [{ n: ++this.n, label, ok, reason }, ...this.log].slice(0, 60)
    this.listeners.forEach((l) => l())
  }
  clearLog() {
    this.log = []
    this.listeners.forEach((l) => l())
  }
}

export const tapGuard = new TapGuard()

interface Options<K> {
  hitTest: (x: number, y: number) => K | null
  onTap: (key: K) => void
  label?: (key: K) => string
  onPressChange?: (key: K | null) => void
  onFired?: (key: K) => void
  /** En edición no hay bloqueo ni registro: es la interfaz del terapeuta */
  guard?: boolean
}

interface Gesture<K> {
  key: K | null
  x: number
  y: number
  t: number
  valid: boolean
  done: boolean
}

export function useTapSurface<K>(opts: Options<K>): GestureResponderHandlers {
  const ref = useRef(opts)
  ref.current = opts
  const g = useRef<Gesture<K> | null>(null)

  const name = (k: K | null) => (k === null ? '—' : (ref.current.label?.(k) ?? String(k)))
  const cancel = (reason: string) => {
    const cur = g.current
    if (!cur || !cur.valid || cur.done) return
    cur.valid = false
    ref.current.onPressChange?.(null)
    if (ref.current.guard !== false && cur.key !== null) tapGuard.record(name(cur.key), false, reason)
  }
  const activate = (key: K) => {
    const o = ref.current
    const s = tapGuard.settings
    if (o.guard !== false && s) {
      const now = Date.now()
      const since = now - tapGuard.lastActivation
      if (since < s.lockoutMs) {
        tapGuard.record(name(key), false, `bloqueo: repetido a los ${since} ms`)
        return
      }
      tapGuard.lastActivation = now
      tapGuard.record(name(key), true, 'activado')
    }
    o.onFired?.(key)
    o.onTap(key)
  }

  return {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => false,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      const { locationX, locationY, pageX, pageY, touches } = e.nativeEvent
      const key = ref.current.hitTest(locationX, locationY)
      g.current = { key, x: pageX, y: pageY, t: Date.now(), valid: key !== null, done: false }
      if (touches.length > 1) return cancel('varios dedos a la vez')
      if (key === null) return
      ref.current.onPressChange?.(key)
      // Modo "activar al pulsar" (como Verbo): no espera a que se levante el dedo
      if (tapGuard.settings?.activateOn === 'press' && ref.current.guard !== false) {
        g.current.done = true
        ref.current.onPressChange?.(null)
        activate(key)
      }
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const cur = g.current
      if (!cur || !cur.valid || cur.done) return
      const { pageX, pageY, touches } = e.nativeEvent
      if (touches.length > 1) return cancel('varios dedos a la vez')
      const d = Math.hypot(pageX - cur.x, pageY - cur.y)
      const tol = tapGuard.settings?.moveTolerancePx ?? 14
      if (d > tol) cancel(`se movió ${Math.round(d)} px`)
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const cur = g.current
      g.current = null
      if (!cur || !cur.valid || cur.done || cur.key === null) return
      ref.current.onPressChange?.(null)
      const { locationX, locationY } = e.nativeEvent
      const hold = Date.now() - cur.t
      if (ref.current.hitTest(locationX, locationY) !== cur.key) {
        if (ref.current.guard !== false) tapGuard.record(name(cur.key), false, 'soltado fuera')
        return
      }
      const min = tapGuard.settings?.minHoldMs ?? 0
      if (ref.current.guard !== false && hold < min) {
        tapGuard.record(name(cur.key), false, `demasiado corto (${hold} ms)`)
        return
      }
      activate(cur.key)
    },
    onResponderTerminate: () => {
      cancel('cancelado por el sistema')
      g.current = null
    },
  }
}
