import type { MessageReply } from './chatTypes'

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
  options?: { expiresAt?: number; farewell?: boolean; whisperTo?: string | null; whisperToName?: string | null },
) => string | null

let sender: RoomSender | null = null

export function registerGameNoticeSender(next: RoomSender | null): void {
  sender = next
}

/** Returns the optimistic message id, or null when the room is unavailable. */
export function sendGameNotice(text: string, expiresAt: number): string | null {
  return sender?.(text, undefined, null, { expiresAt }) ?? null
}
