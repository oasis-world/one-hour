import { inCheck, legalMoves, type ChessState, type Color, type Square } from './logic'

const VALUE: Record<string, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 }

function materialCount(board: ChessState['board']): { w: number; b: number } {
  let w = 0, b = 0
  for (const row of board) for (const p of row) if (p) {
    const v = VALUE[p[1]] ?? 0
    if (p[0] === 'w') w += v; else b += v
  }
  return { w, b }
}

export type ChessHint = {
  from: Square; to: Square; promotion?: string
  isCapture: boolean; captureValue: number | null; capturedPiece: string | null
  givesCheck: boolean; givesMate: boolean
  isEnPassant: boolean; isCastling: boolean; isPromotion: boolean
  isCheckEvasion: boolean
  materialDiff: number
}

export function buildChessHints(state: ChessState, legalMovesList: { from: Square; to: Square; promotion?: string }[]): { annotatedMoves: ChessHint[]; threatSummary: string } {
  const myColor = state.turn
  const opp: Color = myColor === 'w' ? 'b' : 'w'
  const inCheckNow = inCheck(state.board, myColor)
  const mat = materialCount(state.board)
  let captures = 0, checks = 0, mates = 0

  const annotated: ChessHint[] = legalMovesList.map((m) => {
    const piece = state.board[m.from[0]][m.from[1]]
    const captured = state.board[m.to[0]][m.to[1]]
    const isEnPassant = !!piece && piece[1] === 'p' && state.enPassant?.[0] === m.to[0] && state.enPassant[1] === m.to[1] && !captured
    const actualCaptured = captured || (isEnPassant ? state.board[m.from[0]][m.to[1]] : null)
    const isCapture = !!actualCaptured
    const captureValue = actualCaptured ? (VALUE[actualCaptured[1]] ?? 0) : null
    const capturedPiece = actualCaptured ?? null
    const isCastling = !!piece && piece[1] === 'k' && Math.abs(m.to[1] - m.from[1]) === 2
    const isPromotion = !!m.promotion
    // Simulate board for check detection via tryMove-like apply
    const afterBoard = state.board.map((row) => row.slice()) as ChessState['board']
    const moving = afterBoard[m.from[0]][m.from[1]]
    afterBoard[m.to[0]][m.to[1]] = (m.promotion as ChessState['board'][number][number]) ?? moving
    afterBoard[m.from[0]][m.from[1]] = null
    if (isEnPassant) afterBoard[m.from[0]][m.to[1]] = null
    if (isCastling) {
      const rookFrom = m.to[1] === 6 ? 7 : 0, rookTo = m.to[1] === 6 ? 5 : 3
      afterBoard[m.to[0]][rookTo] = afterBoard[m.to[0]][rookFrom]; afterBoard[m.to[0]][rookFrom] = null
    }
    const givesCheck = inCheck(afterBoard, opp)
    // Mate = check + no legal moves for opponent (approximate: reuse givesCheck and check if any capture block)
    let givesMate = false
    if (givesCheck) {
      // Quick mate check: opponent has no moves – reuse legalMoves via temp state
      const tmp: ChessState = { ...state, board: afterBoard, turn: opp, enPassant: null }
      const oppMoves = legalMoves(tmp, opp)
      if (oppMoves.length === 0) givesMate = true
    }
    const afterMat = (() => {
      let w2 = 0, b2 = 0
      for (const row of afterBoard) for (const p of row) if (p) { const v = VALUE[p[1]] ?? 0; if (p[0] === 'w') w2 += v; else b2 += v }
      return w2 - b2
    })()
    const materialDiff = Math.round((myColor === 'w' ? afterMat - (mat.w - mat.b) : (mat.w - mat.b) - afterMat) * -1)
    // Simpler: if capture, materialDiff = captureValue with sign
    const isCheckEvasion = inCheckNow && !inCheck(afterBoard, myColor)
    if (isCapture) captures++
    if (givesCheck) checks++
    if (givesMate) mates++
    return { from: m.from, to: m.to, promotion: m.promotion, isCapture, captureValue, capturedPiece, givesCheck, givesMate, isEnPassant, isCastling, isPromotion, isCheckEvasion, materialDiff }
  })

  annotated.sort((a, b) => {
    if (a.givesMate !== b.givesMate) return b.givesMate ? 1 : -1
    if ((a.captureValue ?? 0) !== (b.captureValue ?? 0)) return (b.captureValue ?? 0) - (a.captureValue ?? 0)
    if (a.givesCheck !== b.givesCheck) return b.givesCheck ? 1 : -1
    return (b.materialDiff ?? 0) - (a.materialDiff ?? 0)
  })

  const rep = state.positionHistory?.filter((k) => k === state.positionHistory?.[state.positionHistory.length - 1]).length ?? 1
  const top = annotated.slice(0, 3).map((h) => `${h.from}->${h.to}${h.isCapture ? ` x${h.capturedPiece}` : ''}${h.givesMate ? ' MATE' : h.givesCheck ? ' check' : ''}`).join(', ')
  const threatSummary = `Chess turn=${myColor} castling=${state.castling || '-'} enPassant=${state.enPassant ? state.enPassant.join(',') : '-'} halfmove=${state.halfmove} rep=${rep}. Material W:${mat.w} B:${mat.b} (diff=${mat.w - mat.b}). InCheck: you=${inCheckNow}. Moves: ${legalMovesList.length} total, ${captures} captures, ${checks} checks, ${mates} mates. Top: ${top || 'none'}.`
  return { annotatedMoves: annotated.slice(0, 50), threatSummary }
}
