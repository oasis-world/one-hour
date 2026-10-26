/**
 * 5-pointed star outline, as an SVG `points` attribute. Shared by the
 * China and United States flags; `rotDeg` turns the star so the small
 * Chinese stars can aim a point at the large one.
 */
export function starPoints(cx: number, cy: number, r: number, rotDeg = 0): string {
  const pts: string[] = []
  const rot = (rotDeg * Math.PI) / 180
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.38
    const angle = (Math.PI / 5) * i + rot
    pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`)
  }
  return pts.join(' ')
}
