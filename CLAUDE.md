# Comunicador

Web (Vite + React) en `src/`; app de la tablet (Expo / React Native) en `mobile/`, que comparte `src/lib`.
Reglas propias de la app nativa: `mobile/AGENTS.md`.

## Varias sesiones trabajan a la vez en esta carpeta

Suele haber varias sesiones de Claude en paralelo sobre esta misma copia del repositorio (misma rama, mismo
árbol de trabajo). Cualquier cambio sin commit que no hayas hecho tú es trabajo en curso de otra sesión.

- **Commits**: añade solo tus archivos, con rutas explícitas (`git add ruta1 ruta2`). Nunca `git add -A`,
  `git add .` ni `git commit -a`. Si un archivo tuyo también tiene cambios de otra sesión, añade solo tus
  trozos (`git add -p`). Antes de commitear, revisa `git diff --cached` para que no se cuele nada ajeno.
- **Deshacer**: nunca `git checkout -- <archivo>`, `git restore`, `git stash`, `git reset --hard`,
  `git clean` ni cambiar de rama: se llevan por delante los cambios de las otras sesiones. Para deshacer lo
  tuyo, edítalo a mano.
- **APK** (`mobile/scripts/build-apk.sh`): compila el árbol de trabajo tal cual, con el trabajo a medias de
  otras sesiones dentro. Antes de compilar, mira `git status`; si hay cambios sin commit que no son tuyos,
  avisa al usuario y no compiles sin su visto bueno.
- **Web**: cada push a `main` publica en Vercel lo que esté commiteado (no lo que haya sin commit).
