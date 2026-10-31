/** Shared chat domain types (kept free of any vendor SDK import). */

export interface ChatMessage {
  id: string
  userId: string
  displayName: string
  /** DiceBear look captured at send time, so rows stay self-contained. */
  avatarStyle?: string | null
  avatarSeed?: string | null
  /** Custom photo avatar URL captured at send time; wins over the look. */
  avatarUrl?: string | null
  content: string
  /** Snapshot of the message this one replies to, retained with this message. */
  replyTo?: MessageReply | null
  /** epoch ms (client send time, or server created_at once confirmed). */
  at: number
  /** Exact database timestamp for gap-free pagination + expiry anchor. */
  serverCreatedAt?: string
  /** Optional per-message expiry (epoch ms); defaults to created_at + 1h. */
  expiresAt?: number
  /** Farewell message (special background). */
  farewell?: boolean
  /** Public storage URL of the attached image, if any. */
  imageUrl?: string | null
  /** Set when the message text was edited after sending. */
  editedAt?: string | null
}

export interface MessageReply {
  id: string
  userId?: string
  displayName: string
  content: string
  hasImage: boolean
}

export type ChatSendState = 'pending' | 'failed'

export interface ChatEntry extends ChatMessage {
  state?: ChatSendState
  /** Object-URL preview while the image upload is still in flight. */
  localImage?: string
  /** Set the moment the hour runs out — drives the dissolve animation. */
  expiring?: boolean
}

export interface PresenceMember {
  userId: string
  displayName: string
  /** DiceBear look, when the member has picked one (welcome / profile). */
  avatarStyle: string | null
  avatarSeed: string | null
  /** Custom photo avatar URL; wins over the generated look. */
  avatarUrl: string | null
  role?: string
  profileExpiresAt?: number | null
  /** epoch ms — when this member entered the room (last track). */
  enteredAt: number
}

export type ChatStatus = 'connecting' | 'online' | 'offline'
