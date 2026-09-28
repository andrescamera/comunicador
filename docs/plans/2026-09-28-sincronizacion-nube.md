# Plan: sincronización en la nube (editar en el ordenador, usar en la tablet)

## Objetivo
El terapeuta edita los tableros en el ordenador (web) y los cambios aparecen solos en la tablet, y al revés.
Base para, más adelante, compartir tableros con familias.

## Decisiones propuestas

| Tema | Propuesta | Por qué |
|---|---|---|
| Servidor | **Supabase** (Postgres + autenticación + tiempo real), plan gratuito | Sin servidor propio que mantener; seguridad por filas (RLS); SDK para web y React Native |
| Ubicación de los datos | **Región UE (Frankfurt)** | RGPD: datos de pacientes (a menudo menores) dentro de la UE |
| Inicio de sesión | **Email + código de 6 cifras** (sin contraseña) | Funciona igual en ordenador y tablet, sin enlaces que abrir en otra app |
| Qué se guarda | Solo los tableros (celdas, pictogramas, posiciones) y el email | Minimización de datos. Nada de nombres de pacientes aparte de lo que el terapeuta escriba en las celdas |
| Web del terapeuta | La versión web actual (`src/`), actualizada con el mismo editor | Ya comparte formato y lógica con la app |

## Cómo funciona la sincronización
- **Primero local**: la tablet sigue funcionando sin conexión con su copia guardada. Nunca espera a la red para mostrar o hablar.
- **Subida**: tras un cambio, se sube a los ~2 s (agrupando cambios seguidos).
- **Bajada**: al abrir la app, al volver a ella y **en tiempo real** mientras está abierta (si editas en el ordenador, la tablet se actualiza en segundos).
- **Conflictos**: cada tablero lleva su fecha de modificación; si el mismo tablero se cambia en los dos sitios a la vez, gana el más reciente y el otro se guarda como copia de seguridad recuperable. Tableros distintos nunca se pisan.
- **Borrados**: se marcan (no desaparecen al instante) para que no "resuciten" desde otro dispositivo.

## Modelo de datos (Supabase)
- `libraries` — una por usuario: `id`, `owner_id`, `name`, `root_board_id`, `updated_at`.
- `boards` — un registro por tablero: `id`, `library_id`, `data` (JSON: nombre, filas, columnas, zonas, celdas), `updated_at`, `deleted`.
- `board_backups` — copias de las versiones sobrescritas en un conflicto (se guardan 30 días).
- **Reglas de seguridad (RLS)**: cada usuario solo puede leer y escribir sus propias bibliotecas.
  Preparado para añadir después `library_members` (terapeuta / familia, con permisos de editar o solo usar).

## Fases
1. **Cuentas y sincronización** (esta tarea): inicio de sesión en web y tablet, subida/bajada, tiempo real, conflictos, copias.
   Al iniciar sesión por primera vez, los tableros que ya tienes en la tablet se suben a tu cuenta.
2. **Web del terapeuta al día**: mismo editor que la tablet (cuadrícula a pantalla completa, crear tablero, nombres de grupos…).
   Publicación en una dirección fija (por ejemplo Vercel) para usarla desde cualquier ordenador.
3. **Compartir con familias** (más adelante): invitar por email con permisos (editar / solo usar).

## RGPD (mínimos para esta fase)
- Datos en la UE; conexión cifrada; cada usuario solo ve lo suyo.
- Opción de **borrar la cuenta y todos sus datos** desde Ajustes.
- Texto breve de privacidad al iniciar sesión (qué se guarda y para qué).
- Pendiente para cuando haya familias: base legal y consentimiento del tutor, contrato de encargado de tratamiento con Supabase.

## Lo que necesito de ti
1. Crear un proyecto gratuito en **supabase.com** (región **Central EU (Frankfurt)**). Crear la cuenta te corresponde a ti.
2. Pasarme la **Project URL** y la clave **anon public** (están en Project Settings → API). La clave anon es pública por diseño: la protección la dan las reglas de seguridad.
3. Decidir dónde publicar la web (fase 2): Vercel (como la web de AES-ZTTK) o solo en tu Mac por ahora.

## Pruebas
- Tests de la lógica de fusión (conflictos, borrados, tableros nuevos en ambos lados).
- Prueba real: editar en la web → comprobar en el emulador que cambia en segundos; editar sin conexión en el emulador → reconectar → aparece en la web.
