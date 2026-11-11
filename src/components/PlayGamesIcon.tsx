export default function PlayGamesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 8h8a4 4 0 0 1 3.9 3.1l.8 3.2a2.2 2.2 0 0 1-3.6 2.2L14.6 14h-5.2l-2.5 2.5a2.2 2.2 0 0 1-3.6-2.2l.8-3.2A4 4 0 0 1 8 8Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M7.4 10.3v4M5.4 12.3h4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="15.5" cy="11.3" r=".85" fill="currentColor" />
      <circle cx="17.7" cy="13.2" r=".85" fill="currentColor" />
      <path d="m18.3 3.2.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" fill="currentColor" />
    </svg>
  )
}
