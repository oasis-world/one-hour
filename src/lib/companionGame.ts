import { getSupabaseClient } from './supabaseClient'
import type { CompanionProfile } from './companionProfile'
import type { ChatIdentity } from './identity'
import { createInitialState as createGomokuState, emptyBoard as emptyGomokuBoard } from '../games/gomoku/logic'
import { createInitialState as createChessState, initialBoard as chessBoard } from '../games/chess/logic'
import { createInitialState as createXiangqiState, initialBoard as xiangqiBoard } from '../games/xiangqi/logic'

type GameId = 'gomoku' | 'xiangqi' | 'chess'

export async function createCompanionGame(
  gameId: GameId,
  instanceId: string,
  host: ChatIdentity,
  companion: CompanionProfile,
): Promise<void> {
  const client = await getSupabaseClient()
  const expiresAt = new Date(companion.expiresAt).toISOString()
  const updatedAt = new Date().toISOString()
  if (gameId === 'gomoku') {
    const base = createGomokuState(instanceId, host.userId)
    const now = Date.now()
    base.players = [
      { userId: host.userId, displayName: host.displayName, avatarUrl: host.avatarUrl, avatarStyle: host.avatar?.style ?? null, avatarSeed: host.avatar?.seed ?? null, color: 1, score: 0, joinedAt: now },
      { userId: companion.id, displayName: companion.name, avatarUrl: companion.avatarUrl ?? null, avatarStyle: companion.style, avatarSeed: companion.seed, color: 2, score: 0, joinedAt: now, isAI: true },
    ]
    base.board = emptyGomokuBoard()
    base.turn = 1
    base.status = 'playing'
    base.round = 1
    await client.from('gomoku_states').upsert({ instance_id: instanceId, state: base, updated_at: updatedAt, expires_at: expiresAt }, { onConflict: 'instance_id' })
    return
  }
  if (gameId === 'chess') {
    const base = createChessState(instanceId, host.userId)
    base.players = [
      { userId: host.userId, displayName: host.displayName, avatarUrl: host.avatarUrl, avatarStyle: host.avatar?.style ?? null, avatarSeed: host.avatar?.seed ?? null, color: 'w', score: 0 },
      { userId: companion.id, displayName: companion.name, avatarUrl: companion.avatarUrl ?? null, avatarStyle: companion.style, avatarSeed: companion.seed, color: 'b', score: 0, isAI: true },
    ]
    base.board = chessBoard()
    base.turn = 'w'
    base.status = 'playing'
    base.round = 1
    await client.from('chess_states').upsert({ instance_id: instanceId, state: base, updated_at: updatedAt, expires_at: expiresAt }, { onConflict: 'instance_id' })
    return
  }
  if (gameId === 'xiangqi') {
    const base = createXiangqiState(instanceId, host.userId)
    const now = Date.now()
    base.players = [
      { userId: host.userId, displayName: host.displayName, avatarUrl: host.avatarUrl, avatarStyle: host.avatar?.style ?? null, avatarSeed: host.avatar?.seed ?? null, color: 1, score: 0, joinedAt: now },
      { userId: companion.id, displayName: companion.name, avatarUrl: companion.avatarUrl ?? null, avatarStyle: companion.style, avatarSeed: companion.seed, color: 2, score: 0, joinedAt: now, isAI: true },
    ]
    base.board = xiangqiBoard()
    base.turn = 1
    base.status = 'playing'
    base.round = 1
    await client.from('xiangqi_states').upsert({ instance_id: instanceId, state: base, updated_at: updatedAt, expires_at: expiresAt }, { onConflict: 'instance_id' })
  }
}

export function gameTitle(gameId: GameId, t: (zh: string, en: string) => string): string {
  if (gameId === 'gomoku') return t('五子棋', 'Gomoku')
  if (gameId === 'xiangqi') return t('中国象棋', 'Chinese Chess')
  return t('国际象棋', 'Chess')
}
