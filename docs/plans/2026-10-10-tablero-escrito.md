# Tablero escrito (ver y editar todo el tablero como texto)

## Objetivo
Añadir carpetas y vocabulario más rápido. El tablero entero (principal, carpetas y subcarpetas, con
sus grupos) se ve como texto, se edita y se aplica. El texto describe el tablero completo, de modo
que ida y vuelta lo deja exactamente igual. Lo que ya existe conserva su pictograma y su color.

## Parte 1: grupos como rectángulos (cambio del modelo)
Hoy un grupo es un rango de columnas fijo, de A a E (`Board.zones` y `zoneLabels`), y la zona de
carpetas se deduce por cercanía (`folderArea`).

**Nuevo modelo:**
```ts
interface Group {
  id: string
  name: string
  area: { r0: number; c0: number; r1: number; c1: number } // rectángulo, ambos extremos incluidos
  color?: Category      // tinte de las casillas vacías y categoría que recibe por defecto
  byRows?: boolean      // orden de llenado: por columnas (por defecto) o por filas
  folders?: boolean     // zona de carpetas: ahí se abren las carpetas
}
Board.groups?: Group[]  // sin solapes; puede haber fichas sueltas fuera de cualquier grupo
```

**Migración:** al cargar, sin pérdidas y con `record: false`.
- Cada zona de columnas actual pasa a ser un grupo de altura completa, con su nombre y su color.
- Cada bloque de carpetas pegadas se convierte en un grupo `folders`. Si una zona de columnas queda
  partida por el bloque de carpetas, se divide en rectángulos que no se solapen.

**Qué cambia en la app:**
- **Fichas nuevas:** `placeCell` las pone en el grupo de su categoría. Si no hay ninguno, en
  cualquier hueco.
- **Abrir una carpeta:** `folderArea` usa el grupo `folders` y deja de deducirlo por cercanía.
- **En edición:** cada grupo se ve con su borde, su color y su nombre, que se puede editar.
- **Color de las carpetas:** por defecto, una carpeta toma el color del grupo en el que está; por
  ejemplo, «más» en Pronombre sale del color de pronombre.
  - Solo cambia si se elige otro en el editor (`folderColor`) o en el texto (`[color: …]`).
  - Una carpeta fuera de grupo, o en un grupo sin color (como la zona de carpetas), sigue en marrón.
  - Si se mueve a otro grupo, toma el color del nuevo, salvo que tenga uno elegido.
  - En el desplegable «Color» del editor, la primera opción pasa a ser «Como su grupo (…)».
  - Importante para la migración: en tu tablero, carpetas que hoy son marrones cambiarán de color si
    están en un grupo con color.
- Esto vale para el principal y también para las carpetas.

## Parte 2: el formato (v1)
Una ficha por línea. Cada carpeta va donde está, dentro de su grupo, con su contenido debajo y con
sangría. Si algo no encaja, se da un error con el número de línea en vez de adivinar.

```
// Tablero escrito v1
# Inicio [7 filas, 11 columnas]

@ Pronombre [filas 1-7, columnas 1-1, color: pronombre]
yo
tú
él
ella
nosotros
esto
más
	vosotros
	ustedes
	ellos
	otros
		eles
		nos

@ Social [filas 2-5, columnas 4-5, color: social]
hola
adiós
_
gracias

@ Carpetas [filas 1-4, columnas 7-11, carpetas]
Comida
	agua
	leche
Animales [color: nombre]
	@ Salvajes [filas 1-3, columnas 7-10]
	lobo
	oso
	Granja
		vaca
		cerdo
Ropa [carpeta]

ayuda [fila 7, columna 11]
```

### Líneas
| Línea | Significado |
|---|---|
| `# Nombre [N filas, M columnas]` | El tablero principal y la cuadrícula común (la primera línea con contenido). |
| `@ Nombre [filas a-b, columnas c-d, …]` | Un grupo del tablero en el que está, que puede ser el principal o una carpeta. `fila 3` o `columna 5` valen para una sola. Se cuenta desde 1. Si el grupo ya existe, se puede omitir el rectángulo y se conserva el actual. |
| `texto` | Una ficha. |
| `texto` con líneas más metidas debajo | Una **carpeta**: las líneas de debajo son su contenido. |
| `texto [carpeta]` | Una carpeta vacía (sin líneas debajo). |
| `_` | Un hueco, para que lo siguiente no se desplace. |
| `- texto` / `* texto` | Igual que `texto`: se quita la viñeta. |
| `// …` y líneas vacías | Se ignoran. |

