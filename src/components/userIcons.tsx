/**
 * User-chrome glyphs (avatar menu / settings bar / profile page) — kept
 * apart from icons.tsx so that file stays untouched; same hand-rolled SVG
 * language: currentColor strokes, no icon dependency.
 */

interface GlyphProps {
  size?: number
}

/** Four rounded tiles — the style-catalog (custom avatar) entry. */
export function GridIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="5.2" height="5.2" rx="1.8" />
      <rect x="8.8" y="2" width="5.2" height="5.2" rx="1.8" opacity="0.55" />
      <rect x="2" y="8.8" width="5.2" height="5.2" rx="1.8" opacity="0.55" />
      <rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1.8" />
    </svg>
  )
}

/** Photo-frame glyph — the "from library" picker entry. */
export function PhotoIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2.4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="5.7" cy="6.4" r="1.1" fill="currentColor" />
      <path
        d="M2.6 11.6l3-3.1c.4-.4 1-.4 1.4 0l3.4 3.5M9.3 10.2l1.5-1.5c.4-.4 1-.4 1.4 0l1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Circular arrows — reroll the random avatar + nickname. */
export function RefreshIcon({ size = 16 }: GlyphProps) {
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
        d="M13.4 8a5.4 5.4 0 01-9.6 3.35M2.6 8a5.4 5.4 0 019.6-3.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.6 1.9v2.9H9.7M3.4 14.1v-2.9h2.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Settings gear — Feather's `settings` icon (MIT, by Cole Bemis),
 * copied verbatim: 24-grid, classic cog with a center hole. It stays
 * legible at 15px where hand-rolled 16-grid cogs turn blobby.
 */
export function GearIcon({ size = 16 }: GlyphProps) {
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
      focusable="false"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83a2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2a2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0a2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2a2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83a2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2a2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0a2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2a2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/** Door + arrow — sign out. */
export function SignOutIcon({ size = 16 }: GlyphProps) {
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
        d="M6.5 2.4h-3a1 1 0 00-1 1v9.2a1 1 0 001 1h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.6 4.6L13 8l-3.4 3.4M12.6 8H6.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Person silhouette — the profile entry. */
export function UserIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="5.2" r="2.7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.8 13.6c.6-2.5 2.7-4 5.2-4s4.6 1.5 5.2 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Globe — the language row. */
export function GlobeIcon({ size = 16 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M1.8 8h12.4M8 1.8c-1.7 1.7-2.6 3.8-2.6 6.2s.9 4.5 2.6 6.2c1.7-1.7 2.6-3.8 2.6-6.2S9.7 3.5 8 1.8z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}
