/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLang, t, useLang } from '../../lib/i18n'
import { useImeEnter } from '../../lib/ime'
import { legalMoves } from './logic'
import type { ChessState, Square } from './logic'
import { buildChessHints } from './cloudHints'
import { requestChessTutor, type TutorResult } from '../cloudAi'

type Move = { from: Square; to: Square; promotion?: string }

function algebraic(sq: Square): string {
  return `${String.fromCharCode(97 + sq[1])}${8 - sq[0]}`
}

function moveLabel(m: Move): string {
  return `${algebraic(m.from)}→${algebraic(m.to)}${m.promotion ? `=${m.promotion.toUpperCase()}` : ''}`
}

function ExpandableText({ text, limit = 180 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  const isLong = text.length > limit
  const display = !isLong || expanded ? text : `${text.slice(0, limit)}…`
  return (
    <span className="chess-tutor-expandable">
      <span>{display}</span>
      {isLong && (
        <button type="button" className="chess-tutor-expand-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t('收起', 'Show less') : t('展开', 'Show more')}
        </button>
      )}
    </span>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  chessState: ChessState
  viewerColor?: 'w' | 'b' | null
  highlighted: Move | null
  onHighlight: (m: Move | null) => void
}

export default function ChessTutorPanel({ open, onClose, chessState, viewerColor = null, highlighted, onHighlight }: Props) {
  useLang()
  const ime = useImeEnter()
  const [data, setData] = useState<TutorResult<Move> | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const lang = getLang()
  const cacheRef = useRef<Map<string, TutorResult<Move>>>(new Map())
  const fetchIdRef = useRef(0)

  const positionKey = `${chessState.turn}:${viewerColor ?? '-'}:${chessState.castling}:${chessState.enPassant?.join(',') ?? '-'}:${chessState.halfmove}:${chessState.lastMove?.from.join(',') ?? ''}->${chessState.lastMove?.to.join(',') ?? ''}:${chessState.moveHistory?.length ?? 0}`

  const doFetch = useCallback(async (q?: string) => {
    const moves = legalMoves(chessState) as Move[]
    if (moves.length === 0) { setErrorMsg(t('暂无推荐走法', 'No recommendations available')); setStatus('error'); return }
    const key = `${positionKey}:${lang}:${q ?? ''}`
    const cached = !q ? cacheRef.current.get(key) : undefined
    if (cached) { setData(cached); setStatus('ready'); return }
    // Ensure loading is visible synchronously before async work
    setStatus('loading'); setErrorMsg(''); setSelectedIdx(null)
    const fid = ++fetchIdRef.current
    try {
      const { annotatedMoves, threatSummary } = buildChessHints(chessState, moves as { from: Square; to: Square; promotion?: string }[])
      const position = {
        board: chessState.board, turn: chessState.turn, viewerColor, castling: chessState.castling,
        enPassant: chessState.enPassant, halfmove: chessState.halfmove, round: chessState.round,
        lastMove: chessState.lastMove, history: (chessState.moveHistory ?? []).slice(-12),
        threatSummary, annotatedMoves,
      }
      const res = await requestChessTutor('chess', chessState.instanceId, position, moves, { locale: lang, question: q })
      if (fid !== fetchIdRef.current) return
      cacheRef.current.set(key, res)
      setData(res); setStatus('ready')
    } catch (e) {
      if (fid !== fetchIdRef.current) return
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [chessState, positionKey, lang])

  // Single effect: open/position change => reset and fetch, close => reset
  useEffect(() => {
    if (!open) {
      setStatus('idle'); setData(null); setErrorMsg(''); setQuestion(''); setAsking(false); setSelectedIdx(null); onHighlight(null)
      return
    }
    // Opened: check cache first, otherwise show loading immediately
    const key = `${positionKey}:${lang}:`
    const cached = cacheRef.current.get(key)
    if (cached) { setData(cached); setStatus('ready'); return }
    setStatus('loading'); setData(null); setErrorMsg(''); setSelectedIdx(null); onHighlight(null)
    void doFetch()
  }, [open, positionKey, lang, doFetch, onHighlight])

  // close on Esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleAsk = async () => {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    setStatus('loading')
    try {
      const moves = legalMoves(chessState) as Move[]
      const { annotatedMoves, threatSummary } = buildChessHints(chessState, moves as { from: Square; to: Square; promotion?: string }[])
      const position = {
        board: chessState.board, turn: chessState.turn, viewerColor, castling: chessState.castling,
        enPassant: chessState.enPassant, halfmove: chessState.halfmove, round: chessState.round,
        lastMove: chessState.lastMove, history: (chessState.moveHistory ?? []).slice(-12),
        threatSummary, annotatedMoves,
      }
      const res = await requestChessTutor('chess', chessState.instanceId, position, moves, { locale: lang, question: q })
      const key = `${positionKey}:${lang}:${q}`
      cacheRef.current.set(key, res)
      setData(res); setStatus('ready'); setQuestion('')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e)); setStatus('error')
    } finally { setAsking(false) }
  }

  const handlePick = (idx: number, m: Move) => {
    if (selectedIdx === idx) { setSelectedIdx(null); onHighlight(null) }
    else { setSelectedIdx(idx); onHighlight(m) }
  }

  if (!open) return null

  const content = (
    <div className="chess-tutor-backdrop" role="presentation" onClick={onClose}>
      <div className="chess-tutor-panel" role="dialog" aria-modal="true" aria-label={t('AI 教学', 'AI Tutor')} onClick={(e) => e.stopPropagation()}>
        <div className="chess-tutor-head">
          <h3 className="chess-tutor-title">{t('AI 教学', 'AI Tutor')}</h3>
          <button type="button" className="chess-tutor-close" aria-label={t('关闭', 'Close')} onClick={onClose}>×</button>
        </div>

        {status === 'loading' && (
          <div className="chess-tutor-loading" role="status" aria-live="polite">
            <span className="chess-tutor-spinner" aria-hidden="true" />
            <span>{t('AI 导师分析中…', 'AI Tutor is analyzing...')}</span>
          </div>
        )}

        {status === 'error' && (
          <div className="chess-tutor-error" role="alert">
            <p>{t('导师暂时不可用，请重试', 'Tutor unavailable, try again')}</p>
            <p className="chess-tutor-error-detail">{errorMsg}</p>
            <button type="button" className="btn-accent chess-tutor-retry" onClick={() => doFetch()}>{t('重新分析', 'Retry analysis')}</button>
          </div>
        )}

        {status === 'ready' && data && (
          <div className="chess-tutor-body">
            {data.answer && (
              <section className="chess-tutor-section is-answer">
                <h4>{t('导师回复：', 'Your question answered:')}</h4>
                <p><ExpandableText text={data.answer} limit={200} /></p>
              </section>
            )}
            <section className="chess-tutor-section">
              <h4>{t('局势总览', 'Situation overview')}</h4>
              <p><ExpandableText text={data.situation} limit={200} /></p>
            </section>
            {data.keyThreats && (
              <section className="chess-tutor-section">
                <h4>{t('关键威胁', 'Key threats')}</h4>
                <p><ExpandableText text={data.keyThreats} limit={200} /></p>
              </section>
            )}
            <section className="chess-tutor-section">
              <h4>{t('推荐走法', 'Top recommendations')}</h4>
              {data.recommendations.length === 0 ? <p className="chess-tutor-empty">{t('暂无推荐走法', 'No recommendations available')}</p> : (
                <ul className="chess-tutor-recs">
                  {data.recommendations.map((rec, i) => (
                    <li key={`${moveLabel(rec.move as Move)}-${i}`} className={`chess-tutor-rec${selectedIdx === i ? ' is-selected' : ''}${highlighted && moveLabel(highlighted) === moveLabel(rec.move as Move) ? ' is-active' : ''}`}>
                      <button type="button" className="chess-tutor-rec-btn" onClick={() => handlePick(i, rec.move as Move)}>
                        <span className="chess-tutor-rec-move">{moveLabel(rec.move as Move)}</span>
                        {rec.label && <span className="chess-tutor-rec-tag">{rec.label}</span>}
                      </button>
                      <p className="chess-tutor-rec-reason"><ExpandableText text={rec.reason} limit={160} /></p>
                      <span className="chess-tutor-rec-hint">{t('点击在棋盘上高亮', 'Tap to highlight on board')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {data.conceptTip && (
              <section className="chess-tutor-section">
                <h4>{t('新手小课堂', 'Concept lesson')}</h4>
                <p><ExpandableText text={data.conceptTip} limit={260} /></p>
              </section>
            )}
            {data.lastMoveReview && data.lastMoveReview.quality !== 'none' && (
              <section className="chess-tutor-section">
                <h4>{t('上一步点评', 'Last move review')} <span className={`chess-tutor-quality is-${data.lastMoveReview.quality}`}>{data.lastMoveReview.quality === 'good' ? t('不错', 'Good') : data.lastMoveReview.quality === 'mistake' ? t('失误', 'Mistake') : t('一般', 'OK')}</span></h4>
                <p><ExpandableText text={data.lastMoveReview.comment} limit={180} /></p>
                {data.lastMoveReview.betterMove && (
                  <p className="chess-tutor-better">{t('更好的走法：', 'Better move:')} <strong>{moveLabel(data.lastMoveReview.betterMove as Move)}</strong></p>
                )}
              </section>
            )}
            {data.encouragement && <p className="chess-tutor-encouragement">✦ {data.encouragement}</p>}
          </div>
        )}

        <div className="chess-tutor-ask">
          <div className="chess-tutor-ask-row">
            <input
              {...ime.imeProps}
              className="chess-tutor-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('询问这个局面…', 'Ask about this position...')}
              onKeyDown={(e) => {
                if (ime.imeConsumesEnter(e)) return
                if (e.key === 'Enter') { e.preventDefault(); void handleAsk() }
              }}
              aria-label={t('问导师', 'Ask the tutor')}
            />
            <button type="button" className="btn-accent chess-tutor-send" disabled={!question.trim() || asking} onClick={handleAsk}>
              {asking ? t('导师思考中…', 'Tutor is thinking...') : t('发送', 'Send')}
            </button>
          </div>
          <div className="chess-tutor-actions">
            <button type="button" className="chess-tutor-ghost" onClick={() => doFetch()} disabled={status === 'loading'}>{t('重新分析', 'Retry analysis')}</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  const portalTarget = (typeof document !== 'undefined' && document.querySelector('.app-shell')) || document.body
  return createPortal(content, portalTarget as Element)
}
