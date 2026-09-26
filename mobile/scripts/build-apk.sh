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

echo "==> Proyecto nativo"
[[ -d android ]] || npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

echo "==> Compilando APK (release, firmado con la clave de depuración)"
cd android
# Solo arquitecturas de dispositivos reales (ARM): compila más rápido y el APK pesa menos
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --console=plain
cd ..

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/comunicador.apk
echo "==> Listo: $(pwd)/dist/comunicador.apk ($(du -h dist/comunicador.apk | cut -f1))"
