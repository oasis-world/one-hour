import { useEffect, type RefObject } from 'react'

/**
 * Mobile keyboard choreography:
 *  - While the keyboard is up, the fixed shell is lifted to the visual
 *    viewport (height + offset), so the composer rides above the keys.
 *    Android Chrome already resizes the layout via the
 *    `interactive-widget=resizes-content` meta; this covers iOS Safari
 *    and anything else that overlays instead. The shell also carries an
 *    `is-keyboard-open` class while up — the CSS drops the dock to the
 *    bottom edge and steps the gear aside.
 *  - Chat convention: a tap outside the composer or a scroll gesture
 *    dismisses the keyboard (blur). Touches inside the composer dock —
 *    the field, send, plus/emoji panels — never dismiss it.
 *  - iOS `gesturestart` is cancelled too: no page pinch-zoom (the
 *    viewer's own pinch runs on pointer events, unaffected).
 */

const KEYBOARD_MIN_PX = 80

function isCoarse(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function useMobileKeyboard(shellRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!isCoarse()) return
    const shell = shellRef.current
    const vv = window.visualViewport
    if (!shell || !vv) return

    const apply = () => {
      const keyboard = window.innerHeight - vv.height - vv.offsetTop
      const active = document.activeElement
      const fieldFocused =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      const keyboardOpen = keyboard > KEYBOARD_MIN_PX
      if (keyboardOpen || fieldFocused) {
        shell.classList.add('is-keyboard-open')
        if (keyboardOpen) {
          shell.style.height = `${vv.height}px`
          shell.style.transform = `translateY(${vv.offsetTop - 10}px)`
        } else {
          shell.style.height = ''
          shell.style.transform = ''
        }
      } else {
        shell.classList.remove('is-keyboard-open')
        shell.style.height = ''
        shell.style.transform = ''
      }
    }

    const blurField = () => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.blur()
    }
    const outsideComposer = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.composer-dock')) return false
      // Dialog inputs must not drop the keyboard when tapped.
      if (target?.closest?.('.account-dialog')) return false
      if (target?.closest?.('.welcome-card')) return false
      if (target?.closest?.('.welcome-backdrop')) return false
      return true
    }

    const onDown = (e: PointerEvent) => {
      if (outsideComposer(e)) blurField()
    }
    const onMove = (e: TouchEvent) => {
      if (outsideComposer(e)) blurField()
    }
    const onGesture = (e: Event) => e.preventDefault()

    // Mobile keyboards open asynchronously: the visualViewport may not
    // reflect the keyboard until well after `focusin` fires. Retry apply()
    // a few times so the shell lifts on the *first* focus, not only on a
    // later tap (which is what happened after clearing a field).
    const onFocusIn = () => {
      apply()
      window.setTimeout(apply, 50)
      window.setTimeout(apply, 150)
      window.setTimeout(apply, 350)
      window.setTimeout(apply, 700)
    }
    const onFocusOut = () => {
      window.setTimeout(apply, 50)
      window.setTimeout(apply, 200)
    }

    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('touchmove', onMove)
    document.addEventListener('gesturestart', onGesture)
    apply()

    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('gesturestart', onGesture)
      shell.classList.remove('is-keyboard-open')
      shell.style.height = ''
      shell.style.transform = ''
    }
  }, [shellRef])
}
