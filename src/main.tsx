import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { QuestionnairePage } from './components/Questionnaire'
import { tokenFromPath } from './lib/questionnaires'
import { tapManager } from './lib/tap'
import '@fontsource-variable/lexend'
import './styles.css'

// /cuestionario/<token>: el cuestionario de vocabulario para el tutor, sin cuenta y sin los tableros
const questionnaireToken = tokenFromPath(window.location.pathname)
if (!questionnaireToken) tapManager.attach()

createRoot(document.getElementById('root')!).render(
  <StrictMode>{questionnaireToken ? <QuestionnairePage token={questionnaireToken} /> : <App />}</StrictMode>,
)
