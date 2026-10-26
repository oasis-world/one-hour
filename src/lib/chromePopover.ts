/**
 * Chrome popover guard — the avatar / gear popovers close on pointerdown,
 * which lands before the chat-stage click that would fold the chat. A plain
 * boolean races (the popover is already gone by click time), so closers
 * stamp a timestamp synchronously and the stage click consults it.
 */

let openCount = 0
let closedAt = 0

export function setChromePopoverOpen(open: boolean) {
  if (open) {
    if (openCount === 0) closedAt = 0
    openCount += 1
  } else if (openCount > 0) {
    openCount -= 1
    if (openCount === 0) closedAt = Date.now()
  }
}

/** True while a chrome popover is up, or just after one dismissed. */
export function chromePopoverJustClosed(windowMs = 450): boolean {
  if (openCount > 0) return true
  return closedAt > 0 && Date.now() - closedAt < windowMs
}
