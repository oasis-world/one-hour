import { TILE_TYPES } from './model'
import { TILES, type TileDef } from './tiles'
import type { Match3Mode } from './Match3Controls'

export function makeTileSet(mode: Match3Mode): TileDef[] {
  const pool = mode === 'mixed' ? TILES : TILES.filter((tile) => tile.gender === mode)
  const available = pool.length >= TILE_TYPES ? pool : TILES
  return [...available].sort(() => Math.random() - 0.5).slice(0, TILE_TYPES)
}
