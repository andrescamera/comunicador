#!/usr/bin/env bash
# Compila el APK de Android en este Mac y lo deja en mobile/dist/comunicador.apk
#
# La primera vez hay que aceptar las licencias del SDK de Android:
#   ./scripts/build-apk.sh --accept-licenses
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
SDKMANAGER="sdkmanager --sdk_root=$ANDROID_HOME"

if [[ "${1:-}" == "--accept-licenses" ]]; then
  yes | $SDKMANAGER --licenses >/dev/null
  echo "Licencias aceptadas."
fi

echo "==> Componentes del SDK (solo descarga lo que falte)"
$SDKMANAGER "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006" >/dev/null

echo "==> Proyecto nativo (se regenera para incluir módulos y plugins nuevos)"
npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "==> Compilando APK (release, firmado con la clave de depuración)"
cd android
# Solo arquitecturas de dispositivos reales (ARM): compila más rápido y el APK pesa menos
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --console=plain
cd ..

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/comunicador.apk
echo "==> Listo: $(pwd)/dist/comunicador.apk ($(du -h dist/comunicador.apk | cut -f1))"

# Subida a Google Drive (carpeta compartida para instalar en la tablet).
# Configuración única (abre el navegador para iniciar sesión con tu cuenta de Google):
#   rclone config create comunicador-drive drive scope=drive root_folder_id=1R09OXPa8RP2wq6cfILluudh4jTJjcQd9
DRIVE_REMOTE="comunicador-drive"
if rclone listremotes 2>/dev/null | grep -q "^${DRIVE_REMOTE}:$"; then
  VERSION=$(node -p "require('./app.json').expo.version")
  STAMP=$(date +%Y%m%d-%H%M)
  echo "==> Subiendo a Google Drive"
  # Siempre la última como comunicador.apk, y una copia con fecha por si hay que volver atrás
  rclone copyto dist/comunicador.apk "${DRIVE_REMOTE}:comunicador.apk"
  rclone copyto dist/comunicador.apk "${DRIVE_REMOTE}:versiones/comunicador-${VERSION}-${STAMP}.apk"
  echo "==> Subido a Drive: comunicador.apk (y versiones/comunicador-${VERSION}-${STAMP}.apk)"
else
  echo "(Drive no configurado: para subir automáticamente, ejecuta una vez:"
  echo "   rclone config create ${DRIVE_REMOTE} drive scope=drive root_folder_id=1R09OXPa8RP2wq6cfILluudh4jTJjcQd9 )"
fi
