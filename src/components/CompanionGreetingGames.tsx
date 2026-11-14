import { rankGames } from '../games/popularity'
import type { GamePopularity } from '../lib/gamePopularity'
import { t } from '../lib/i18n'
import GamePopularityIcon from './GamePopularityIcon'

export default function CompanionGreetingGames({
  counts,
  onSelectGame,
}: {
  counts: GamePopularity
  onSelectGame: (gameId: string) => void
}) {
  const games = rankGames(counts).slice(0, 6)
  return (
    <div className="companion-greeting-games-card" aria-label={t('热门游戏', 'Popular games')}>
      <div className="companion-greeting-games">
        {games.map(({ game, count, rank }) => (
          <button
            key={game.id}
            type="button"
            className="companion-greeting-game"
            aria-label={`${t(game.name, game.nameEn)}: ${count}`}
            title={`${t(game.name, game.nameEn)}: ${count}`}
            onClick={() => onSelectGame(game.id)}
          >
            <GamePopularityIcon game={game} compact count={count} rank={rank} />
            <span className="companion-greeting-game-name">{t(game.name, game.nameEn)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
