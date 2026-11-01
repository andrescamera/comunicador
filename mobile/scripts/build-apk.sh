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

# Subida a Google Drive: se copia a la carpeta sincronizada por Google Drive para escritorio
# (Mi unidad/apk, https://drive.google.com/drive/folders/1R09OXPa8RP2wq6cfILluudh4jTJjcQd9)
DRIVE_DIR="$HOME/Library/CloudStorage/GoogleDrive-andrescamera@gmail.com/Mi unidad/apk"

# Versión 1.N: la siguiente a la mayor ya publicada (comunicador_1.N.apk en Drive o en dist/)
LAST=$(ls "$DRIVE_DIR" "$DRIVE_DIR/versiones" dist 2>/dev/null \
  | sed -nE 's/^comunicador_1\.([0-9]+)\.apk$/\1/p' | sort -n | tail -1)
BUILD=$(( ${LAST:-0} + 1 ))
VERSION="1.$BUILD"
APK="comunicador_${VERSION}.apk"
echo "==> Versión $VERSION"

echo "==> Proyecto nativo (se regenera para incluir módulos y plugins nuevos)"
npx expo prebuild --platform android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# La versión se pone en el proyecto generado (no en app.json) para que se vea en Ajustes > Aplicaciones;
# versionCode tiene que subir siempre para que Android lo acepte como actualización
sed -i '' -E "s/versionCode [0-9]+/versionCode $((BUILD + 1))/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" \
  android/app/build.gradle

echo "==> Compilando APK (release, firmado con la clave de depuración)"
cd android
# Solo arquitecturas de dispositivos reales (ARM): compila más rápido y el APK pesa menos
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --console=plain
cd ..

mkdir -p dist
rm -f dist/comunicador*.apk
cp android/app/build/outputs/apk/release/app-release.apk "dist/$APK"
echo "==> Listo: $(pwd)/dist/$APK ($(du -h "dist/$APK" | cut -f1))"

if [[ -d "$DRIVE_DIR" ]]; then
  mkdir -p "$DRIVE_DIR/versiones"
  # En apk/ solo queda la última; las anteriores pasan a versiones/ por si hay que volver atrás
  for old in "$DRIVE_DIR"/comunicador*.apk; do
    [[ -e "$old" ]] && mv "$old" "$DRIVE_DIR/versiones/"
  done
  cp "dist/$APK" "$DRIVE_DIR/$APK"
  echo "==> Copiado a Drive (se sube solo si Google Drive para escritorio está abierto): apk/$APK"
else
  echo "(No se encuentra la carpeta de Drive: $DRIVE_DIR)"
fi
