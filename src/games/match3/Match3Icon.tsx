export default function Match3Icon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="7" y="7" width="6" height="6" rx="2" fill="currentColor" opacity=".85" />
      <rect x="19" y="7" width="6" height="6" rx="2" fill="currentColor" opacity=".55" />
      <rect x="13" y="13" width="6" height="6" rx="2" fill="currentColor" opacity=".9" />
      <rect x="7" y="19" width="6" height="6" rx="2" fill="currentColor" opacity=".4" />
      <rect x="19" y="19" width="6" height="6" rx="2" fill="currentColor" opacity=".7" />
    </svg>
  )
}
