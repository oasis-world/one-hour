/**
 * Countdown animation library. Keep IDs stable: they are persisted in the
 * user's local settings and used by the app-shell data attribute.
 */
export const COUNTDOWN_ANIMATIONS = [
  {
    id: 'ring',
    zh: '经典圆环',
    en: 'Classic ring',
    detailZh: '从 12 点顺时针收束',
    detailEn: 'A clockwise sweep from twelve',
  },
  {
    id: 'line',
    zh: '轻盈进度线',
    en: 'Soft progress line',
    detailZh: '细线随剩余时间缓缓缩短',
    detailEn: 'A slim line gently recedes',
  },
  {
    id: 'segments',
    zh: '渐隐刻度',
    en: 'Fading segments',
    detailZh: '刻度从末端逐格淡去',
    detailEn: 'Small ticks fade away in sequence',
  },
  {
    id: 'pulse',
    zh: '呼吸光点',
    en: 'Breathing light',
    detailZh: '光点随时间渐小、渐淡',
    detailEn: 'A soft dot dims and contracts',
  },
  {
    id: 'halo',
    zh: '渐变光环',
    en: 'Gradient halo',
    detailZh: 'CSS 锥形渐变绘出柔和弧光',
    detailEn: 'A soft arc drawn with a conic gradient',
  },
  {
    id: 'orbit',
    zh: '轨道光点',
    en: 'Orbiting dot',
    detailZh: '光点沿轨道顺时针运行',
    detailEn: 'A marker travels clockwise around a track',
  },
] as const

export type CountdownAnimation = (typeof COUNTDOWN_ANIMATIONS)[number]['id']
export const DEFAULT_COUNTDOWN_ANIMATION: CountdownAnimation = 'ring'

export function isCountdownAnimation(value: string): value is CountdownAnimation {
  return COUNTDOWN_ANIMATIONS.some((animation) => animation.id === value)
}
