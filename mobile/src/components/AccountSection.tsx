import { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import { type CloudSync, statusText } from '../shared'
import { colors } from '../theme'
import { Btn } from './Sheet'

/** Cuenta y sincronización (en Ajustes): inicio de sesión con código por email. */
export function AccountSection({ cloud }: { cloud: CloudSync }) {
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (cloud.email) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>
          Conectado como <Text style={{ fontWeight: '700' }}>{cloud.email}</Text>
        </Text>
        <Text style={[styles.muted, cloud.status.state === 'error' && { color: colors.bad }]}>{statusText(cloud.status)}</Text>
        <View style={styles.row}>
          <Btn title="Sincronizar ahora" onPress={() => void cloud.syncNow()} />
          <Btn title="Cerrar sesión" onPress={() => void cloud.signOut()} />
          <Btn
            title="Borrar mi cuenta y datos"
            kind="danger"
            onPress={() =>
              Alert.alert(
                'Borrar cuenta',
                'Se borrarán la cuenta y todos sus tableros del servidor. Los tableros de este dispositivo se quedan. No se puede deshacer.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Borrar', style: 'destructive', onPress: () => void run(cloud.deleteAccount) },
                ],
              )
            }
          />
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    )
  }

  return (
    <View style={styles.box}>
      <Text style={styles.muted}>
        Inicia sesión para editar los tableros también desde el ordenador y tenerlos sincronizados. Solo se guardan tu email y tus tableros, en
        servidores de la UE.
      </Text>
      {step === 'email' ? (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="tu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Btn
            title="Enviarme un código"
            kind="primary"
            disabled={busy || !/.+@.+\..+/.test(address)}
            onPress={() => void run(async () => (await cloud.sendCode(address), setStep('code')))}
          />
        </View>
      ) : (
        <>
          <Text style={styles.text}>Te hemos enviado un código a {address}. Escríbelo aquí:</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.code]}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={8}
            />
            <Btn title="Entrar" kind="primary" disabled={busy || code.trim().length < 6} onPress={() => void run(() => cloud.verifyCode(address, code))} />
            <Btn title="Cambiar email" onPress={() => (setStep('email'), setCode(''))} />
          </View>
        </>
      )}
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  text: { color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.bad },
  input: { flex: 1, minWidth: 200, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: colors.text },
  code: { maxWidth: 160, letterSpacing: 4, fontSize: 20 },
})
