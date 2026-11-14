import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLang, t } from '../lib/i18n'
import { setPopoverOpen } from '../lib/popoverGuard'
import type { GamePopularity } from '../lib/gamePopularity'
import { rankGames } from '../games/popularity'
import { GameIcon, ThinXIcon } from './icons'
import GamePopularityIcon from './GamePopularityIcon'
import './GamePickerModal.css'

interface Props {
  /** Called with the chosen game id. The modal closes itself afterwards. */
  onSelect: (gameId: string) => void
  onClose: () => void
  popularity: GamePopularity
}

function MarqueeName({ text }: { text: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const segRef = useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = useState(false)

  useLayoutEffect(() => {
    const container = containerRef.current
    const seg = segRef.current
    if (!container || !seg) return
    setOverflow(seg.getBoundingClientRect().width > container.clientWidth + 1)
  }, [text])

  return (
    <span ref={containerRef} className={`game-picker-name${overflow ? ' is-marquee' : ''}`}>
      <span className="game-picker-name-track">
        <span ref={segRef} className={`game-picker-name-seg${overflow ? ' is-spaced' : ''}`}>{text}</span>
        {overflow && (
          <span className={`game-picker-name-seg${overflow ? ' is-spaced' : ''}`} aria-hidden="true">{text}</span>
        )}
      </span>
    </span>
  )
}

export default function GamePickerModal({ onSelect, onClose, popularity }: Props) {
  useLang()

  useEffect(() => {
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const games = rankGames(popularity)

  return (
    <div
      className="game-picker-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="game-picker-card" role="dialog" aria-modal="true" aria-label={t('选择游戏', 'Choose a game')}>
        <header className="game-picker-head">
          <span className="game-picker-tile"><GameIcon size={36} /></span>
          <span className="game-picker-titles">
            <strong>{t('选择游戏', 'Choose a game')}</strong>
            <small>{t('挑一款喜欢的游戏开始玩', 'Pick a game and start playing')}</small>
          </span>
          <button
            type="button"
            className="game-picker-x"
            onClick={onClose}
            aria-label={t('关闭', 'Close')}
          >
            <ThinXIcon size={15} />
          </button>
        </header>

        <div className="game-picker-grid">
          {games.map(({ game, count, rank }, i) => {
            const name = t(game.name, game.nameEn)
            return (
              <button
                key={game.id}
                type="button"
                className="game-picker-item"
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={() => {
                  onSelect(game.id)
                  onClose()
                }}
              >
                <GamePopularityIcon game={game} count={count} rank={rank} />
                <MarqueeName text={name} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