### Sangría (qué pertenece a qué)
- **Un nivel es un tabulador.** Es lo que escribe la app al exportar y lo que mete la tecla Tab en la
  página del texto.
- **También vale con espacios**, para cuando se pega texto de otro sitio: 4 u 8 espacios por nivel, o
  cualquier otra cantidad, siempre que sea la misma en todo el texto. Una línea más metida que la
  anterior abre un nivel.
- **No se pueden mezclar tabuladores y espacios** en el mismo texto. Si se mezclan, da error:
  «Línea 9: mezcla tabuladores y espacios; usa solo tabuladores».
- **Al volver hacia fuera,** la línea tiene que quedar exactamente al nivel de una línea anterior. Si
  queda entre dos niveles, da error: «Línea 14: la sangría no coincide con ningún nivel anterior».
- **Solo pueden ir más metidas las líneas debajo de una ficha,** que pasa a ser carpeta. Debajo de un
  `@ grupo` no se mete nada.
- **En la página del texto:**
  - Tab mete un nivel y Mayús+Tab lo saca, también con varias líneas seleccionadas.
  - Enter mantiene el nivel de la línea anterior.
  - Cada carpeta se puede plegar y desplegar.

### Posiciones
- **Dentro de un grupo:** el orden de las líneas es la posición. Se llena por columnas, de arriba
  abajo y luego la siguiente columna; con `por filas`, de izquierda a derecha. Los huecos se marcan
  con `_`.
- **Contenido de una carpeta sin grupos propios:** se llena en orden la zona donde se abre la
  carpeta.
  - Si se abre en la zona de carpetas del principal, esa zona.
  - Si no, el tablero entero, por columnas.
  - Así, una carpeta sencilla (como «más») no necesita ni grupos ni coordenadas.
- **Fichas sueltas** (fuera de cualquier grupo, después de una línea `@ -`):
  - Llevan su posición: `[fila 7, columna 11]`.
  - Si se escribe una sin posición, va al grupo de su categoría o al primer hueco libre.
- **Al exportar**, se escriben los rectángulos de los grupos, los `_` y las posiciones de las
  sueltas, para que ida y vuelta deje el tablero igual.

### Opciones `[…]`
Van al final de la línea, separadas por comas. No distinguen mayúsculas ni tildes.

| Opción | Dónde | Valor |
|---|---|---|
| `carpeta` | ficha | Carpeta vacía (sin líneas debajo). |
| `picto: <búsqueda o número>` | ficha | Pictograma de ARASAAC. Con una búsqueda, el primer resultado. |
| `solo texto` | ficha | Solo la palabra, sin pictograma. |
| `oculta` | ficha | Oculta, aunque conserva su sitio. |
| `frase` / `palabra` | ficha | Fuerza el tipo. Por defecto: 1–2 palabras, palabra; 3 o más, frase. |
| `categoría: <cat>` | ficha | `pronombre`, `persona`, `verbo`, `nombre`, `descriptivo`, `social`, `pregunta`, `negación` u `otros`. Si no se pone, se deduce. |
| `color: <cat>` | carpeta o grupo | Una de esas categorías, o `carpeta` para el marrón. En una carpeta, sin esta opción toma el color de su grupo. Al exportar solo se escribe si es distinto del color del grupo. |
| `fila N, columna M` | ficha suelta | Su casilla. |
| `filas a-b, columnas c-d` | grupo | Su rectángulo. Obligatorio en un grupo nuevo; en uno que ya existe, si se omite, se conserva. |
| `por filas` | grupo | Orden de llenado. |
| `carpetas` | grupo | Zona de carpetas (como mucho una por tablero). |

### Errores
Si hay alguno, no se aplica nada. Se muestran todos juntos, con la línea marcada, por ejemplo:
- Opción desconocida, con sugerencia: «Línea 12: "pictograma", ¿querías decir "picto"?».
- Un grupo que se sale de la cuadrícula, o que se solapa con otro: «Línea 20: Social (filas 2-5,
  columnas 4-5) se solapa con Personas».
