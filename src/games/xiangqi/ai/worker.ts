import { chooseAiMove } from './search'
import type { Move } from '../logic'

interface RequestMessage {
  id: number
  board: number[][]
  color: 1 | 2
  timeLimitMs?: number
}

interface ResponseMessage {
  id: number
  move: Move | null
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<RequestMessage>) => void) | null
  postMessage(message: ResponseMessage): void
}

workerScope.onmessage = ({ data }) => {
  const move = chooseAiMove(data.board, data.color, data.timeLimitMs)
  workerScope.postMessage({ id: data.id, move })
}
