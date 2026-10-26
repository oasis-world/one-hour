import CountdownProgressRing from './CountdownProgressRing'

/**
 * Selects the active countdown skin through the app-shell data attribute.
 * All variants share the same clock and remaining fraction; previews can
 * force a skin with `previewScheme` without changing the live selection.
 */
export default function CountdownVisual({
  remaining,
  size = 17,
  radius = 6.5,
  strokeWidth = 1.6,
  trackOpacity = 0.22,
  className = '',
  previewScheme,
}: {
  remaining: number
  size?: number
  radius?: number
  strokeWidth?: number
  trackOpacity?: number
  className?: string
  previewScheme?: string
}) {
  const fraction = Math.max(0, Math.min(1, remaining))
  const segmentCount = 7
  const elapsed = 1 - fraction
  const angle = elapsed * Math.PI * 2 - Math.PI / 2
  const orbitRadius = size * 0.32
  const orbitDot = {
    left: size / 2 + Math.cos(angle) * orbitRadius,
    top: size / 2 + Math.sin(angle) * orbitRadius,
  }
  const preview = previewScheme ? { 'data-countdown-preview': previewScheme } : {}

  return (
    <span
      className={`countdown-visual ${className}`.trim()}
      style={{ width: size, height: size }}
      aria-hidden="true"
      {...preview}
    >
      <CountdownProgressRing
        remaining={fraction}
        size={size}
        radius={radius}
        strokeWidth={strokeWidth}
        trackOpacity={trackOpacity}
        className="countdown-visual__ring"
      />
      <span className="countdown-visual__bar">
        <span className="countdown-visual__bar-fill" style={{ width: `${fraction * 100}%` }} />
      </span>
      <span className="countdown-visual__segments">
        {Array.from({ length: segmentCount }, (_, index) => {
          const level = Math.max(0, Math.min(1, fraction * segmentCount - index))
          return (
            <i
              key={index}
              style={{ opacity: 0.16 + level * 0.84, transform: `scaleY(${0.62 + level * 0.38})` }}
            />
          )
        })}
      </span>
      <span
        className="countdown-visual__pulse"
        style={{
          width: 4 + fraction * 6,
          height: 4 + fraction * 6,
          opacity: 0.38 + fraction * 0.62,
        }}
      />
      <span
        className="countdown-visual__halo"
        style={{
          backgroundImage: `conic-gradient(from ${elapsed * 360}deg, currentColor 0deg ${fraction * 360}deg, transparent ${fraction * 360}deg 360deg)`,
        }}
      />
      <span className="countdown-visual__orbit">
        <i className="countdown-visual__orbit-dot" style={orbitDot} />
      </span>
    </span>
  )
}
