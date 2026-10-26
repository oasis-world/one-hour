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
      if (keyboard > KEYBOARD_MIN_PX) {
        shell.classList.add('is-keyboard-open')
        shell.style.height = `${vv.height}px`
        shell.style.transform = `translateY(${vv.offsetTop}px)`
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
    const outsideComposer = (e: Event) =>
      (e.target as HTMLElement | null)?.closest?.('.composer-dock') == null

    const onDown = (e: PointerEvent) => {
      if (outsideComposer(e)) blurField()
    }
    const onMove = (e: TouchEvent) => {
      if (outsideComposer(e)) blurField()
    }
    const onGesture = (e: Event) => e.preventDefault()

    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('touchmove', onMove)
    document.addEventListener('gesturestart', onGesture)
    apply()

    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('gesturestart', onGesture)
      shell.classList.remove('is-keyboard-open')
      shell.style.height = ''
      shell.style.transform = ''
    }
  }, [shellRef])
}
