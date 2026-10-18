# Fichas «más»: ampliar un grupo sin salir del tablero

## Idea
Hoy un «más ▸» es una carpeta normal: al pulsarlo se abre a pantalla completa y desaparece el
tablero principal. Lo que queremos es lo que hace Verbo:
- Al pulsar el «más» de un grupo, sus fichas aparecen en una zona del tablero (la **zona de
  ampliación**).
- Todo lo demás sigue visible y en su sitio: los pronombres, los verbos de siempre, la barra de la
  frase…
- Así se puede seguir formando la frase sin perder el núcleo.

En las capturas, el «más» de Social llena la parte derecha de palabras rosas (antes, ya, luego…), y
el de Verbos, de verbos (tener, hay, pintar…). Las columnas 1-5 no cambian.

## Términos
- **Ficha «más» (ampliación):** una carpeta dentro de un grupo de color, como el «más ▸» de
  Verbos, Social, Descriptivos o Personas. Su contenido amplía ese grupo.
- **Carpeta normal:** una carpeta de la zona de carpetas (animales, comida…). Ya se abre dentro de
  esa zona.
- **Zona de ampliación:** el rectángulo del tablero donde aparece el contenido de un «más».

## Decisiones
- **D1 · La zona de ampliación es propia:** un grupo con la opción `[ampliación]`, por ejemplo
  `@ Ampliación [filas 1-7, columnas 6-11, ampliación]`.
  - No tiene fichas propias y es el único grupo que puede **solaparse** con otros, porque mientras
    está abierto tapa lo que hay debajo (carpetas, palabras pequeñas…).
  - Como mucho hay una, y solo en el tablero principal.
  - Si no hay ninguna, se usa la zona de carpetas; si tampoco hay zona de carpetas, el «más» se abre
    a pantalla completa, como hoy.
- **D2 · No se cierra sola:** queda abierta hasta pulsar el mismo «más», «Volver» o «🏠». El ajuste
  «Volver al inicio tras elegir» no la cierra.
- **D3 · Una sola cosa abierta a la vez:** abrir una carpeta normal cierra la ampliación, y abrir un
  «más» cierra la carpeta normal.
- **D4 · Modo predictivo:** solo atenúa las fichas; no abre un «más» solo. Se puede añadir después.

## Comportamiento
### Qué es un «más»
- Cualquier carpeta del tablero principal que esté dentro de un grupo de color, es decir, fuera de
  la zona de carpetas. No hace falta marcarla.
- Las carpetas de la zona de carpetas siguen igual: se abren en su zona.

### Abrir y cerrar
- Al pulsar un «más», su contenido aparece en la zona de ampliación, en orden y con huecos si los
  tiene. El resto del tablero no se mueve.
- Si no cabe, va por páginas con «◂» y «más ▸» en las últimas casillas de la zona.
- El «más» abierto se resalta (borde grueso), para saber qué grupo se está ampliando.
- Para cerrar: el mismo «más» otra vez, «Volver» (si hay una subcarpeta abierta, sube un nivel) o
  «🏠».
- Pulsar otro «más» cambia la ampliación a ese grupo directamente.
- Las fichas de la ampliación tienen el color de su categoría.

### Subcarpetas
- Un «más» dentro de otro «más», como «otros» dentro del de Personas, se abre en la misma zona.

### Edición
- Al editar un «más», su contenido se ve en la zona de ampliación, con el resto del tablero
  alrededor. Solo se pueden colocar fichas dentro de la zona; las casillas de fuera salen apagadas,
  como ahora con las carpetas de la zona de carpetas.
- La zona de ampliación se dibuja con un borde discontinuo y su nombre.

### Lo que ya hay en tu tablero
- Hoy tus «más» tienen sus fichas repartidas por la pantalla completa. Al abrirse en la zona,
  pasarán a verse en orden dentro de ella, por columnas, como ya pasó con las carpetas.
- Mientras no definas la zona de ampliación, usarán la zona de carpetas (4×4).
- Para que se parezca a tus capturas, se añade una línea en «📝 Texto»:
  `@ Ampliación [filas 1-7, columnas 6-11, ampliación]`.

### Tablero escrito
- Sin cambios de formato para los «más»: una línea con su contenido debajo, con sangría.
- Nueva opción de grupo: `[ampliación]`. Un grupo así no lleva fichas debajo; si las lleva, da error.
- El contenido de un «más» se llena en orden en la zona de ampliación; si no cabe, por páginas.
- El mapa resalta la zona de ampliación al editar el contenido de un «más».

### Tablet
- El mismo comportamiento que en la web, ya que la lógica es compartida.

## Lo que cambia en el código (cuando esté decidido)
- `folderArea` / `inlineFolder`: una carpeta de un grupo de color se abre en la zona de ampliación.
  Hoy solo se abren dentro las de la zona de carpetas.
- Cada «más» guarda su grupo de origen, para resaltarlo y para su color.
- `Group.expansion?: boolean` y la opción `[ampliación]` en el texto (puede solaparse, no lleva fichas).
- Normalizar: el contenido de los «más» se coloca dentro de la zona de ampliación, como hoy
  `anchorFolder` con las carpetas.
- Pruebas: abrir y cerrar, cambiar de «más», páginas, subcarpetas, edición dentro de la zona y
  texto de ida y vuelta.
