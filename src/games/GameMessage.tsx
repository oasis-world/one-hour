import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'
import './GameMessage.css'

interface Props {
  content: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

export default function GameMessage({ content, hostUserId, onlineMembers = [] }: Props) {
  const gameRef = parseGameRef(content)
  if (!gameRef) return null
  const def = getGameById(gameRef.type)
  if (!def) return null
  const Component = def.Component
  return (
    <div className="game-message">
      <Component instanceId={gameRef.instanceId} hostUserId={hostUserId} onlineMembers={onlineMembers} />
    </div>
  )
}
