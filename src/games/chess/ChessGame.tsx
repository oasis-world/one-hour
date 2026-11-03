import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isSupabaseConfigured } from '../../lib/supabaseConfig'
import { useAccount } from '../../lib/useAccount'
import { resolveChatIdentity } from '../../lib/identity'
import { loadUserProfile } from '../../lib/userProfile'
import { t, useLang } from '../../lib/i18n'
import type { PresenceMember } from '../../lib/chatTypes'
import AvatarBadge from '../../components/AvatarBadge'
import { ChessCrownIcon } from '../../components/icons'
import OnlineList from '../../components/OnlineList'
import { setPopoverOpen } from '../../lib/popoverGuard'
import { recordGameResult, recordInteraction } from '../../lib/lifetimeStats'
import { acquireGameChannelSlot, canSendGameBroadcast, getGamePresenceKey, isGameHostAuthority, removeStaleGameChannel, watchGameChannelClose } from '../realtime'
import { createInitialState, isChessState, joinChess, addChessAi, inCheck, legalMoves, removeChessPlayer, restartChessRound, tryMove, type ChessState, type Color, type Piece, type Square } from './logic' // Square imported via logic
import { chooseChessAiMove } from './ai'
import { requestCloudMove } from '../cloudAi'
import { buildChessHints } from './cloudHints'
import AiSourceIcon from '../AiSourceIcon'
import { AiThinkingTimer } from '../AiThinkingTimer'
import GameCardMenu from '../GameCardMenu'
import { getCachedAiMode, setCachedAiMode } from '../aiModePreference'
import { loadChessState, saveChessState } from './cloudState'
import ChessTutorPanel from './ChessTutorPanel'
import './ChessGame.css'
import './ChessTutorPanel.css'
import '../GameCardMenu.css'

type GameChannel = ReturnType<Awaited<ReturnType<typeof getSupabaseClient>>['channel']>
interface Props { instanceId: string; hostUserId: string; onlineMembers?: PresenceMember[] }
const pieceAsset=(piece:Piece)=>piece?`/games/chess-pieces/${piece[0]==='w'?'l':'d'}${piece[1]}.png`:''
const PIECE_NAMES:Record<string,[string,string]>={
  wk:['王','King'],wq:['后','Queen'],wr:['车','Rook'],wb:['象','Bishop'],wn:['马','Knight'],wp:['兵','Pawn'],
  bk:['王','King'],bq:['后','Queen'],br:['车','Rook'],bb:['象','Bishop'],bn:['马','Knight'],bp:['兵','Pawn'],
}

function PieceArt({piece}:{piece:Piece}) {
  if(!piece)return null
  return <img className="chess-piece" src={pieceAsset(piece)} alt="" aria-hidden="true" draggable={false} />
}

function AiAvatar() {
  return <span className="chess-ai-avatar" aria-label="AI"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M9 3h6M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z"/><path d="M8.5 13h.01M15.5 13h.01M9 17h6"/></svg></span>
}

