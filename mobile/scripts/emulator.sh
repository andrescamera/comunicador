#!/usr/bin/env bash
# Arranca el emulador de tablet Android y deja la app de desarrollo conectada con recarga instantánea.
#   ./scripts/emulator.sh          -> arranca el emulador (si no está ya) y espera a que arranque
#   ./scripts/emulator.sh --app    -> además compila/instala la versión de desarrollo y arranca Metro
set -euo pipefail
cd "$(dirname "$0")/.."

export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
AVD="Comunicador_Tablet"

if ! avdmanager list avd 2>/dev/null | grep -q "Name: $AVD"; then
  echo "==> Creando la tablet virtual ($AVD, Pixel Tablet, Android 16)"
  echo no | avdmanager create avd -n "$AVD" -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_tablet --force >/dev/null
  # Horizontal, teclado del ordenador y sin arranque rápido raro
  CFG="$HOME/.android/avd/$AVD.avd/config.ini"
  sed -i '' 's/^hw.keyboard=.*/hw.keyboard=yes/' "$CFG" 2>/dev/null || true
  grep -q '^hw.keyboard=' "$CFG" || echo 'hw.keyboard=yes' >> "$CFG"
fi

if ! adb devices | grep -q '^emulator-'; then
  echo "==> Arrancando el emulador"
  nohup emulator -avd "$AVD" -no-boot-anim -no-snapshot-save >/tmp/comunicador-emulator.log 2>&1 &
fi
adb wait-for-device
until [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 2; done
adb shell settings put system accelerometer_rotation 0
adb shell cmd window user-rotation lock 0 # horizontal (orientación natural de la Pixel Tablet)
echo "==> Emulador listo"

# Si la versión de desarrollo ya está instalada y el servidor (Metro) corre: conectar y abrir la app
if adb shell pm list packages | grep -q com.andrescamera.comunicador && curl -s -m 2 http://localhost:8081/status | grep -q running; then
  # Recién arrancado, el emulador tarda en aceptar la redirección al servidor (Metro): la primera
  # apertura puede fallar. Se conecta y abre dos veces, con una pausa entre medias.
  for attempt in 1 2; do
    sleep 6
    adb reverse tcp:8081 tcp:8081 >/dev/null
    adb shell am force-stop com.andrescamera.comunicador
    adb shell am start -n com.andrescamera.comunicador/.MainActivity >/dev/null
  done
  echo "==> App abierta y conectada al servidor de desarrollo"
fi

if [[ "${1:-}" == "--app" ]]; then
  echo "==> Versión de desarrollo (recarga instantánea al guardar cambios)"
  npx expo run:android
fi
