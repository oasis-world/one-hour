/** Logo for the "同频 / In Sync" game: two people joined by a resonance wave. */
export default function ResonanceIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="resLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9dcff" />
          <stop offset="55%" stopColor="#b69cff" />
          <stop offset="100%" stopColor="#7a67ff" />
        </linearGradient>
        <radialGradient id="resLogoGlow">
          <stop offset="0%" stopColor="#b69cff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#b69cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#resLogoGlow)" />
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="#b69cff" strokeOpacity="0.3" strokeWidth="1" />
      <path d="M13 13 A 11 11 0 0 1 13 27" fill="none" stroke="#c9b6ff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M27 13 A 11 11 0 0 0 27 27" fill="none" stroke="#c9b6ff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 20 q2.5 -7 5 0 t5 0 t5 0 t5 0" fill="none" stroke="url(#resLogoGrad)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="8" cy="20" r="4.2" fill="url(#resLogoGrad)" stroke="#fff" strokeOpacity="0.85" strokeWidth="1" />
      <circle cx="32" cy="20" r="4.2" fill="url(#resLogoGrad)" stroke="#fff" strokeOpacity="0.85" strokeWidth="1" />
      <circle cx="20" cy="6.5" r="1.4" fill="#ffd27a" />
      <circle cx="20" cy="33.5" r="1" fill="#ffd27a" opacity="0.7" />
    </svg>
  )
}
