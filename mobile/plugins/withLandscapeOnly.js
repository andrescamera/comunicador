// Solo en horizontal (en los dos sentidos) también en tablets: HyperOS y Android 16 (API 36) pueden
// ignorar en pantallas grandes la orientación que pide la app. Se pide «sensorLandscape», la app no
// cambia de tamaño y se acoge a la excepción de Android 16 para mantener la orientación.
const { withAndroidManifest } = require('expo/config-plugins')

module.exports = function withLandscapeOnly(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0]
    const activity = app.activity.find((a) => a.$['android:name'] === '.MainActivity')
    activity.$['android:screenOrientation'] = 'sensorLandscape'
    activity.$['android:resizeableActivity'] = 'false'
    const name = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY'
    app.property = (app.property ?? []).filter((p) => p.$['android:name'] !== name)
    app.property.push({ $: { 'android:name': name, 'android:value': 'true' } })
    return cfg
  })
}
