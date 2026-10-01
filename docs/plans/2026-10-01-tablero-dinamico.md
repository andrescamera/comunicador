# Plan: tablero dinámico (por momentos de la frase)

## Objetivo
Ayudar a construir frases (no palabras sueltas) aprovechando mejor el espacio: el tablero muestra en cada
momento solo lo que encaja con cómo seguimos una frase en español (persona → acción → lo demás).

## Decisiones (confirmadas)
- Es un **modo opcional de cada tablero** («dinámico» / «estático»): se activa y desactiva desde
  «Mis tableros» o Ajustes, con las mismas fichas. Para tenerlo en paralelo al estático: duplicar y poner
  la copia en dinámico.
- Qué va en cada momento se decide **automáticamente por la categoría** de cada ficha.
- **Fichas más grandes cuando quepa**; si no (muchos verbos), se mantiene el tamaño.
- No hace falta saltar directamente a nombres: el objetivo son frases.
- **Configurable** (ver abajo).

## Cómo funciona
| Momento | Cuándo | Se ve |
|---|---|---|
| 1 · Empezar | frase vacía | personas, preguntas (qué, dónde…), verbos |
| 2 · Tras persona o pregunta | hay sujeto y aún no hay verbo | verbos (conjugados: «quiero», «voy») |
| 3 · Tras el verbo | ya hay verbo | nombres, carpetas, descriptivos, palabras pequeñas + verbos que encadenan (quiero **comer**) |

- **Columna fija** a la derecha, igual en los tres momentos: no, sí, más, ayuda (configurable).
- Se avanza al tocar; al borrar la última palabra se vuelve al momento anterior; al decir o borrar la frase, al 1.
- **Disposición fija por momento**: el orden sale del orden de las fichas en el editor, así cada palabra cae
  siempre en el mismo sitio dentro de su momento (memoria motora por momento).
- **Tamaño**: se elige la cuadrícula más pequeña (fichas más grandes) en la que caben las fichas del momento,
  sin pasar del tamaño máximo del tablero. Si aun así no caben, flechas «más ▸» para pasar de página.

## Configuración (por tablero dinámico)
- Fichas de la columna fija.
- Verbos que encadenan (por defecto: querer, ir, poder, necesitar, gustar, saber).
- Tamaño máximo de la cuadrícula (filas × columnas).
- (Más adelante, si hace falta) cambiar a mano en qué momento sale una categoría.

## Edición
- El vocabulario se edita como hoy (cuadrícula con columnas por categoría, carpetas, solo texto…).
- En modo edición, una barra «Ver momento: 1 · 2 · 3» muestra cómo quedará cada momento.

## Datos
- El tablero principal gana `dynamic?: { enabled: boolean; fixed: string[]; chainVerbs: string[]; maxRows; maxCols }`
  (sin él, estático como hasta ahora).
- Se sincroniza y se comparte como cualquier tablero (va dentro del JSON del tablero: sin cambios en Supabase).
- La lógica de momentos y colocación es una función pura compartida web/tablet, con tests.

## Fases
1. Lógica pura (momento actual, fichas de cada momento, colocación y tamaño) + tests.
2. Web: activar el modo en un tablero, uso, vista previa por momentos en edición y configuración.
3. Tablet: uso (la edición se hace en el ordenador).
4. Prueba con un tablero real y ajustes con la logopeda.
