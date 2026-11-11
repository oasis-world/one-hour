export default function SudokuIcon({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <rect x="4" y="4" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 5v22M20 5v22M5 12h22M5 20h22" stroke="currentColor" strokeWidth="1" opacity=".48" />
    <g fill="currentColor" fontFamily="system-ui,sans-serif" fontSize="7" fontWeight="750" textAnchor="middle">
      <text x="8" y="10.5">5</text>
      <text x="24" y="10.5">3</text>
      <text x="8" y="26.5">9</text>
      <text x="24" y="26.5">1</text>
      <text x="16" y="18.5" fontSize="8">7</text>
    </g>
  </svg>
}
