import { useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import { type CloudSync, statusText } from '../shared'
import { colors } from '../theme'
import { Btn } from './Sheet'

/** Cuenta y sincronización (en Ajustes): inicio de sesión con email y contraseña. */
export function AccountSection({ cloud }: { cloud: CloudSync }) {
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setInfo('')
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

  const valid = /.+@.+\..+/.test(address) && password.length >= 6
  return (
    <View style={styles.box}>
      <Text style={styles.muted}>
        Inicia sesión para editar los tableros también desde el ordenador y tenerlos sincronizados. Solo se guardan tu email y tus tableros, en
        servidores de la UE.
      </Text>
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
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña (mín. 6)"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />
      </View>
      <View style={styles.row}>
        <Btn title="Entrar" kind="primary" disabled={busy || !valid} onPress={() => void run(() => cloud.signIn(address, password))} />
        <Btn
          title="Crear cuenta"
          disabled={busy || !valid}
          onPress={() =>
            void run(async () => {
              const mustConfirm = await cloud.signUp(address, password)
              if (mustConfirm) setInfo(`Cuenta creada. Te hemos enviado un email a ${address}: abre el enlace para confirmarla y después pulsa «Entrar».`)
            })
          }
        />
      </View>
      {busy && <ActivityIndicator color={colors.accent} />}
      {!!info && <Text style={styles.info}>{info}</Text>}
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
  info: { color: colors.ok },
  input: { flex: 1, minWidth: 200, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: colors.text },
})
