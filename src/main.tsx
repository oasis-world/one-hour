import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/chatMenu.css'
import './styles/accountPop.css'
import './styles/settingsBar.css'
import './styles/countdownAnimations.css'
import './styles/countdownPicker.css'
import './styles/welcomeProfile.css'
import './styles/stylePicker.css'
import App from './App.tsx'

// Touch fallback: some embedded webviews (notably WeChat's) misreport the
// hover/pointer media features, leaving sticky :hover backgrounds on list
// rows while scrolling. The .is-touch hook drives the same
// no-hover-background overrides in CSS.
if (
  typeof window !== 'undefined' &&
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
) {
  document.documentElement.classList.add('is-touch')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The splash is retired by App once the first background photo is ready
// (or the 4s fallback fires), so it can cover the remote fetch. Leaving
// it here would blank the screen during loading.
