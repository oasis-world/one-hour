import { matchText as m } from './matchText'
import type { ImageDisplayMode } from './useImageDisplayMode'

export type Match3Mode = 'male' | 'female' | 'mixed'
export type BoardSize = 6 | 7 | 8 | 9

const DIFFICULTIES = [
  { size: 6, label: ['轻松', 'Easy'] },
  { size: 7, label: ['标准', 'Normal'] },
  { size: 8, label: ['挑战', 'Hard'] },
  { size: 9, label: ['专家', 'Expert'] },
] as const

function DifficultyIcon({ level }: { level: number }) {
  const layouts = [
    [{ x: 16, y: 16, r: 9 }],
    [{ x: 10, y: 16, r: 6.5 }, { x: 22, y: 16, r: 6.5 }],
    [{ x: 16, y: 8, r: 5.5 }, { x: 8, y: 22, r: 5.5 }, { x: 24, y: 22, r: 5.5 }],
    [{ x: 9, y: 9, r: 4.8 }, { x: 23, y: 9, r: 4.8 }, { x: 9, y: 23, r: 4.8 }, { x: 23, y: 23, r: 4.8 }],
  ]
  const pointsForStar = (cx: number, cy: number, radius: number) =>
    Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5
      const distance = index % 2 === 0 ? radius : radius * 0.46
      return `${cx + Math.cos(angle) * distance},${cy + Math.sin(angle) * distance}`
    }).join(' ')
  return (
    <svg className={`m3-difficulty-icon m3-difficulty-${level}`} viewBox="0 0 32 32" aria-hidden="true">
      {layouts[level - 1].map(({ x, y, r }, index) => (
        <polygon key={index} points={pointsForStar(x, y, r)} />
      ))}
    </svg>
  )
}

function GenderIcon({ mode }: { mode: Match3Mode }) {
  if (mode === 'mixed') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="7.5" r="3.1" /><path d="M3.5 19v-2.3a5 5 0 0 1 10 0V19M16 4.5a3 3 0 0 1 0 5.8m1 2.2a4.7 4.7 0 0 1 3.5 4.5V19" /></svg>
  }
  return mode === 'male'
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="14" r="5.5" /><path d="m14 10 6-6m-5 0h5v5" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="5" /><path d="M12 13v8m-3-3h6" /></svg>
}

function NewGameIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
}

function ScoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.8Z" /></svg>
}

function BestIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3.2a5 5 0 0 1-10 0V4Zm5 8.2V17m-4 3h8m-6-3h4m3-10h2.5v2a3.5 3.5 0 0 1-3.5 3.5M7 7H4.5v2A3.5 3.5 0 0 0 8 12.5" /></svg>
}

function ImageModeIcon({ mode }: { mode: ImageDisplayMode }) {
  if (mode === 'cover') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect className="m3-mode-frame" x="3" y="3" width="18" height="18" rx="4" />
        <circle className="m3-mode-sun" cx="9" cy="8.5" r="1.2" />
        <path d="m5.5 17 4-4 3 3 3.5-5 3 6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className="m3-mode-frame" x="3" y="3" width="18" height="18" rx="4" />
      <rect x="8.5" y="5.5" width="7" height="13" rx="1.5" />
      <circle className="m3-mode-sun" cx="12" cy="9" r="1" />
      <path d="m10.5 15 1.5-1.8 1.5 1.8" />
    </svg>
  )
}

export function ImageModeButton({ mode, onCycle, disabled }: { mode: ImageDisplayMode; onCycle: () => void; disabled: boolean }) {
  const labels = {
    contain: [m('完整 Contain', 'Contain'), m('裁切 Cover', 'Cover')],
    cover: [m('裁切 Cover', 'Cover'), m('完整 Contain', 'Contain')],
  } satisfies Record<ImageDisplayMode, [string, string]>
  const descriptions = {
    cover: m('铺满格子，边缘可能裁切', 'Fill tile; crop image edges'),
    contain: m('完整显示，保持原图比例', 'Show full image at original ratio'),
  } satisfies Record<ImageDisplayMode, string>
  const modeNumber = mode === 'contain' ? 1 : 2
  return (
    <button
      type="button"
      className={`m3-mode-btn is-${mode}`}
      onClick={onCycle}
      disabled={disabled}
      title={`${m('图片显示', 'Image display')}: ${labels[mode][0]}（${descriptions[mode]}）· ${m('点击切换', 'click to switch to')} ${labels[mode][1]}`}
      aria-label={`${m('图片显示', 'Image display')}: ${labels[mode][0]}`}
    >
      <ImageModeIcon mode={mode} />
      <span className="m3-mode-badge" aria-hidden="true">{modeNumber}</span>
    </button>
  )
}

interface DifficultyPickerProps {
  boardSize: BoardSize
  busy: boolean
  onDifficultyChange: (size: BoardSize) => void
}

export function DifficultyPicker({ boardSize, busy, onDifficultyChange }: DifficultyPickerProps) {
  return (
    <div className="m3-difficulty" role="group" aria-label={m('难度', 'Difficulty')}>
      {DIFFICULTIES.map(({ size, label }, index) => (
        <button
          key={size}
          type="button"
          className={`m3-diff${boardSize === size ? ' is-active' : ''}`}
          onClick={() => onDifficultyChange(size as BoardSize)}
          disabled={busy}
          title={`${m(label[0], label[1])} · ${size}×${size}`}
          aria-label={`${m(label[0], label[1])} · ${size}×${size}`}
          aria-pressed={boardSize === size}
        >
          <DifficultyIcon level={index + 1} />
        </button>
      ))}
    </div>
  )
}

interface Match3ControlRowProps {
  mode: Match3Mode
  imageMode: ImageDisplayMode
  score: number
  best: number
  busy: boolean
  onModeChange: (mode: Match3Mode) => void
  onImageModeCycle: () => void
  onNewGame: () => void
}

export function Match3ControlRow({
  mode, imageMode, score, best, busy, onModeChange, onImageModeCycle, onNewGame,
}: Match3ControlRowProps) {
  const modes: { key: Match3Mode; label: string }[] = [
    { key: 'male', label: m('男角', 'Male') },
    { key: 'female', label: m('女角', 'Female') },
    { key: 'mixed', label: m('混合', 'Mixed') },
  ]
  return (
    <div className="m3-control-row">
      <div className="m3-stat" aria-label={m('分数', 'Score')}><span className="m3-stat-icon m3-score-icon"><ScoreIcon /></span><strong>{score}</strong></div>
      <div className="m3-stat" aria-label={m('最高分', 'Best')}><span className="m3-stat-icon m3-trophy"><BestIcon /></span><strong>{best}</strong></div>
      <div className="m3-tabs" role="group" aria-label={m('人物类型', 'Character selection')}>
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`m3-tab${mode === item.key ? ' is-active' : ''}`}
            onClick={() => onModeChange(item.key)}
            disabled={busy}
            title={item.label}
            aria-label={item.label}
            aria-pressed={mode === item.key}
          >
            <GenderIcon mode={item.key} />
          </button>
        ))}
      </div>
      <ImageModeButton mode={imageMode} onCycle={onImageModeCycle} disabled={busy} />
      <button type="button" className="m3-new" onClick={onNewGame} disabled={busy} title={m('新局', 'New game')} aria-label={m('新局', 'New game')}>
        <NewGameIcon />
      </button>
    </div>
  )
}
