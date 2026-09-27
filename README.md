# Comunicador

Prototipo de comunicador SAAC (pictogramas + voz) para web, tablet y móvil, pensado para sustituir a Verbo 2 en el trabajo del terapeuta.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173 (también accesible desde la red local)
npm test         # tests de gramática y del generador
```

## Qué incluye el prototipo

- **Tableros de pictogramas** (ARASAAC) con colores Fitzgerald, carpetas, Inicio/Atrás.
- **Barra de frase con conjugación automática** al estilo Verbo: `yo + querer + comer` → «yo quiero comer»,
  `yo + gustar + galletas` → «a mí me gustan galletas», verbos reflexivos, sujeto implícito «yo».
- **Pulsación robusta** (`src/lib/tap.ts`), para evitar que un toque impreciso suene varias veces:
  - se activa al soltar y solo si el dedo sigue en la misma celda;
  - bloqueo global tras cada activación (600 ms por defecto);
  - varios dedos a la vez o deslizar el dedo → se cancela;
  - la voz anterior se corta, nunca se solapan sonidos.
  - Todo es configurable en ⚙︎ Ajustes, y el **registro de toques** muestra qué se aceptó y por qué se ignoró el resto.
- **Crear tableros desde texto** (✎ Editar → ✨ Crear desde texto):
  ```
  Merienda: yo, quiero comer galletas y beber leche, "no me gusta", más, terminado
  carpeta Parque: jugamos en el columpio y el tobogán con mis amigos
  ```
  Todo va al tablero principal (`Nombre:` es solo una etiqueta); `carpeta Nombre: ...` crea una carpeta. Comas = una celda cada una;
  texto libre = se extraen las palabras clave y los verbos pasan a infinitivo; `"comillas"` = frase hecha.
- **Distribución como las aplicaciones SAAC de referencia** (TD Snap Core First, Proloquo2Go, LAMP, Grid 3):
  - **Posiciones fijas** (planificación motora): una celda nunca se mueve sola; las nuevas ocupan huecos libres.
  - **Bloques de columnas por categoría**, de izquierda a derecha en orden sintáctico:
    personas y preguntas · verbos · descriptivos · nombres · social y carpetas.
  - **Cuadrícula de tamaño fijo con huecos reservados** para que el vocabulario crezca (automática o elegida).
  - **Ocultar celdas** sin perder su sitio, para introducir vocabulario poco a poco.
  - **Tablero de ejemplo con vocabulario núcleo** (las ~64 palabras más frecuentes).
- **Editor**: pulsar una celda para editarla, una casilla vacía para crear, arrastrar (o «Mover a otra casilla») para
  cambiar de sitio; filas y columnas ajustables sin mover celdas.
- Todo se guarda en el dispositivo (localStorage).

## Pendiente (siguientes fases)

- Compartir tableros entre terapeuta y familias (cuentas + backend, RGPD).
- PWA instalable con funcionamiento sin conexión (service worker + caché de pictogramas).
- Generación de tableros con IA a partir de una descripción.
- Artículos y concordancia de género/número en la frase.

Pictogramas: Sergio Palao · ARASAAC (Gobierno de Aragón) · licencia CC BY-NC-SA.

## App nativa (Android / iOS) — `mobile/`

React Native + Expo (SDK 57). Reutiliza la lógica de `src/lib` (gramática, colocación por zonas,
generador desde texto, ARASAAC); la interfaz es nativa y los toques usan el sistema de respuesta táctil
de React Native con las mismas reglas que la web.

```bash
cd mobile
npm install
npx expo start --web              # probar en el navegador
./scripts/build-apk.sh --accept-licenses   # primera vez: acepta licencias del SDK y compila
./scripts/build-apk.sh            # siguientes veces → mobile/dist/comunicador.apk
```

Requisitos para compilar (ya instalados con Homebrew): `openjdk@17`, `android-commandlinetools`, `watchman`.

Desarrollo con emulador de tablet (Pixel Tablet, Android 16) y recarga instantánea:

```bash
cd mobile
./scripts/emulator.sh --app   # arranca el emulador, instala la versión de desarrollo y Metro
```

Cada cambio en el código aparece en el emulador en 1–2 s. Solo hay que volver a ejecutarlo si se añade un módulo nativo.
