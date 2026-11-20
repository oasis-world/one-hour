import type { ChatAuthorOverride, MessageReply } from './chatTypes'

/**
 * Tiny bridge so self-contained game components can post a notice to the
 * public room without threading the chat room's `send` through every layer.
 * App registers its room sender on mount; unregisters on teardown.
 *
 * The notice is authored by whoever calls it. The slot jackpot deliberately
 * lets only the card's host call it, so the message appears under the card
 * sender's identity (chat rows always bind user_id to the caller's JWT).
 */
type RoomSender = (
  text: string,
  imageBlob?: Blob,
  replyTo?: MessageReply | null,
  options?: { expiresAt?: number; farewell?: boolean; whisperTo?: string | null; whisperToName?: string | null; authorOverride?: ChatAuthorOverride },
) => string | null

let sender: RoomSender | null = null

export function registerGameNoticeSender(next: RoomSender | null): void {
  sender = next
}

/** Returns the optimistic message id, or null when the room is unavailable. */
export function sendGameNotice(text: string, expiresAt: number, authorOverride?: ChatAuthorOverride): string | null {
  return sender?.(text, undefined, null, { expiresAt, authorOverride }) ?? null
}

/** Post a private whisper to one user, presented under the given author persona. */
export function sendGameWhisper(
  text: string,
  expiresAt: number,
  whisperTo: string,
  whisperToName: string,
  authorOverride?: ChatAuthorOverride,
): string | null {
  return sender?.(text, undefined, null, { expiresAt, whisperTo, whisperToName, authorOverride }) ?? null
}
