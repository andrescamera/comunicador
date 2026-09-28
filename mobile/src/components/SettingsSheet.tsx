import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import type { Voice } from 'expo-speech'
import { type CloudSync, DEFAULT_SETTINGS, type Settings } from '../shared'
import { AccountSection } from './AccountSection'
import { spanishVoices, speak } from '../speech'
import { colors } from '../theme'
import { Btn, Sheet } from './Sheet'
import { TapLog } from './TapLog'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onResetBoards: () => void
  onClose: () => void
  cloud: CloudSync
}

export function SettingsSheet({ settings, onChange, onResetBoards, onClose, cloud }: Props) {
  const [voices, setVoices] = useState<Voice[]>([])
  useEffect(() => {
    void spanishVoices().then(setVoices)
  }, [])
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })

  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <Text style={styles.h}>Cuenta y sincronización</Text>
      <AccountSection cloud={cloud} />

      <Text style={styles.h}>Pulsación</Text>
      <Choice
        options={[
          ['release', 'Al soltar (recomendado)'],
          ['press', 'Al pulsar (más rápido)'],
        ]}
        value={settings.activateOn}
        onChange={(v) => set('activateOn', v as Settings['activateOn'])}
      />
      <Stepper label="Bloqueo tras activar" unit="ms" value={settings.lockoutMs} step={50} min={0} max={2000} onChange={(v) => set('lockoutMs', v)}
        help="Durante este tiempo se ignora cualquier otro toque (evita repeticiones)." />
      <Stepper label="Pulsación mínima" unit="ms" value={settings.minHoldMs} step={50} min={0} max={1500} onChange={(v) => set('minHoldMs', v)}
        help="Ignora roces muy breves. 0 = desactivado." />
      <Stepper label="Tolerancia de movimiento" unit="px" value={settings.moveTolerancePx} step={2} min={2} max={80} onChange={(v) => set('moveTolerancePx', v)}
        help="Si el dedo se desliza más que esto, la pulsación se cancela." />

      <Text style={styles.h}>Frase</Text>
      <Toggle label="Borrar la frase después de decirla (al tocar la barra de la frase)" value={settings.clearAfterSpeak} onChange={(v) => set('clearAfterSpeak', v)} />
      <Toggle label="Borrar la frase si no se toca nada durante un tiempo" value={settings.autoClear} onChange={(v) => set('autoClear', v)} />
      {settings.autoClear && (
        <Stepper label="Tiempo sin tocar" unit="s" value={settings.autoClearSeconds} step={1} min={1} max={10} onChange={(v) => set('autoClearSeconds', v)}
          help="Cada toque reinicia la cuenta." />
      )}

      <Text style={styles.h}>Voz</Text>
      <Toggle label="Decir cada palabra al tocarla" value={settings.speakOnTap} onChange={(v) => set('speakOnTap', v)} />
      <Stepper label="Velocidad" unit="" value={settings.rate} step={0.05} min={0.5} max={1.5} decimals={2} onChange={(v) => set('rate', v)} />
      <Text style={styles.label}>Voz</Text>
      <Choice
        options={[['', 'Automática'], ...voices.map((v) => [v.identifier, `${v.name} (${v.language})`] as [string, string])]}
        value={settings.voiceURI}
        onChange={(v) => set('voiceURI', v)}
      />
      <Btn title="Probar voz" onPress={() => speak('Hola, esta es mi voz', settings)} />

      <Text style={styles.h}>Pruebas</Text>
      <Text style={styles.help}>Últimas pulsaciones: cuáles se aceptaron y por qué se ignoraron las demás.</Text>
      <TapLog />
      <View style={styles.row}>
        <Btn title="Restaurar ajustes" onPress={() => onChange({ ...DEFAULT_SETTINGS })} />
        <Btn
          title="Restaurar tableros de ejemplo"
          kind="danger"
          onPress={() =>
            Alert.alert('Restaurar tableros', '¿Reemplazar todos los tableros por los de ejemplo?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Reemplazar', style: 'destructive', onPress: onResetBoards },
            ])
          }
        />
      </View>
    </Sheet>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Switch value={value} onValueChange={onChange} />
      <Text style={styles.toggleText}>{label}</Text>
    </View>
  )
}

function Stepper(p: { label: string; unit: string; value: number; step: number; min: number; max: number; decimals?: number; help?: string; onChange: (v: number) => void }) {
  const fmt = (v: number) => (p.decimals ? v.toFixed(p.decimals) : String(Math.round(v)))
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, Math.round(v / p.step) * p.step))
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.stepRow}>
        <Text style={[styles.label, { flex: 1 }]}>
          {p.label}: <Text style={{ fontWeight: '800' }}>{fmt(p.value)} {p.unit}</Text>
        </Text>
        <Pressable style={styles.stepBtn} onPress={() => p.onChange(clamp(p.value - p.step))}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={() => p.onChange(clamp(p.value + p.step))}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
      {p.help && <Text style={styles.help}>{p.help}</Text>}
    </View>
  )
}

function Choice({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {options.map(([v, text]) => (
        <Pressable key={v || 'auto'} onPress={() => onChange(v)} style={[styles.chip, value === v && styles.chipActive]}>
          <Text style={[styles.chipText, value === v && { color: 'white' }]}>{text}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  h: { fontSize: 16, fontWeight: '700', color: colors.accent, marginTop: 8 },
  label: { fontWeight: '600', color: colors.text },
  help: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleText: { flex: 1, color: colors.text },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 44, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 22, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.text },
})
