import { parseGameRef } from './types'
import { getGameById } from './registry'

interface Props {
  content: string
  hostUserId: string
}

export default function GameMessage({ content, hostUserId }: Props) {
  const ref = parseGameRef(content)
  if (!ref) return null
  const def = getGameById(ref.type)
  if (!def) return null
  const Component = def.Component
  return <Component instanceId={ref.instanceId} hostUserId={hostUserId} />
}