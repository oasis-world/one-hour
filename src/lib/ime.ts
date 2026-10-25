import { useRef } from 'react'

/**
 * IME-safe Enter handling for text fields. With a candidate-window IME
 * (Chinese, Japanese, Korean, ...) active, Enter commits the composition
 * — it must never trigger the field's business logic (submit / save /
 * confirm). The check needs three signals at once:
 *  - `isComposing` on the native event (standard),
 *  - the legacy `keyCode === 229` (Chrome/Windows during composition),
 *  - a composition ref held one tick past compositionend — Safari fires
 *    compositionend *before* the committing Enter keydown, so a plain
 *    isComposing check misses that browser.
 *
 * Usage:
 *   const ime = useImeEnter()
 *   <input {...ime.imeProps} onKeyDown={(e) => {
 *     if (ime.imeConsumesEnter(e)) return
 *     if (e.key !== 'Enter') return
 *     e.preventDefault()
 *     ...business logic...
 *   }} />
 */
export function useImeEnter() {
  const composingRef = useRef(false)
  return {
    imeProps: {
      onCompositionStart: () => {
        composingRef.current = true
      },
      onCompositionEnd: () => {
        // One tick: Safari's committing Enter keydown lands right after.
        window.setTimeout(() => {
          composingRef.current = false
        }, 0)
      },
    },
    imeConsumesEnter: (e: {
      key: string
      keyCode?: number
      nativeEvent?: { isComposing?: boolean }
    }): boolean => {
      if (e.key !== 'Enter') return false
      return (
        composingRef.current || e.nativeEvent?.isComposing === true || e.keyCode === 229
      )
    },
  }
}
