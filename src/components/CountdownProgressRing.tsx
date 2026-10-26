/** Shared single-colour countdown ring used in message rows and the backdrop. */
export default function CountdownProgressRing({
  remaining,
  size = 17,
  radius = 6.5,
  strokeWidth = 1.6,
  trackOpacity = 0.22,
  className = '',
}: {
  /** Remaining time as a fraction from 0 (expired) to 1 (just started). */
  remaining: number
  size?: number
  radius?: number
  strokeWidth?: number
  trackOpacity?: number
  className?: string
}) {
  const rest = Math.max(0, Math.min(1, remaining))
  const elapsed = 1 - rest
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  return (
    <svg
      className={`countdown-progress-ring ${className}`.trim()}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="countdown-progress-ring__track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        opacity={trackOpacity}
      />
      {rest > 0 && (
        <circle
          className="countdown-progress-ring__remaining"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${rest * circumference} ${circumference}`}
          transform={`rotate(${elapsed * 360 - 90} ${center} ${center})`}
          style={{ transition: 'stroke-dasharray 1s linear, transform 1s linear' }}
        />
      )}
    </svg>
  )
}