- Más fichas que casillas: «Línea 31: Social tiene 8 casillas y hay 9 fichas».
- Una ficha suelta sin posición válida, o en una casilla ocupada.
- Una sangría que no coincide con ningún nivel, o una línea metida debajo de un `@ grupo`.
- Tabuladores y espacios mezclados en el mismo texto.
- Dos líneas `#`, o un grupo definido dos veces en el mismo tablero.

### No va en el texto
- La Charla rápida, que no aparece y no se toca.
- El formato de comas de «Crear tablero» sigue igual, para tableros nuevos.

## Cómo se aplica
1. **Exportar** (`boardToText`): escribe el principal y cada carpeta en su sitio, anidada, en el
   formato exacto, que se puede volver a leer.
2. **Leer** (`parseBoardText`): un lector estricto que devuelve `{ boards, errors[] }`, con el número
   de línea de cada error.
3. **Comparar** (`diffBoardText`): tablero a tablero.
   - Empareja las fichas por su texto normalizado dentro de cada tablero. Las carpetas se emparejan
     por su ruta, por ejemplo «más > otros».
   - El resultado separa: añadidas, quitadas, cambiadas (opciones), movidas, y grupos nuevos,
     cambiados o quitados.
4. **Vista previa:** un resumen por tablero, por ejemplo «Comida: +3 −1 · 2 se mueven».
   - Lo que se quita se ve en rojo y hay que confirmarlo.
   - Una carpeta que se quita avisa de cuántas fichas y subcarpetas se van con ella.
5. **Aplicar:** un solo `setLib`, que es un solo paso de deshacer y se sincroniza como siempre.
   - Lo que ya existía conserva su id, su pictograma y su color.
   - Las fichas nuevas buscan su pictograma por su texto, o el de `picto:`.

## Interfaz (solo web)
- En modo edición, un botón «📝 Texto» abre una página con el texto en un área grande, con los
  botones «Revisar cambios» y «Cerrar».
- Los errores salen en una lista junto al texto. Al pulsar uno, el cursor va a esa línea.
- «Revisar cambios» muestra la vista previa, con «Aplicar» y «Volver al texto».
- No aparece si el tablero está compartido como «solo usar».

## Orden de trabajo
1. **Grupos rectangulares:** modelo, migración, `placeCell`, `folderArea`, edición de grupos en web
   y tablet, y pruebas. Se puede publicar por separado.
2. **Lector y exportador del texto, con sus errores:** solo lógica, con pruebas de ida y vuelta.
3. **Comparar y aplicar**, con pruebas.
4. **Página «📝 Texto»** y vista previa en la web.

## Pruebas (vitest)
- **Migración:** las zonas de columnas y el bloque de carpetas se convierten en grupos sin solapes, y
  no se mueve ninguna ficha.
- **Ida y vuelta:** exportar y luego leer da cero cambios, con grupos, sueltas, huecos, subcarpetas y
  opciones.
- **Errores:** cada uno de los de la lista, con su número de línea.
- **Diferencias y aplicar:** añadir, quitar, mover, cambiar opciones, una carpeta nueva con
  subcarpeta, quitar una carpeta con todo su contenido, y cambiar el rectángulo de un grupo.

## Decisiones al implementar
- **Fichas repetidas en un mismo tablero** (p. ej. dos carpetas «Frutas»): se permiten. Se emparejan
  primero por texto y casilla; después, en orden.
- **Una carpeta de la zona de carpetas cuyo contenido no cabe en la zona:** se abre a pantalla
  completa, por páginas, como hasta ahora. No da error.
- **Los grupos «de siempre»** (columnas y bloque de carpetas) se deducen al exportar y quedan
  guardados al aplicar el texto por primera vez. Hasta entonces el tablero no cambia.
- **Plegar carpetas en el editor:** queda pendiente.

## Fuera de alcance (por ahora)
- Editarlo desde la tablet. La tablet sí verá y respetará los grupos.
- Grupos con forma no rectangular.
- Detectar que una ficha se ha renombrado: cuenta como quitar una y añadir otra.
