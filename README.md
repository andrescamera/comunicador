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
- **Editor de celdas**: texto, tipo, categoría/color, buscador de pictogramas ARASAAC, mover y eliminar.
- Todo se guarda en el dispositivo (localStorage).

## Pendiente (siguientes fases)

- Compartir tableros entre terapeuta y familias (cuentas + backend, RGPD).
- PWA instalable con funcionamiento sin conexión (service worker + caché de pictogramas).
- Generación de tableros con IA a partir de una descripción.
- Artículos y concordancia de género/número en la frase.

Pictogramas: Sergio Palao · ARASAAC (Gobierno de Aragón) · licencia CC BY-NC-SA.
