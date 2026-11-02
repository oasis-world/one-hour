import { PIECE_VALUE, evaluate } from './ai/evaluate'
import { applyMove, inCheck, isCheckmate, legalMoves, pieceType, type Move, type Side } from './logic'

export type XiangqiHint = {
  from: [number, number]; to: [number, number]
  isCapture: boolean; captureValue: number | null; captureType: string | null
  givesCheck: boolean; givesMate: boolean
  isDefensive: boolean
  materialDiff: number
  localEval: number
  shallowScore: number
  opponentBestReply: string | null
}

const TYPE_NAME: Record<number, string> = { 1: 'General', 2: 'Advisor', 3: 'Elephant', 4: 'Horse', 5: 'Chariot', 6: 'Cannon', 7: 'Soldier' }

export function buildXiangqiHints(board: number[][], side: Side, legalMovesList: Move[]): { annotatedMoves: XiangqiHint[]; threatSummary: string } {
  const opp: Side = side === 'red' ? 'black' : 'red'
  const baseEval = evaluate(board)
  const inCheckNow = inCheck(board, side)
  const oppInCheck = inCheck(board, opp)
  let captureMoves = 0, checkingMoves = 0, mateMoves = 0

  const annotated: XiangqiHint[] = legalMovesList.map((m) => {
    const captured = board[m.to[0]][m.to[1]]
    const isCapture = captured !== 0
    const captureValue = isCapture ? (PIECE_VALUE[pieceType(captured)] ?? 0) : null
    const captureType = isCapture ? (TYPE_NAME[pieceType(captured)] ?? null) : null
    const nb = applyMove(board, m)
    const givesCheck = inCheck(nb, opp)
    const givesMate = givesCheck && isCheckmate(nb, opp)
    const isDefensive = inCheckNow && !inCheck(nb, side)
    const afterEval = evaluate(nb)
    const materialDiff = Math.round(afterEval - baseEval)
    const localEval = Math.round(afterEval)
    // 2-ply shallow: opponent best reply
    let shallowScore = localEval
    let opponentBestReply: string | null = null
    if (!givesMate) {
      const oppMoves = legalMoves(nb, opp)
      if (oppMoves.length > 0) {
        let bestOppScore = side === 'red' ? Infinity : -Infinity
        let bestOppMove: Move | null = null
        for (const om of oppMoves.slice(0, 30)) {
          const ob = applyMove(nb, om)
          const sc = evaluate(ob)
          if (side === 'red' ? sc < bestOppScore : sc > bestOppScore) {
            bestOppScore = sc
            bestOppMove = om
          }
        }
        if (bestOppMove) {
          shallowScore = Math.round(bestOppScore)
          opponentBestReply = `${bestOppMove.from}->${bestOppMove.to}`
        }
      }
    }
    if (isCapture) captureMoves++
    if (givesCheck) checkingMoves++
    if (givesMate) mateMoves++
    return { from: m.from, to: m.to, isCapture, captureValue, captureType, givesCheck, givesMate, isDefensive, materialDiff, localEval, shallowScore, opponentBestReply }
  })

  // Sort by tactical priority: mate > capture value > check > material
  annotated.sort((a, b) => {
    if (a.givesMate !== b.givesMate) return b.givesMate ? 1 : -1
    if ((a.captureValue ?? 0) !== (b.captureValue ?? 0)) return (b.captureValue ?? 0) - (a.captureValue ?? 0)
    if (a.givesCheck !== b.givesCheck) return b.givesCheck ? 1 : -1
    return b.materialDiff - a.materialDiff
  })

  const matRed = board.flat().filter((p) => p > 0).reduce((s, p) => s + (PIECE_VALUE[pieceType(p)] ?? 0), 0)
  const matBlack = board.flat().filter((p) => p < 0).reduce((s, p) => s + (PIECE_VALUE[pieceType(p)] ?? 0), 0)
  const top = annotated.slice(0, 4).map((h) => `${h.from}->${h.to}${h.isCapture ? ` x${h.captureType}(${h.captureValue})` : ''}${h.givesMate ? ' MATE' : h.givesCheck ? ' check' : ''} shallow=${h.shallowScore}${h.opponentBestReply ? ` opp:${h.opponentBestReply}` : ''}`).join(' | ')
  const bestShallow = [...annotated].sort((a, b) => side === 'red' ? b.shallowScore - a.shallowScore : a.shallowScore - b.shallowScore)[0]
  const shallowLine = bestShallow ? `Best shallow line: ${bestShallow.from}->${bestShallow.to} score=${bestShallow.shallowScore}${bestShallow.opponentBestReply ? ` then ${bestShallow.opponentBestReply}` : ''}` : ''
  const threatSummary = `Xiangqi turn=${side} eval=${Math.round(baseEval)} (red+). Material R:${matRed} B:${matBlack}. InCheck: you=${inCheckNow} opp=${oppInCheck}. Moves: ${legalMovesList.length} total, ${captureMoves} captures, ${checkingMoves} checks, ${mateMoves} mates. ${shallowLine}. Top: ${top || 'none'}.`
  return { annotatedMoves: annotated.slice(0, 40), threatSummary }
}
