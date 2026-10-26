/**
 * File-picker guard — opening the native picker (or camera) blurs the
 * window, and closing it refocuses. Without this flag the shell mistakes
 * that blur→focus for "the player went away" and replays the fold-away
 * choreography, unmounting the composer before the picker's `change`
 * event is delivered — the photo is then silently lost.
 */

let opened = false

export function markFilePickerOpened() {
  opened = true
}

/** True once after a picker was opened, then auto-clears. */
export function consumeFilePickerFlag(): boolean {
  const was = opened
  opened = false
  return was
}
