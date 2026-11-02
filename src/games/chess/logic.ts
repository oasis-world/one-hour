export type Color = 'w' | 'b'
export type PieceKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
export type Piece = `${Color}${PieceKind}` | null
export type Square = [number, number]
export interface ChessState {
  instanceId: string; hostId: string; players: ChessPlayer[]; board: Piece[][]; turn: Color
  status: 'waiting' | 'playing' | 'result'; winnerId: string | null; lastMove: { from: Square; to: Square } | null
  castling: string; enPassant: Square | null; halfmove: number; round: number; positionHistory?: string[]
  moveHistory?: { from: Square; to: Square }[]
  aiSource?: 'cloud' | 'local'
  aiMode?: 'cloud' | 'local'
}
export interface ChessPlayer { userId: string; displayName: string; avatarUrl: string | null; avatarStyle?: string | null; avatarSeed?: string | null; color: Color; score: number; isAI?: boolean }

export function initialBoard(): Piece[][] {
  const back: PieceKind[] = ['r','n','b','q','k','b','n','r']
  return Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) =>
    r === 0 ? `b${back[c]}` as Piece : r === 1 ? 'bp' : r === 6 ? 'wp' : r === 7 ? `w${back[c]}` as Piece : null))
}
function positionKey(board:Piece[][],turn:Color,castling:string,enPassant:Square|null):string {
  return `${board.map(row=>row.map(piece=>piece??'-').join('')).join('/')} ${turn} ${castling||'-'} ${enPassant?`${enPassant[0]}-${enPassant[1]}`:'-'}`
}
export function createInitialState(instanceId: string, hostId: string): ChessState {
  const board=initialBoard()
  return { instanceId, hostId, players: [], board, turn: 'w', status: 'waiting', winnerId: null,
    lastMove: null, castling: 'KQkq', enPassant: null, halfmove: 0, round: 1,positionHistory:[positionKey(board,'w','KQkq',null)] }
}
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8
const colorOf = (piece: Piece): Color | null => piece ? piece[0] as Color : null
export function isAttacked(board: Piece[][], target: Square, by: Color): boolean {
  const [r,c] = target
  for (let rr=0;rr<8;rr++) for (let cc=0;cc<8;cc++) {
    const p=board[rr][cc]; if (!p || colorOf(p)!==by) continue
    const dr=r-rr, dc=c-cc, kind=p[1]
    if (kind==='p' && dr===(by==='w'?-1:1) && Math.abs(dc)===1) return true
    if (kind==='n' && Math.abs(dr)*Math.abs(dc)===2) return true
    if (kind==='k' && Math.max(Math.abs(dr),Math.abs(dc))===1) return true
    if (kind==='b' || kind==='r' || kind==='q') {
      const diagonal=Math.abs(dr)===Math.abs(dc), straight=dr===0||dc===0
      if ((kind==='b'&&!diagonal)||(kind==='r'&&!straight)||(kind==='q'&&!diagonal&&!straight)) continue
      const sr=Math.sign(dr), sc=Math.sign(dc); let y=rr+sr,x=cc+sc,blocked=false
      while(y!==r||x!==c) { if(board[y][x]) { blocked=true; break } y+=sr; x+=sc }
      if(!blocked) return true
    }
  }
  return false
}
export function inCheck(board: Piece[][], color: Color): boolean {
  const row=board.findIndex(line=>line.includes(`${color}k` as Piece)); if(row<0) return true
  return isAttacked(board,[row,board[row].indexOf(`${color}k` as Piece)],color==='w'?'b':'w')
}
function pseudo(state: ChessState, color: Color): {from:Square;to:Square;promotion?:Piece}[] {
  const out:{from:Square;to:Square;promotion?:Piece}[]=[]
  const add=(r:number,c:number,y:number,x:number,promotion?:Piece)=>{ if(inside(y,x)&&colorOf(state.board[y][x])!==color) out.push({from:[r,c],to:[y,x],promotion}) }
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p=state.board[r][c]; if(!p||colorOf(p)!==color) continue
    const k=p[1], dir=color==='w'?-1:1
    if(k==='p') {
      if(inside(r+dir,c)&&!state.board[r+dir][c]) { const y=r+dir; add(r,c,y,c,y===0||y===7?`${color}q` as Piece:undefined); if((color==='w'?r===6:r===1)&&!state.board[r+2*dir][c]) add(r,c,r+2*dir,c) }
      for(const dx of [-1,1]) { const y=r+dir,x=c+dx; if(inside(y,x)&&(colorOf(state.board[y][x])&&colorOf(state.board[y][x])!==color || state.enPassant?.[0]===y&&state.enPassant[1]===x)) add(r,c,y,x,y===0||y===7?`${color}q` as Piece:undefined) }
      continue
    }
    if(k==='n') { for(const [dy,dx] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r,c,r+dy,c+dx); continue }
    if(k==='k') {
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) if(dy||dx) add(r,c,r+dy,c+dx)
      const home=color==='w'?7:0, enemy=color==='w'?'b':'w'
      if(r===home&&c===4&&!inCheck(state.board,color)) for(const [side,rookCol,emptyCols,checkCols] of [['K',7,[5,6],[5,6]],['Q',0,[1,2,3],[3,2]]] as const) {
        if(state.castling.includes(color==='w'?side:side.toLowerCase())&&state.board[home][rookCol]===`${color}r`&&emptyCols.every(x=>!state.board[home][x])&&checkCols.every(x=>!isAttacked(state.board,[home,x],enemy))) out.push({from:[r,c],to:[home,side==='K'?6:2]})
      }
      continue
    }
    const dirs=k==='b'?[[1,1],[1,-1],[-1,1],[-1,-1]]:k==='r'?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]
    for(const [dy,dx] of dirs) { let y=r+dy,x=c+dx; while(inside(y,x)) { if(colorOf(state.board[y][x])===color) break; out.push({from:[r,c],to:[y,x]}); if(state.board[y][x]) break; y+=dy;x+=dx } }
  }
  return out
}
export function legalMoves(state: ChessState, color=state.turn) {
  return pseudo(state,color).filter(m=>!inCheck(apply(state,m),color))
}
function apply(state:ChessState,move:{from:Square;to:Square;promotion?:Piece}):Piece[][] {
  const b=state.board.map(row=>row.slice()),[r,c]=move.from,[y,x]=move.to,p=b[r][c]; if(!p)return b
  b[y][x]=move.promotion??p; b[r][c]=null
  if(p[1]==='p'&&state.enPassant?.[0]===y&&state.enPassant[1]===x&&!state.board[y][x]) b[y+(p[0]==='w'?1:-1)][x]=null
  if(p[1]==='k'&&Math.abs(x-c)===2) { const rookX=x===6?7:0; b[y][x===6?5:3]=b[y][rookX]; b[y][rookX]=null }
  return b
}
export function tryMove(state:ChessState,userId:string,from:Square,to:Square):ChessState|null {
  if(state.status!=='playing'||state.players.find(p=>p.userId===userId)?.color!==state.turn)return null
  const move=legalMoves(state).find(m=>m.from[0]===from[0]&&m.from[1]===from[1]&&m.to[0]===to[0]&&m.to[1]===to[1]); if(!move)return null
  const piece=state.board[from[0]][from[1]]!; const board=apply(state,move); let castling=state.castling
  const captured=state.board[to[0]][to[1]]
  if(piece[1]==='k') castling=castling.replace(piece[0]==='w'?/[KQ]/g:/[kq]/g,'')
  if(piece[1]==='r') { if(from[0]===7&&from[1]===0)castling=castling.replace('Q',''); if(from[0]===7&&from[1]===7)castling=castling.replace('K',''); if(from[0]===0&&from[1]===0)castling=castling.replace('q',''); if(from[0]===0&&from[1]===7)castling=castling.replace('k','') }
  if(captured==='wr'){if(to[0]===7&&to[1]===0)castling=castling.replace('Q','');if(to[0]===7&&to[1]===7)castling=castling.replace('K','')}
  if(captured==='br'){if(to[0]===0&&to[1]===0)castling=castling.replace('q','');if(to[0]===0&&to[1]===7)castling=castling.replace('k','')}
  const nextColor:Color=state.turn==='w'?'b':'w', next:ChessState={...state,board,turn:nextColor,castling,
    enPassant:piece[1]==='p'&&Math.abs(to[0]-from[0])===2?[(from[0]+to[0])/2,from[1]] as Square:null,
    halfmove:piece[1]==='p'||state.board[to[0]][to[1]]?0:state.halfmove+1,lastMove:{from,to},
    moveHistory: [...(state.moveHistory ?? []), { from, to }],
  }
  const history=state.positionHistory?.length?state.positionHistory:[positionKey(state.board,state.turn,state.castling,state.enPassant)]
  const positionHistory=[...history,positionKey(board,nextColor,castling,next.enPassant)]
  next.positionHistory=positionHistory
  const moves=legalMoves(next,nextColor), check=inCheck(board,nextColor), winnerId=check&&!moves.length?userId:null
  const repeated=positionHistory.filter(key=>key===positionHistory[positionHistory.length-1]).length>=3
  const draw=!check&&!moves.length||next.halfmove>=100||repeated||insufficientMaterial(board)
  const players=winnerId?state.players.map(p=>p.userId===userId?{...p,score:p.score+1}:p):state.players
  return {...next,players,winnerId,status:winnerId||draw?'result':'playing',turn:winnerId||draw?state.turn:nextColor}
}
export function restartChessRound(state:ChessState):ChessState {
  const round=state.round+1
  const board=initialBoard(),turn:Color=round%2===0?'b':'w'
  return {...state,board,turn,status:state.players.length===2?'playing':'waiting',winnerId:null,lastMove:null,castling:'KQkq',enPassant:null,halfmove:0,round,aiSource:undefined,moveHistory:[],positionHistory:[positionKey(board,turn,'KQkq',null)]}
}
export function joinChess(state:ChessState, player:ChessPlayer):ChessState {
  if(state.players.some(p=>p.userId===player.userId)||state.players.length>=2)return state
  const color:Color=state.players.some(p=>p.color==='w')?'b':'w', players=[...state.players,{...player,color}]
  const restarting=state.status==='result',round=state.round+(restarting?1:0)
  const board=restarting?initialBoard():state.board,turn:Color=restarting?(round%2===0?'b':'w'):state.turn
  return {...state,players,board,turn,
    status:players.length===2?'playing':'waiting',winnerId:restarting?null:state.winnerId,lastMove:restarting?null:state.lastMove,
    castling:restarting?'KQkq':state.castling,enPassant:restarting?null:state.enPassant,halfmove:restarting?0:state.halfmove,round,
    aiSource:restarting?undefined:state.aiSource,
    moveHistory:restarting?[]:state.moveHistory,
    positionHistory:restarting?[positionKey(board,turn,'KQkq',null)]:state.positionHistory}
}
export function addChessAi(state:ChessState):ChessState|null {
  if(state.status!=='waiting'||state.players.length!==1||state.players[0].isAI)return null
  const human={...state.players[0],color:'w' as const}
  const ai:ChessPlayer={userId:`chess-ai:${state.instanceId}`,displayName:'AI',avatarUrl:null,color:'b',score:0,isAI:true}
  return {...state,players:[human,ai],turn:'w',status:'playing',aiMode:'local',aiSource:undefined}
}
export function removeChessPlayer(state:ChessState,userId:string):ChessState|null {
  const leaving=state.players.find(p=>p.userId===userId&&!p.isAI)
  if(!leaving)return null
  const players=state.players.some(p=>p.isAI)?[]:state.players.filter(p=>p.userId!==userId)
  const board=initialBoard(),round=players.length?state.round+1:1
  return {...state,players,board,turn:'w',status:players.length===2?'playing':'waiting',winnerId:null,lastMove:null,castling:'KQkq',enPassant:null,halfmove:0,round,moveHistory:[],positionHistory:[positionKey(board,'w','KQkq',null)]}
}
function insufficientMaterial(board:Piece[][]):boolean {
  const pieces=board.flatMap(row=>row.filter((piece):piece is Exclude<Piece,null>=>Boolean(piece)&&piece?.[1]!=='k'))
  if(pieces.length===0)return true
  if(pieces.length===1)return pieces[0][1]==='b'||pieces[0][1]==='n'
  if(pieces.every(piece=>piece[1]==='b')){
    const squares=board.flatMap((row,r)=>row.flatMap((piece,c)=>piece?.[1]==='b'?[(r+c)%2]:[]))
    return squares.every(square=>square===squares[0])
  }
  return false
}
export function isChessState(v:unknown,id:string):v is ChessState {
  const s=v as ChessState; return !!s&&s.instanceId===id&&Array.isArray(s.board)&&s.board.length===8&&s.board.every(r=>Array.isArray(r)&&r.length===8)&&Array.isArray(s.players)
}
