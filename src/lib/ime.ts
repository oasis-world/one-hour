import { useRef } from 'react'

/**
 * IME-safe Enter handling for text fields. With a candidate-window IME
 * (Chinese, Japanese, Korean, ...) active, Enter commits the composition
 * — it must never trigger the field's business logic (submit / save /
 * confirm). The check uses three signals at once:
 *  - `isComposing` on the native event (standard),
 *  - the legacy `keyCode === 229` (Chrome/Windows during composition),
 *  - a one-shot flag for Safari, where compositionend fires *before* the
 *    committing Enter keydown.
 *
 * The composing flag self-heals: some IMEs never fire compositionend (the
 * candidate is committed by a click, or focus moves away first). Left set,
 * it would silently eat every later Enter, so a stale composition expires.
 * `resetIme` should also be wired to the field's onBlur.
 *
 * Usage:
 *   const ime = useImeEnter()
 *   <input {...ime.imeProps} onBlur={ime.resetIme} onKeyDown={(e) => {
 *     if (ime.imeConsumesEnter(e)) return
 *     if (e.key !== 'Enter') return
 *     e.preventDefault()
 *     ...business logic...
 *   }} />
 */
export function useImeEnter() {
  const composingRef = useRef(false)
  const composingSinceRef = useRef(0)
  const justEndedRef = useRef(false)

  const resetIme = () => {
    composingRef.current = false
    composingSinceRef.current = 0
    justEndedRef.current = false
  }

  return {
    imeProps: {
      onCompositionStart: () => {
        composingRef.current = true
        composingSinceRef.current = Date.now()
        justEndedRef.current = false
      },
      onCompositionEnd: () => {
        composingRef.current = false
        // Safari's committing Enter lands in the next tick — consume it
        // exactly once, then let normal Enters through.
        justEndedRef.current = true
        window.setTimeout(() => { justEndedRef.current = false }, 0)
      },
    },
    resetIme,
    imeConsumesEnter: (e: {
      key: string
      keyCode?: number
      nativeEvent?: { isComposing?: boolean }
    }): boolean => {
      if (e.key !== 'Enter') return false
      if (e.nativeEvent?.isComposing === true || e.keyCode === 229) return true

      if (composingRef.current) {
        // Stale composition (lost compositionend) must never block Enter.
        if (Date.now() - composingSinceRef.current > 500) composingRef.current = false
        else return true
      }
      return justEndedRef.current
    },
  }
}
