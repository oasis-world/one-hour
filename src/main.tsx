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

/**
 * Retire the inline splash (index.html) once the shell has painted:
 * fade it out, then drop it from the DOM. A ~350ms minimum display
 * keeps fast repeat loads from reading as a flicker.
 */
const splash = document.getElementById('splash')
if (splash) {
  const retire = () => {
    splash.classList.add('is-done')
    window.setTimeout(() => splash.remove(), 450)
  }
  const elapsed = performance.now()
  const delay = Math.max(0, 350 - elapsed)
  // Double rAF: the app's first commit is on screen before the fade starts.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (delay > 0) window.setTimeout(retire, delay)
      else retire()
    }),
  )
}
