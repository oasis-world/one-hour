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

export function ReplyIcon({ size = 18 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 5 3.5 9 8 13V10.5c4.2 0 6.5 1.5 8.5 4.5-.5-5-3-7.5-8.5-7.5V5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

/** Camera glyph, iOS language: soft body + viewfinder hump + twin lens. */
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
      <rect x="2.8" y="5.2" width="14.4" height="10.8" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.3 5.2l1-1.5c.2-.3.5-.5.9-.5h1.6c.4 0 .7.2.9.5l1 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.6" r="2.9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10.6" r="0.85" fill="currentColor" />
      <circle cx="14.35" cy="8" r="0.72" fill="currentColor" opacity="0.9" />
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

/** Briefcase glyph for an occupation, role, or persona field. */
export function BriefcaseIcon({ size = 16 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <rect x="1.8" y="5" width="12.4" height="8.8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 5V3.8c0-.8.6-1.4 1.4-1.4h2.2c.8 0 1.4.6 1.4 1.4V5M2 8.2c3.8 2.1 8.2 2.1 12 0M8 8.7v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

/** Logo mark — orange-red tile with a white Roman numeral I. */
export function HourglassIcon({ size = 13 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="14" height="14" rx="3" fill="#e85d3a" />
      <rect x="4" y="3" width="6" height="2" rx="0.5" fill="#ffffff" />
      <rect x="6" y="3" width="2" height="8" fill="#ffffff" />
      <rect x="4" y="9" width="6" height="2" rx="0.5" fill="#ffffff" />
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

/** Copy glyph: front sheet over a back plate (menu "copy" action). */
/** Edit glyph: pencil (menu "Edit Message"). */
export function EditIcon({ size = 20 }: GlyphProps) {
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
        d="M3.5 14.5l1.2-4.2L13.4 1.6a1.4 1.4 0 012 0l1 1a1.4 1.4 0 010 2L7.7 13.3 3.5 14.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.8 3.2l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CopyIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12.8 4.6v-.2A1.4 1.4 0 0011.4 3H4.4A1.4 1.4 0 003 4.4v7c0 .77.63 1.4 1.4 1.4h.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Trash glyph for the delete action. */
export function TrashIcon({ size = 20 }: GlyphProps) {
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
        d="M3.5 5.5h13M8.2 5V3.8c0-.44.36-.8.8-.8h2c.44 0 .8.36.8.8V5M5.2 5.5l.6 9.8c.05.86.76 1.53 1.62 1.53h5.16c.86 0 1.57-.67 1.62-1.53l.6-9.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 8.9v4.4M11.7 8.9v4.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Add-reaction glyph: smiley with a fresh plus (menu "Add Reaction"). */
export function ReactIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.3" cy="9.1" r="0.85" fill="currentColor" />
      <circle cx="11.7" cy="9.1" r="0.85" fill="currentColor" />
      <path
        d="M6.6 12.7c.7.9 1.7 1.4 2.9 1.4s2.2-.5 2.9-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16.6 2.9v4M14.6 4.9h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function GameIcon({ size = 17 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.3 7h9.4a4.4 4.4 0 0 1 4.3 5.2l-.6 2.8a2.7 2.7 0 0 1-4.5 1.4l-1.7-1.6h-4.4l-1.7 1.6a2.7 2.7 0 0 1-4.5-1.4L3 12.2A4.4 4.4 0 0 1 7.3 7z" />
      <path d="M7 9.8v4M5 11.8h4" />
      <circle cx="15.7" cy="10.7" r=".8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12.7" r=".8" fill="currentColor" stroke="none" />
      <path d="m18.2 4 .5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z" strokeWidth="1.2" />
    </svg>
  )
}

export function ChevronRightIcon({ size = 16 }: GlyphProps) {
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
        d="M7.5 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Discord-style three-dot "more" glyph. */
export function MoreIcon({ size = 20 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
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
