/** Hand-rolled SVG glyphs — no icon dependency, inherits currentColor. */

interface GlyphProps {
  size?: number
}

export function ThinXIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 3.5l9 9M12.5 3.5l-9 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PlusIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 4.5v11M4.5 10h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CameraIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 6.8c0-1 .8-1.8 1.8-1.8h1.5l1-1.6h4.4l1 1.6h1.5c1 0 1.8.8 1.8 1.8v7.4c0 1-.8 1.8-1.8 1.8H4.3c-1 0-1.8-.8-1.8-1.8V6.8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.4" r="3.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function UploadIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 13.5V4.2m0 0L6.4 7.8M10 4.2l3.6 3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 13.2v1.6c0 1 .8 1.7 1.7 1.7h9.6c1 0 1.7-.8 1.7-1.7v-1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function EmojiIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.4" cy="8.4" r="1.05" fill="currentColor" />
      <circle cx="12.6" cy="8.4" r="1.05" fill="currentColor" />
      <path
        d="M6.8 12.2c.8 1 1.9 1.5 3.2 1.5s2.4-.5 3.2-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function SendIcon({ size = 18 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 15.5V5m0 0L5.5 9.5M10 5l4.5 4.5"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PeopleIcon({ size = 15 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5.7" cy="5.4" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M1.6 13.2c.4-2.2 2.1-3.5 4.1-3.5s3.7 1.3 4.1 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10.8 3.4a2.3 2.3 0 010 4.4M12 9.9c1.3.3 2.2 1.4 2.4 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChatBubbleIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 4.2c0-1 .8-1.7 1.7-1.7h7.6c1 0 1.7.8 1.7 1.7v5.3c0 1-.8 1.7-1.7 1.7H7.9L4.6 14v-2.8h-.4c-1 0-1.7-.8-1.7-1.7V4.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Chevron for the mobile toolbar toggle (rotates via CSS when open). */
export function ChevronDownIcon({ size = 14 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6.2l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Default anonymous avatar: the oasis traveler silhouette. */
export function TravelerGlyph({ size = 20 }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5v1H4v-1z" />
    </svg>
  )
}

export function SunIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7M3.2 3.2l1.2 1.2M11.6 11.6l1.2 1.2M12.8 3.2l-1.2 1.2M4.4 11.6l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MoonIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M13.2 9.7A5.8 5.8 0 016.3 2.8a5.8 5.8 0 106.9 6.9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
