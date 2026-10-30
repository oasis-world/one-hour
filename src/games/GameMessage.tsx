import { parseGameRef } from './types'
import { getGameById } from './registry'
import type { PresenceMember } from '../lib/chatTypes'

interface Props {
  content: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

export default function GameMessage({ content, hostUserId, onlineMembers = [] }: Props) {
  const ref = parseGameRef(content)
  if (!ref) return null
  const def = getGameById(ref.type)
  if (!def) return null
  const Component = def.Component
  return <Component instanceId={ref.instanceId} hostUserId={hostUserId} onlineMembers={onlineMembers} />
}
