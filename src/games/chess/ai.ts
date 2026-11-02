import { inCheck, legalMoves, tryMove, type ChessState, type Color, type Square } from './logic'

export interface AiMove { from:Square; to:Square }

const VALUE:Record<string,number>={p:100,n:320,b:335,r:500,q:900,k:0}

function evaluate(state:ChessState, perspective:Color):number {
  let score=0
  for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
    const piece=state.board[row][col];if(!piece)continue
    const sign=piece[0]===perspective?1:-1,kind=piece[1]
    score+=sign*VALUE[kind]
    const center=3.5-(Math.abs(3.5-row)+Math.abs(3.5-col))/2
    if(kind==='n'||kind==='b')score+=sign*center*7
    if(kind==='p')score+=sign*(piece[0]==='w'?6-row:row-1)*2
    if(kind==='q')score+=sign*center*2
  }
  if(inCheck(state.board,perspective))score-=45
  if(inCheck(state.board,perspective==='w'?'b':'w'))score+=38
  return score
}

function terminalScore(state:ChessState, aiId:string, perspective:Color):number {
  if(state.status==='result'&&!state.winnerId)return 0
  if(state.winnerId===aiId)return 100_000
  if(state.winnerId)return -100_000
  return evaluate(state,perspective)
}

/** A shallow minimax keeps the AI's choices legal and looks through one reply. */
export function chooseChessAiMove(state:ChessState):AiMove|null {
  const ai=state.players.find(player=>player.isAI&&player.color===state.turn)
  if(!ai||state.status!=='playing')return null
  const replies=state.players.find(player=>player.color!==ai.color)
  if(!replies)return null
  let best=-Infinity
  const candidates:AiMove[]=[]
  for(const move of legalMoves(state)) {
    const after=tryMove(state,ai.userId,move.from,move.to)
    if(!after)continue
    let score: number
    if(after.status==='result')score=terminalScore(after,ai.userId,ai.color)
    else {
      const opponentMoves=legalMoves(after)
      if(opponentMoves.length===0)score=terminalScore(after,ai.userId,ai.color)
      else {
        score=Infinity
        for(const reply of opponentMoves) {
          const response=tryMove(after,replies.userId,reply.from,reply.to)
          if(response)score=Math.min(score,terminalScore(response,ai.userId,ai.color))
        }
        if(score===Infinity)score=evaluate(after,ai.color)
      }
    }
    score+=Math.random()*.01
    if(score>best){best=score;candidates.length=0;candidates.push(move)}
    else if(score===best)candidates.push(move)
  }
  return candidates[Math.floor(Math.random()*candidates.length)]??null
}
