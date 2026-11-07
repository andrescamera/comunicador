import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La web no lleva número de versión: se identifica por el día de compilación y el commit publicado
function commit() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  if (sha) return sha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return 'sin commit'
  }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  define: { __APP_VERSION__: JSON.stringify(`${new Date().toISOString().slice(0, 10)} · ${commit()}`) },
})
