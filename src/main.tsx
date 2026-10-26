import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/chatMenu.css'
import './styles/accountPop.css'
import './styles/settingsBar.css'
import './styles/welcomeProfile.css'
import './styles/stylePicker.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The splash is retired by App once the first background photo is ready
// (or the 4s fallback fires), so it can cover the remote fetch. Leaving
// it here would blank the screen during loading.
