/**
 * Shared blank-click guard for dismissible popovers (avatar / gear /
 * message menus): they close on pointerdown, which lands before the
 * click that would otherwise fold the chat (or trigger anything else
 * under the cursor). A plain boolean races (the popover is already gone
 * by click time), so closers stamp a timestamp synchronously and the
 * click handler consults it.
 */

let openCount = 0
let closedAt = 0
let swallowClickUntil = 0

export function suppressNextClick() {
  swallowClickUntil = Date.now() + 700
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', (event) => {
    if (Date.now() > swallowClickUntil) return
    swallowClickUntil = 0
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

export function setPopoverOpen(open: boolean) {
  if (open) {
    if (openCount === 0) closedAt = 0
    openCount += 1
  } else if (openCount > 0) {
    openCount -= 1
    if (openCount === 0) closedAt = Date.now()
  }
}

/** True while a guarded popover is up, or just after one dismissed. */
export function popoverJustClosed(windowMs = 450): boolean {
  if (openCount > 0) return true
  return closedAt > 0 && Date.now() - closedAt < windowMs
}
