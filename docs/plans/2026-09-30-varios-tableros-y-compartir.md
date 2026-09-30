# Plan: varios tableros por usuario y compartir por email

## Objetivo
- Un usuario puede tener **varios tableros** (p. ej. uno por niño, o uno para casa y otro para el cole).
- Una vista **«Tableros»** lista los suyos y los que le han compartido; al empezar solo está el de ejemplo.
- **Compartir** un tablero con otra persona escribiendo su email.

## Decisiones (confirmadas)
- Se comparte **el mismo tablero** (no una copia): los cambios llegan a todos en segundos.
- Permisos: **puede editar** o **solo usar**.
- Email sin cuenta: **invitación pendiente**, que aparece al crear la cuenta con ese email.

## Qué es un «tablero» aquí
Lo que hoy es toda la biblioteca: el tablero principal **con sus carpetas**. Compartir un tablero comparte
también sus carpetas. (En el código sigue llamándose `Library`; en pantalla, «tablero».)

## Pantallas
- **Tableros** (nuevo botón arriba, junto a Inicio): tarjetas con nombre, miniatura, «tuyo» / «compartido por X».
  Acciones: Abrir, Nuevo (vacío, ejemplo, desde texto o foto), Duplicar, Renombrar, Compartir, Borrar / Dejar de ver.
- **Compartir**: email + permiso (puede editar / solo usar). Lista de personas con acceso y botón para quitarlas.
- **Tablet**: abre el último tablero usado; desde «Tableros» se elige otro. Cada dispositivo recuerda el suyo.

## Datos (Supabase)
- `libraries`: se quita «una por usuario»; se añade `name` visible y `updated_at`.
- `library_members` (library_id, user_id, role `editor` | `viewer`): quién más tiene acceso.
- `library_invites` (library_id, email, role): invitaciones a emails que aún no tienen cuenta; se convierten en
  acceso al crear la cuenta o entrar (función `claim_invites`).
- Función `share_library(library_id, email, role)` (solo la puede usar el dueño): si el email tiene cuenta,
  da acceso directo; si no, deja la invitación pendiente. **No revela** si un email tiene cuenta o no.
- Reglas de seguridad (RLS): el dueño lo puede todo; `editor` lee y escribe tableros/carpetas;
  `viewer` solo lee. Nadie ve bibliotecas en las que no está.
- Sin SMTP propio no se envían emails: la persona ve el tablero compartido al entrar en la app.

## Sincronización
- El motor actual sincroniza **una** biblioteca: se mantiene así, pero ahora es **la que está abierta**;
  cambiar de tablero = parar el motor, cargar la copia local de ese tablero y arrancarlo con su id.
- La lista de «Tableros» se pide al servidor (solo nombres y fechas, sin descargar todo).
- En el dispositivo se guardan en local los tableros abiertos alguna vez (funciona sin conexión).
- Tiempo real también en tableros compartidos: si el terapeuta edita, la familia lo ve en segundos.
- Conflictos: igual que ahora (gana el más reciente y el otro queda en copia de seguridad).

## Migración de lo que ya existe
- La biblioteca actual de cada cuenta pasa a ser su primer tablero, con el nombre del tablero principal.
- Nada se borra.

## Fases (cada una se puede probar por separado)
1. Varios tableros (sin compartir): base de datos, vista Tableros en web y tablet, cambiar de tablero, nuevo/borrar/renombrar.
2. Compartir: tablas, funciones, reglas de seguridad, pantalla Compartir, tableros compartidos en la lista.
3. Pruebas: tests de reglas de seguridad (un usuario no ve lo de otro; viewer no puede escribir),
   prueba con dos cuentas de prueba (web + emulador).

## Pruebas con dos cuentas
Hace falta una **segunda cuenta de prueba** para comprobar el compartir. La creas tú (no creo cuentas ni
pongo contraseñas); las pruebas no tocan los tableros de tu cuenta real salvo lo que tú compartas.
