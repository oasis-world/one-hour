export default function SolitaireIcon({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x="8" y="4" width="23" height="31" rx="5" transform="rotate(7 8 4)" fill="#f7f1df" stroke="currentColor" strokeWidth="1.5" />
    <rect x="8" y="4" width="23" height="31" rx="5" fill="#fffaf0" stroke="currentColor" strokeWidth="1.5" />
    <path d="M19.5 12.5c-3.4-4-8.4 1.4 0 8 8.4-6.6 3.4-12 0-8Z" fill="#c94b51" />
    <path d="M13 26h13M13 29h8" stroke="#294d45" strokeWidth="1.7" strokeLinecap="round" />
    <path d="m29 8 2 2 3-3" stroke="#d9b864" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
