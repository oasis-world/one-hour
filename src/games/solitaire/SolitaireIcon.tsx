export default function SolitaireIcon({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x="7" y="3" width="26" height="34" rx="5" fill="#fffaf0" stroke="currentColor" strokeWidth="1.5" />
    <text x="11" y="14" fill="#17231f" fontFamily="Georgia,serif" fontSize="10" fontWeight="700">A</text>
    <text x="20" y="28" fill="#17231f" fontFamily="Georgia,serif" fontSize="21" textAnchor="middle">♠</text>
    <g transform="rotate(180 28 31)">
      <text x="28" y="34" fill="#17231f" fontFamily="Georgia,serif" fontSize="7" fontWeight="700" textAnchor="middle">A</text>
      <text x="28" y="29" fill="#17231f" fontFamily="Georgia,serif" fontSize="6" textAnchor="middle">♠</text>
    </g>
  </svg>
}