export default function ChessGame({ instanceId, hostUserId, onlineMembers = [] }: Props) {
  useLang()
  const account=useAccount(),identity=resolveChatIdentity(account),profile=loadUserProfile()
  const selfId=identity?.userId??null,displayName=profile?.nickname??identity?.displayName??'Player'
  const avatarUrl=profile?.avatarUrl??identity?.avatarUrl??null
  const avatarStyle=profile?.style??identity?.avatar?.style??null
  const avatarSeed=profile?.seed??identity?.avatar?.seed??null
  const [state,setState]=useState(()=>createInitialState(instanceId,hostUserId))
  const [selected,setSelected]=useState<[number,number]|null>(null)
  const [ready,setReady]=useState(false)
  const [leaveConfirmOpen,setLeaveConfirmOpen]=useState(false)
  const [spectatorsOpen,setSpectatorsOpen]=useState(false)
  const [joinStatus,setJoinStatus]=useState<'idle'|'joining'|'retry'>('idle')
  const [moveToast,setMoveToast]=useState('')
  const [moveToastKind,setMoveToastKind]=useState<'check'|'winner'|''>('')
  const [startToast,setStartToast]=useState('')
  const [hintToast,setHintToast]=useState('')
  const hintToastTimerRef=useRef<number|null>(null)
  const [tutorOpen,setTutorOpen]=useState(false)
  const [tutorHighlight,setTutorHighlight]=useState<{from:Square;to:Square;promotion?:string}|null>(null)
  const stateRef=useRef(state),channelRef=useRef<GameChannel|null>(null)
  const renderedBoardRef=useRef(state.board)
  const boardRef=useRef<HTMLDivElement>(null)
  const moveCleanupRef=useRef<(()=>void)|null>(null)
  const toastStateRef=useRef<ChessState|null>(null)
  const stateHydratedRef=useRef(false)
  const recordedRoundRef=useRef<string|null>(null)
  const moveToastTimerRef=useRef<number|null>(null)
  const startToastTimerRef=useRef<number|null>(null)
  useLayoutEffect(()=>{stateRef.current=state},[state])
  useEffect(()=>{if(!spectatorsOpen)return;setPopoverOpen(true);return()=>setPopoverOpen(false)},[spectatorsOpen])
  const applyState=useCallback((next:ChessState)=>{
    stateRef.current=next;setState(next);void saveChessState(instanceId,next)
    void channelRef.current?.send({type:'broadcast',event:'state',payload:next})
  },[instanceId])
  const showMoveToast=useCallback((message:string,kind:''|'check'|'winner',duration=3600)=>{
    setMoveToast(message);setMoveToastKind(kind)
    if(moveToastTimerRef.current!==null)window.clearTimeout(moveToastTimerRef.current)
    moveToastTimerRef.current=window.setTimeout(()=>setMoveToast(''),duration)
  },[])
  const showStartToast=useCallback(()=>{
    setStartToast(t('游戏开始','Game start'))
    if(startToastTimerRef.current!==null)window.clearTimeout(startToastTimerRef.current)
    startToastTimerRef.current=window.setTimeout(()=>setStartToast(''),2500)
  },[])
  const showHintToast=useCallback((msg:string)=>{
    setHintToast(msg)
    if(hintToastTimerRef.current!==null)window.clearTimeout(hintToastTimerRef.current)
    hintToastTimerRef.current=window.setTimeout(()=>setHintToast(''),2000)
  },[])

  useLayoutEffect(()=>{
    const before=renderedBoardRef.current
    renderedBoardRef.current=state.board
    const move=state.lastMove
    if(!move||before[move.from[0]]?.[move.from[1]]===null)return
    const piece=before[move.from[0]]?.[move.from[1]]
    if(!piece||state.board[move.from[0]]?.[move.from[1]]!==null||state.board[move.to[0]]?.[move.to[1]]!==piece)return
    const board=boardRef.current
    const cells=board?.querySelectorAll<HTMLButtonElement>('.chess-square')
    const fromCell=Array.from(cells??[]).find(cell=>cell.dataset.square===`${move.from[0]}-${move.from[1]}`)
    const toCell=Array.from(cells??[]).find(cell=>cell.dataset.square===`${move.to[0]}-${move.to[1]}`)
    const target=toCell?.querySelector<HTMLImageElement>('.chess-piece')
    if(!board||!fromCell||!toCell||!target)return
    moveCleanupRef.current?.()
    const br=board.getBoundingClientRect(),fr=fromCell.getBoundingClientRect(),tr=toCell.getBoundingClientRect(),pr=target.getBoundingClientRect()
    const border=getComputedStyle(board),left=parseFloat(border.borderLeftWidth)||0,right=parseFloat(border.borderRightWidth)||0,top=parseFloat(border.borderTopWidth)||0,bottom=parseFloat(border.borderBottomWidth)||0
    const flipped=board.classList.contains('chess-board--flipped')
    const fromX=fr.left+fr.width/2-br.left-left,fromY=fr.top+fr.height/2-br.top-top
    const startX=(flipped?br.width-left-right-fromX:fromX)-pr.width/2
    const startY=(flipped?br.height-top-bottom-fromY:fromY)-pr.height/2
    const dx=(tr.left-fr.left)*(flipped?-1:1),dy=(tr.top-fr.top)*(flipped?-1:1)
    const opacity=target.style.opacity
    const ghost=document.createElement('img')
    ghost.className='chess-moving-piece';ghost.src=pieceAsset(piece);ghost.alt='';ghost.draggable=false
    Object.assign(ghost.style,{left:`${startX}px`,top:`${startY}px`,width:`${pr.width}px`,height:`${pr.height}px`})
    target.style.opacity='0';board.append(ghost)
    const upright=flipped?' rotate(180deg)':''
    const animation=ghost.animate([
      {transform:`translate(0,0) scale(.94)${upright}`},
      {transform:`translate(${dx}px,${dy}px) scale(1)${upright}`},
    ],{duration:500,easing:'cubic-bezier(.2,.72,.28,1)',fill:'forwards'})
    let cleaned=false
    const cleanup=()=>{if(cleaned)return;cleaned=true;animation.cancel();ghost.remove();target.style.opacity=opacity;if(moveCleanupRef.current===cleanup)moveCleanupRef.current=null}
    animation.onfinish=cleanup;moveCleanupRef.current=cleanup
    return cleanup
  },[state.board,state.lastMove])

  useEffect(()=>{
    if(!ready)return
    const before=toastStateRef.current
    toastStateRef.current=state
    if(!before)return
    const started=state.status==='playing'&&state.players.length===2&&(before.status!=='playing'||before.round!==state.round)
    if(started)showStartToast()
    const move=state.lastMove
    if(!move)return
    const moved=before.board[move.from[0]]?.[move.from[1]]
    if(!moved||state.board[move.from[0]]?.[move.from[1]]!==null||state.board[move.to[0]]?.[move.to[1]]!==moved)return
    if(state.status==='result'){
      if(state.winnerId){
        const winner=state.players.find(player=>player.userId===state.winnerId)?.displayName??'Player'
        window.setTimeout(()=>showMoveToast(t('{{winner}} 获胜！','{{winner}} wins!').replace('{{winner}}',winner),'winner',4000),0)
      }else window.setTimeout(()=>showMoveToast(t('平局','Draw'),'winner',4000),0)
      return
    }
    if(inCheck(state.board,state.turn)){window.setTimeout(()=>showMoveToast(t('将军！你的王受到攻击！','CHECK! Your king is in danger!'),'check',4000),0);return}
    let captured=before.board[move.to[0]]?.[move.to[1]]
    if(!captured&&moved[1]==='p'&&before.enPassant?.[0]===move.to[0]&&before.enPassant[1]===move.to[1])captured=before.board[move.from[0]]?.[move.to[1]]??null
    if(!captured)return
    const attacker=before.players.find(player=>player.color===before.turn)?.displayName??t(before.turn==='w'?'白方':'黑方',before.turn==='w'?'White side':'Black side')
    const other:Color=before.turn==='w'?'b':'w'
    const victim=before.players.find(player=>player.color===other)?.displayName??t(other==='w'?'白方':'黑方',other==='w'?'White side':'Black side')
    const piece=PIECE_NAMES[captured]??['棋子','piece']
    const pieceName=t(piece[0],piece[1])
    window.setTimeout(()=>showMoveToast(t('{{attacker}} 吃掉了 {{victim}} 的 {{piece}}','{{attacker}} captured {{victim}}’s {{piece}}').replace('{{attacker}}',attacker).replace('{{victim}}',victim).replace('{{piece}}',pieceName),'',3400),0)
  },[state,ready,showMoveToast,showStartToast])

  useEffect(()=>{
    if(!selfId||!state.players.some(player=>player.userId===selfId))return
    for(const player of state.players){
      if(player.userId!==selfId&&!player.isAI)recordInteraction(player.userId,player.displayName,selfId)
    }
  },[selfId,state.players])

  useEffect(()=>{
    if(!selfId||state.status!=='result')return
    const key=`${instanceId}:${state.round}`
    if(recordedRoundRef.current===key||!state.players.some(player=>player.userId===selfId))return
    recordedRoundRef.current=key
    recordGameResult('chess',selfId,state.winnerId,state.players.map(player=>player.userId))
  },[instanceId,selfId,state.status,state.round,state.winnerId,state.players])

  useEffect(()=>()=>{
    moveCleanupRef.current?.()
    if(moveToastTimerRef.current!==null)window.clearTimeout(moveToastTimerRef.current)
    if(startToastTimerRef.current!==null)window.clearTimeout(startToastTimerRef.current)
    if(hintToastTimerRef.current!==null)window.clearTimeout(hintToastTimerRef.current)
  },[])

  const [channelAttempt, setChannelAttempt] = useState(0)
  const channelRetryRef = useRef(0)

  useEffect(() => {
    if (!selfId || !isSupabaseConfigured()) return
    let cancelled = false
    let ch: GameChannel | null = null
    const abort = new AbortController()
    const slotCtrl = new AbortController()
    let releaseSlot: (() => void) | null = null
    let reconnectTimer: number | null = null
    let stableTimer: number | null = null
    const retry = (reason: string, error?: unknown) => {
      if (cancelled || reconnectTimer !== null) return
      if (stableTimer !== null) window.clearTimeout(stableTimer)
      stableTimer = null
      setReady(false)
      const delays = [1000, 2000, 5000, 10000, 15000]
      const base = delays[Math.min(channelRetryRef.current, delays.length - 1)]
      const delay = Math.round(base * (0.8 + Math.random() * 0.4))
      console.warn(`Chess channel ${reason}; retrying in ${delay}ms`, { instanceId, attempt: channelRetryRef.current + 1, channelState: ch?.state ?? 'not created', error })
      channelRetryRef.current += 1
      reconnectTimer = window.setTimeout(() => { reconnectTimer = null; if (!cancelled) setChannelAttempt((v) => v + 1) }, delay)
    }
    void (async () => {
      const client = await getSupabaseClient().catch((e: unknown) => { retry('client init failed', e); return null })
      if (!client || cancelled) return
      const slot = await acquireGameChannelSlot(slotCtrl.signal); if (cancelled || !slot) return
      releaseSlot = slot
      const topic = `game:chess:${instanceId}`
      await removeStaleGameChannel(client, topic); if (cancelled) return
      const active = client.channel(topic, { config: { presence: { key: getGamePresenceKey(selfId) } } })
      ch = active; channelRef.current = active
      watchGameChannelClose(active, 'Chess', instanceId, () => !cancelled)
      active.on('broadcast', { event: 'state' }, ({ payload }: { payload: unknown }) => { if (isChessState(payload, instanceId)) { if (!stateHydratedRef.current) { renderedBoardRef.current = payload.board; stateHydratedRef.current = true } stateRef.current = payload; setState(payload); setReady(true); if (payload.players.some((player) => player.userId === selfId)) setJoinStatus('idle') } })
      active.on('broadcast', { event: 'join' }, ({ payload }: { payload: unknown }) => {
        if (stateRef.current.hostId !== selfId || !payload || typeof payload !== 'object') return
        applyState(joinChess(stateRef.current, payload as ChessState['players'][number]))
      })
      active.on('broadcast', { event: 'ai' }, () => { if (stateRef.current.hostId === selfId) { const raw = addChessAi(stateRef.current); const cached = getCachedAiMode(); const next = raw && cached ? { ...raw, aiMode: cached } : raw; if (next) applyState(next) } })
      active.on('broadcast', { event: 'ai-mode' }, ({ payload }: { payload: unknown }) => {
        if (stateRef.current.hostId !== selfId || !isGameHostAuthority(active, stateRef.current.hostId) || !payload || typeof payload !== 'object') return
        const mode = (payload as { mode?: unknown }).mode
        if (mode === 'cloud' || mode === 'local') { setCachedAiMode(mode); applyState({ ...stateRef.current, aiMode: mode }) }
      })
      active.on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => {
        if (stateRef.current.hostId !== selfId || !payload || typeof payload !== 'object') return
        const move = payload as { userId: string; from: [number, number]; to: [number, number] }
        const next = tryMove(stateRef.current, move.userId, move.from, move.to); if (next) applyState(next)
      })
      active.on('broadcast', { event: 'leave' }, ({ payload }: { payload: unknown }) => {
        if (stateRef.current.hostId !== selfId || !payload || typeof payload !== 'object') return
        const next = removeChessPlayer(stateRef.current, (payload as { userId: string }).userId); if (next) applyState(next)
      })
      active.on('broadcast', { event: 'rematch' }, () => { if (stateRef.current.hostId === selfId) applyState(restartChessRound(stateRef.current)) })
      active.on('broadcast', { event: 'state-request' }, () => { if (stateRef.current.hostId === selfId && canSendGameBroadcast(active)) void active.send({ type: 'broadcast', event: 'state', payload: stateRef.current }) })
      active.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
          reconnectTimer = null
          if (stableTimer !== null) window.clearTimeout(stableTimer)
          stableTimer = window.setTimeout(() => { channelRetryRef.current = 0; stableTimer = null }, 30000)
          if (cancelled) return
          try {
            await active.track({ userId: selfId })
          } catch (e) { retry('track failed', e); return }
          if (cancelled || !canSendGameBroadcast(active)) return
          if (stateHydratedRef.current && stateRef.current.players.length > 0) { setReady(true); void active.send({ type: 'broadcast', event: 'state-request', payload: {} }); return }
          const loaded = await loadChessState(instanceId, abort.signal); if (cancelled) return
          if (loaded.state) { renderedBoardRef.current = loaded.state.board; stateHydratedRef.current = true; stateRef.current = loaded.state; setState(loaded.state) }
          else if (selfId === hostUserId && !stateHydratedRef.current) { const initial = createInitialState(instanceId, selfId); renderedBoardRef.current = initial.board; stateHydratedRef.current = true; stateRef.current = initial; setState(initial); void saveChessState(instanceId, initial) }
          setReady(true); void active.send({ type: 'broadcast', event: 'state-request', payload: {} })
        } else if (!cancelled) {
          setReady(false)
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') retry(status, error)
        }
      })
    })()
    return () => {
      cancelled = true; abort.abort(); slotCtrl.abort()
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (stableTimer !== null) window.clearTimeout(stableTimer)
      releaseSlot?.(); channelRef.current = null
      const old = ch; if (old) void getSupabaseClient().then((client) => client.removeChannel(old))
    }
  }, [instanceId, selfId, hostUserId, applyState, channelAttempt])

  useEffect(() => {
    if (state.status !== 'playing' || !state.players.some((p) => p.isAI && p.color === state.turn) || state.hostId !== selfId || !isGameHostAuthority(channelRef.current, state.hostId)) return
    let cancelled=false
    const timer=window.setTimeout(async()=>{
      const current=stateRef.current,ai=current.players.find(p=>p.isAI&&p.color===current.turn)
      if(!ai)return
      const chessLegal=legalMoves(current) as { from: Square; to: Square; promotion?: string }[]
      const {annotatedMoves: chessHints2, threatSummary: chessThreat2}=buildChessHints(current, chessLegal)
      const position={board:current.board,turn:current.turn,castling:current.castling,enPassant:current.enPassant,halfmove:current.halfmove,round:current.round,lastMove:current.lastMove,history:(current.moveHistory??[]).slice(-12),threatSummary: chessThreat2, annotatedMoves: chessHints2}
      let move: ReturnType<typeof chooseChessAiMove> = null
      if((current.aiMode??'local')==='cloud'){
        try { move=await requestCloudMove('chess',current.instanceId,position,chessLegal,()=>isGameHostAuthority(channelRef.current,current.hostId)) } catch { /* use local AI */ }
      }
      if(cancelled||stateRef.current!==current||current.hostId!==selfId||!isGameHostAuthority(channelRef.current,current.hostId))return
      const afterCandidate=move?tryMove(current,ai.userId,move.from,move.to):null
      const fallbackMove=afterCandidate?null:chooseChessAiMove(current)
      const next=afterCandidate??(fallbackMove?tryMove(current,ai.userId,fallbackMove.from,fallbackMove.to):null)
      if(next){if(!afterCandidate)console.info('[game-ai] Applying local AI move for chess.');applyState({...next,aiSource:afterCandidate?'cloud':'local'})}
    },520)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [state, selfId, applyState])

  const myColor=state.players.find(player=>player.userId===selfId)?.color??null
  const isPlayer=myColor!==null
  const isMyTurn=myColor===state.turn
  const spectators=onlineMembers.filter(member=>!state.players.some(player=>player.userId===member.userId))
  const canJoin=!isPlayer&&state.players.length<2&&(state.status==='waiting'||state.status==='result')
  const canJoinAi=isPlayer&&state.players.length===1&&state.status==='waiting'
  const hasAi=state.players.some(player=>player.isAI)
  const aiIsThinking=state.status==='playing'&&state.players.some(player=>player.isAI&&player.color===state.turn)
  const hasHuman=state.players.some(player=>!player.isAI&&player.userId!==selfId)
  const waitingSolo=state.status==='waiting'&&state.players.length===1
  const canRestart=isPlayer&&(hasAi||state.status==='result')
  const canLeave=isPlayer&&(hasHuman||hasAi||waitingSolo)
  const statusHint=state.status==='waiting'
    ?state.players.length===0?t('等待玩家加入','Waiting for player'):isPlayer?t('等待玩家','Waiting for player'):t('欢迎你加入',"You're welcome to join")
    :state.status==='playing'?isPlayer?(isMyTurn?t('轮到你了','Your turn'):t('等待对手','Waiting for opponent')):t('观战中','Spectating'):''
  const targets=new Set(selected?legalMoves(state).filter(m=>m.from[0]===selected[0]&&m.from[1]===selected[1]).map(m=>`${m.to[0]}-${m.to[1]}`):[])

  const join=()=>{
    if(!selfId||joinStatus==='joining'||!ready)return
    setJoinStatus('joining')
    const player={userId:selfId,displayName,avatarUrl,avatarStyle,avatarSeed,color:'w' as Color,score:0}
    if(selfId===stateRef.current.hostId){applyState(joinChess(stateRef.current,player));setJoinStatus('idle');return}
    const send=channelRef.current?.send({type:'broadcast',event:'join',payload:player})
    void send?.then(result=>{if(result!=='ok'&&!stateRef.current.players.some(p=>p.userId===selfId))setJoinStatus('retry')})
    window.setTimeout(()=>{if(!stateRef.current.players.some(p=>p.userId===selfId))setJoinStatus('retry')},10000)
  }
  const joinAi=()=>{
    if(!selfId||!ready)return
    if(selfId===stateRef.current.hostId){
      const raw=addChessAi(stateRef.current)
      if(raw){
        const cached=getCachedAiMode()
        const next=cached?{...raw,aiMode:cached}:raw
        applyState(next)
      }
    }
    else void channelRef.current?.send({type:'broadcast',event:'ai',payload:{}})
  }
  const changeAiMode=(aiMode:'cloud'|'local')=>{
    setCachedAiMode(aiMode)
    const current=stateRef.current
    if(!selfId)return
    if(!current.players.some((p)=>p.isAI))return
    if(current.aiMode===aiMode)return
    if(current.hostId===selfId){
      if(isGameHostAuthority(channelRef.current,current.hostId))applyState({...current,aiMode})
      else void channelRef.current?.send({type:'broadcast',event:'ai-mode',payload:{mode:aiMode}})
    }else{
      void channelRef.current?.send({type:'broadcast',event:'ai-mode',payload:{mode:aiMode}})
    }
  }
  const rematch=()=>{if(!selfId||!ready)return;if(selfId===stateRef.current.hostId)applyState(restartChessRound(stateRef.current));else void channelRef.current?.send({type:'broadcast',event:'rematch',payload:{}})}
  const leave=()=>{
    if(!selfId||!ready)return
    setLeaveConfirmOpen(false)
    if(selfId===stateRef.current.hostId){const next=removeChessPlayer(stateRef.current,selfId);if(next)applyState(next)}
    else void channelRef.current?.send({type:'broadcast',event:'leave',payload:{userId:selfId}})
  }
  const onSquare=(r:number,c:number)=>{
    if(!selfId||!myColor||state.status!=='playing'||state.turn!==myColor)return
    const piece=state.board[r][c]
    if(selected&&targets.has(`${r}-${c}`)){
      const move={from:selected,to:[r,c] as [number,number]}
      if(selfId===stateRef.current.hostId){const next=tryMove(stateRef.current,selfId,move.from,move.to);if(next)applyState(next)}
      else void channelRef.current?.send({type:'broadcast',event:'move',payload:{userId:selfId,...move}})
      setSelected(null);return
    }
    setSelected(piece?.[0]===myColor?[r,c]:null)
  }
  const winner=state.players.find(player=>player.userId===state.winnerId)
  if(!isSupabaseConfigured())return <div className="chess-card"><p className="chess-empty">{t('游戏需要联网（Supabase）','Games require an online connection')}</p></div>

  return <div className="chess-card">
    <div className="chess-head">
      <div className="chess-heading"><span className="chess-title"><ChessCrownIcon size={17}/>{t('国际象棋','Chess')}</span>
        {statusHint&&(state.status==='playing'&&!isPlayer?<span className="chess-spectator-control"><button type="button" className="chess-status chess-spectator-trigger" aria-haspopup="dialog" aria-expanded={spectatorsOpen} onClick={()=>setSpectatorsOpen(value=>!value)}><span>{statusHint}{spectators.length?` (${spectators.length>99?'99+':spectators.length})`:''}</span></button>{spectatorsOpen&&<OnlineList members={spectators} placement="bottom" className="chess-spectator-pop" title={t('观战玩家','Spectators')} emptyText={t('暂无观战玩家','No spectators currently')} ownerSelector=".chess-spectator-control" onClose={()=>setSpectatorsOpen(false)}/>}</span>:<span className="chess-status">{statusHint}</span>)}
      </div><span className="chess-meta">{statusHint&&<i className="chess-status-dot" aria-hidden="true"/>}<span>{state.players.length}/2 {t('玩家','players')}</span></span>
      {(state.status === 'playing' || state.status === 'result') && (
        <GameCardMenu
          aiMode={state.aiMode ?? state.aiSource ?? getCachedAiMode() ?? 'local'}
          onChangeAiMode={changeAiMode}
          onToggleBoardStyle={() => showHintToast(t('界面切换敬请期待', 'UI switch coming soon'))}
          onAiTutor={() => setTutorOpen(true)}
        />
      )}
    </div>

    <div className="chess-players">{state.players.map(player=><div key={player.userId} className="chess-player-slot">
      {player.isAI?<AiAvatar/>:<AvatarBadge className="chess-player-avatar" size={30} look={{style:player.avatarStyle||'thumbs',seed:player.avatarSeed||player.userId,url:player.avatarUrl}}/>}
      <div className={`chess-player${player.userId===selfId?' is-self':''}${state.turn===player.color&&state.status==='playing'?' is-turn':''}`}>
        <span className={`chess-side-indicator${player.color==='w'?' is-white':' is-black'}`} role="img" aria-label={player.color==='w'?t('白方棋子','White pieces'):t('黑方棋子','Black pieces')} title={player.color==='w'?t('白方','White side'):t('黑方','Black side')}/>
        <span className="chess-player-name" title={player.displayName}><span className="chess-player-name-text">{player.displayName}</span>{player.isAI&&<AiSourceIcon source={state.aiMode??state.aiSource??'local'}/>}{player.isAI && <AiThinkingTimer active={aiIsThinking && player.color===state.turn} />}</span><span className="chess-player-score">{player.score}</span>
      </div>
    </div>)}</div>

    <div className="chess-result">{state.status==='result'?(winner?t('获胜：','Winner: ')+winner.displayName:t('平局','Draw')):''}</div>
    <div ref={boardRef} className={`chess-board${myColor==='b'?' chess-board--flipped':''}`} role="grid" aria-label={t('国际象棋棋盘','Chess board')}>
      {state.board.map((row,r)=>row.map((piece,c)=>{
        const isLast=state.lastMove?.from[0]===r&&state.lastMove.from[1]===c||state.lastMove?.to[0]===r&&state.lastMove.to[1]===c
        const isTarget=targets.has(`${r}-${c}`)
        const isTutorFrom=tutorHighlight?.from[0]===r&&tutorHighlight.from[1]===c
        const isTutorTo=tutorHighlight?.to[0]===r&&tutorHighlight.to[1]===c
        // 坐标标签始终跟随视角的视觉底边/左边：白方在下方时底边是 r=7、左边是 c=0；黑方在下方（棋盘翻转）时底边是 r=0、左边是 c=7
        const isFileEdge=myColor==='b'?r===0:r===7
        const isRankEdge=myColor==='b'?c===7:c===0
        return <button type="button" key={`${r}-${c}`} data-square={`${r}-${c}`} role="gridcell" aria-label={`${String.fromCharCode(97+c)}${8-r}`} className={`chess-square${(r+c)%2===0?' is-light':' is-dark'}${selected?.[0]===r&&selected[1]===c?' is-selected':''}${isTarget?' is-target':''}${isLast?' is-last':''}${isTutorFrom?' chess-tutor-hl-from':''}${isTutorTo?' chess-tutor-hl-to':''}`} onClick={()=>onSquare(r,c)}>
          <PieceArt piece={piece}/>{isFileEdge&&<small>{String.fromCharCode(97+c)}</small>}{isRankEdge&&<em>{8-r}</em>}
        </button>
      }))}
      {moveToast&&<div className={`chess-capture-toast${moveToastKind==='check'?' is-check':''}${moveToastKind==='winner'?' is-winner':''}`} role="status" aria-live="assertive">{moveToast}</div>}
      {startToast&&<div className="chess-start-toast" role="status" aria-live="assertive">{startToast}</div>}
      {hintToast&&<div className="chess-start-toast" role="status" aria-live="assertive">{hintToast}</div>}
    </div>

    <div className="chess-actions">
      {canJoin&&<button type="button" className="btn-accent" disabled={!ready||!selfId||joinStatus==='joining'} aria-busy={joinStatus==='joining'} onClick={join}>{!ready||!selfId?t('重新连接中…','Reconnecting…'):joinStatus==='joining'?t('正在加入…','Joining…'):joinStatus==='retry'?t('加入较慢，点击重试','Taking longer; tap to retry'):t('加入游戏','Join game')}</button>}
      {canJoinAi&&<button type="button" className="btn-accent" disabled={!ready||!selfId} onClick={joinAi}>{t('与 AI 对战','Play vs AI')}</button>}
      {canRestart&&<button type="button" className="btn-accent" disabled={!ready||!selfId} onClick={rematch}>{t('重新开始','Restart')}</button>}
      {canLeave&&<button type="button" className="btn-accent" disabled={!ready||!selfId} onClick={()=>setLeaveConfirmOpen(true)}>{t('离开房间','Leave room')}</button>}
    </div>

    {leaveConfirmOpen&&<div className="chess-confirm-backdrop" onClick={()=>setLeaveConfirmOpen(false)}><div className="chess-confirm" role="alertdialog" aria-modal="true" aria-labelledby="chess-confirm-title" onClick={event=>event.stopPropagation()}>
      <h3 id="chess-confirm-title">{t('离开这场对局？','Leave this game?')}</h3><p>{t('离开后棋盘会重置，你可以之后重新加入。','The board will reset when you leave. You can join again later.')}</p>
      <div className="chess-confirm-actions"><button type="button" className="chess-confirm-cancel" onClick={()=>setLeaveConfirmOpen(false)}>{t('继续游戏','Stay')}</button><button type="button" className="btn-accent" disabled={!ready} onClick={leave}>{t('离开房间','Leave room')}</button></div>
    </div></div>}
    <ChessTutorPanel open={tutorOpen} onClose={()=>setTutorOpen(false)} chessState={state} viewerColor={myColor} highlighted={tutorHighlight} onHighlight={setTutorHighlight} />
  </div>
}
