import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { tapManager } from './lib/tap'
import './styles.css'

tapManager.attach()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
