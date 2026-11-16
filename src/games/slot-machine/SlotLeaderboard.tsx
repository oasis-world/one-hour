import AvatarBadge from '../../components/AvatarBadge'
import { slotText as s } from './slotText'
import type { SlotBalanceFlash, SlotLeaderboardPlayer } from './useSlotLeaderboard'
import './SlotLeaderboard.css'

function TrophyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3" /><path d="M12 13v4M9 20h6M10 17h4" /></svg>
}

function PlayersIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.4a3 3 0 0 1 0 5.2M17 14.2a5.5 5.5 0 0 1 3.5 4.8" /></svg>
}

interface Props {
  players: SlotLeaderboardPlayer[]
  total: number
  flashes: Record<string, SlotBalanceFlash>
  dir: 'ltr' | 'rtl'
}

export default function SlotLeaderboard({ players, total, flashes, dir }: Props) {
  return (
    <section className="slot-lb" dir={dir} aria-label={s('玩家排行', 'LEADERBOARD')}>
      <header className="slot-lb-head">
        <strong className="slot-lb-title"><TrophyIcon />{s('玩家排行', 'LEADERBOARD')}</strong>
        <span className="slot-lb-count"><PlayersIcon /><b>{total}</b>{s('玩家', 'PLAYERS')}</span>
      </header>
      <ol className="slot-lb-list">
        {players.map((player, index) => {
          const flash = flashes[player.userId]
          return (
            <li className={`slot-lb-row${player.isSelf ? ' is-self' : ''}`} key={player.userId}>
              <span className={`slot-lb-rank rank-${index + 1}`} aria-label={`#${index + 1}`}>{index + 1}</span>
              <AvatarBadge
                className="slot-lb-avatar"
                size={26}
                look={{ style: player.avatarStyle || 'thumbs', seed: player.avatarSeed || player.userId, url: player.avatarUrl }}
              />
              <span className="slot-lb-name" title={player.name}>
                {player.name}{player.isSelf && <small>{s('你', 'YOU')}</small>}
              </span>
              <span className="slot-lb-balance-wrap">
                <strong
                  key={flash?.id ?? 'steady'}
                  className={`slot-lb-balance${flash ? (flash.delta < 0 ? ' is-changing is-down' : ' is-changing is-up') : ''}`}
                  aria-label={`${player.balance.toLocaleString()} ${s('星星积分', 'STAR POINTS')}`}
                >{player.balance.toLocaleString()}</strong>
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
