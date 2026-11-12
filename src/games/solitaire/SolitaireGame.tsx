import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { GameComponentProps } from '../types'
import { t, useLang } from '../../lib/i18n'
import CardArt from './CardArt'
import { autoFoundation, autoFoundationStep, drawCards, moveToFoundation, moveToTableau, newGame, rankLabel, SUITS, topCard, undo, type Card, type SolitaireState, type Source } from './model'
import SolitaireIcon from './SolitaireIcon'
import SuitMark from './SuitMark'
import './SolitaireGame.css'

type Selection = { source: Source; startIndex?: number }
type CardFlight = { card: Card; next: SolitaireState; left: number; top: number; width: number; height: number; dx: number; dy: number; scale: number; moving: boolean }
const keyFor = (id: string) => `solitaire:${id}`
const cardName = (card: Card) => `${rankLabel(card.rank)}${card.suit}`

function loadGame(id: string): SolitaireState | null {
  try {
    const saved = localStorage.getItem(keyFor(id))
    if (!saved) return null
    const value = JSON.parse(saved) as SolitaireState
    if (!Array.isArray(value.stock) || !Array.isArray(value.waste) || !Array.isArray(value.tableau) || value.tableau.length !== 7 || !Array.isArray(value.foundations) || value.foundations.length !== 4 || (value.drawCount !== 1 && value.drawCount !== 3) || !Number.isFinite(value.startedAt)) return null
    return value
  } catch { return null }
}

function timeLabel(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function SolitaireGame({ instanceId }: GameComponentProps) {
  useLang()
  const [state, setState] = useState(() => {
    const saved = loadGame(instanceId)
    return saved ? { ...saved, drawCount: 1 as const } : newGame(1)
  })
  const [selection, setSelection] = useState<Selection | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [flight, setFlight] = useState<CardFlight | null>(null)
  const [autoCompleting, setAutoCompleting] = useState(false)
  const shellRef = useRef<HTMLElement>(null)
  const stockRef = useRef<HTMLButtonElement>(null)
  const wasteRef = useRef<HTMLDivElement>(null)
  const flightFinishedRef = useRef(false)
  const autoCompletingRef = useRef(false)
  const pendingCardPositionsRef = useRef<Map<string, DOMRect> | null>(null)

  useEffect(() => {
    try { localStorage.setItem(keyFor(instanceId), JSON.stringify(state)) } catch { /* Local storage may be unavailable. */ }
  }, [instanceId, state])
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - state.startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [state.startedAt])
  const scoreLabel = useMemo(() => String(state.score).padStart(3, '0'), [state.score])
  const commit = (next: SolitaireState) => {
    if (next !== state) { setState(next); setSelection(null) }
  }
  const commitMove = useCallback((next: SolitaireState) => {
    if (next === state) return
    const positions = new Map<string, DOMRect>()
    shellRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((element) => {
      if (element.dataset.cardId) positions.set(element.dataset.cardId, element.getBoundingClientRect())
    })
    pendingCardPositionsRef.current = positions
    setState(next)
    setSelection(null)
  }, [state])
  useEffect(() => {
    if (
      autoCompletingRef.current || autoCompleting || flight || state.won || state.stock.length > 0 ||
      state.tableau.some((pile) => pile.some((card) => !card.faceUp))
    ) return
    if (!autoFoundation(state).won) return
    const timer = window.setTimeout(() => {
      autoCompletingRef.current = true
      setAutoCompleting(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, flight, autoCompleting])
  useEffect(() => {
    if (!autoCompleting) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reducedMotion ? 80 : 520
    const timer = window.setTimeout(() => {
      if (state.won) {
        autoCompletingRef.current = false
        setAutoCompleting(false)
        return
      }
      const next = autoFoundationStep(state)
      if (next === state) {
        autoCompletingRef.current = false
        setAutoCompleting(false)
        return
      }
      commitMove(next)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [autoCompleting, state, commitMove])
  const selectWaste = () => {
    if (autoCompleting || !state.waste.length) return
    const source: Source = { zone: 'waste', index: 0 }
    setSelection({ source })
  }
  const chooseTableau = (column: number, cardIndex?: number) => {
    if (autoCompleting) return
    if (selection) {
      const next = moveToTableau(state, selection.source, column, selection.startIndex)
      if (next !== state) {
        commitMove(next)
        return
      }
    }
    if (cardIndex !== undefined && state.tableau[column][cardIndex]?.faceUp) setSelection({ source: { zone: 'tableau', index: column }, startIndex: cardIndex })
    else if (!state.tableau[column].length && selection) commitMove(moveToTableau(state, selection.source, column, selection.startIndex))
  }
  const chooseFoundation = (index: number) => {
    if (autoCompleting) return
    if (selection) commitMove(moveToFoundation(state, selection.source, index))
    else if (state.foundations[index].length) setSelection({ source: { zone: 'foundation', index } })
  }
  const doubleToFoundation = (source: Source) => {
    if (autoCompleting) return
    const card = topCard(state, source)
    if (!card) return
    const index = state.foundations.findIndex((pile) => pile.length
      ? pile.at(-1)!.suit === card.suit && pile.at(-1)!.rank + 1 === card.rank
      : card.rank === 1)
    if (index >= 0) commitMove(moveToFoundation(state, source, index))
  }
  const restart = () => {
    autoCompletingRef.current = false
    setAutoCompleting(false)
    setState(newGame(1))
    setSelection(null)
    setSeconds(0)
  }
  const handleStock = () => {
    if (autoCompleting) return
    const next = drawCards(state)
    if (next === state) return
    if (!state.stock.length) { commit(next); return }
    const card = next.waste.at(-1)
    const stockRect = stockRef.current?.getBoundingClientRect()
    const wasteRect = wasteRef.current?.getBoundingClientRect()
    const shell = shellRef.current
    if (!card || !stockRect || !wasteRect || !shell) { commit(next); return }
    const shellRect = shell.getBoundingClientRect()
    const baseLeft = shellRect.left + shell.clientLeft
    const baseTop = shellRect.top + shell.clientTop
    const visibleIndex = Math.min(state.waste.length, 2)
    const scale = wasteRect.width * .5 / stockRect.width
    const left = stockRect.left - baseLeft
    const top = stockRect.top - baseTop
    const targetLeft = wasteRect.left - baseLeft + wasteRect.width * visibleIndex * .15
    const targetTop = wasteRect.top - baseTop
    flightFinishedRef.current = false
    setFlight({ card, next, left, top, width: stockRect.width, height: stockRect.height, dx: targetLeft - left, dy: targetTop - top, scale, moving: false })
    requestAnimationFrame(() => setFlight((current) => current ? { ...current, moving: true } : current))
  }
  const finishFlight = useCallback((active: CardFlight) => {
    if (flightFinishedRef.current) return
    flightFinishedRef.current = true
    setState(active.next)
    setSelection(null)
    setFlight(null)
  }, [])

  useEffect(() => {
    if (!flight?.moving) return
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900
    const timer = window.setTimeout(() => finishFlight(flight), duration)
    return () => window.clearTimeout(timer)
  }, [flight, finishFlight])

  useLayoutEffect(() => {
    const previous = pendingCardPositionsRef.current
    if (!previous) return
    pendingCardPositionsRef.current = null
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500
    if (!duration) return
    shellRef.current?.querySelectorAll<HTMLElement>('[data-card-id]').forEach((element, index) => {
      const cardId = element.dataset.cardId
      const from = cardId ? previous.get(cardId) : undefined
      if (!from) return
      const to = element.getBoundingClientRect()
      const dx = from.left - to.left
      const dy = from.top - to.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      const previousZIndex = element.style.zIndex
      const raisedZIndex = String(1000 + index)
      element.style.zIndex = raisedZIndex
      const animation = element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(.96)` },
          { transform: `translate(${dx * .52}px, ${dy * .52}px) scale(1.08)`, offset: .55 },
          { transform: 'translate(0, 0) scale(1)' },
        ],
        { duration, easing: 'cubic-bezier(.2,.75,.25,1)' },
      )
      const restoreZIndex = () => {
        if (element.style.zIndex === raisedZIndex) element.style.zIndex = previousZIndex
      }
      animation.onfinish = restoreZIndex
      animation.oncancel = restoreZIndex
    })
  }, [state])

  return <section ref={shellRef} className="solitaire-card" aria-label={t('空当接龙纸牌游戏', 'Klondike Solitaire')}>
    <header className="sol-header">
      <div className="sol-title-lockup"><span className="sol-mark"><SolitaireIcon size={31} /></span><span><strong>{t('纸牌接龙', 'Solitaire')}</strong><small>{t('经典 · 克朗代克', 'CLASSIC · KLONDIKE')}</small></span></div>
      <div className="sol-score-controls">
        <div className="sol-tools sol-head-actions">
          <button type="button" className="sol-action-button sol-undo-button" onClick={() => { setState(undo(state)); setSelection(null) }} disabled={!state.past.length || autoCompleting} aria-label={t('撤销上一步', 'Undo last move')} title={t('撤销上一步', 'Undo last move')}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.2 5.2 3.8 8.4l3.4 3.2M4.2 8.4h6a5 5 0 1 1-4.4 7.3" /></svg>
          </button>
          <button type="button" className="sol-action-button sol-new-deal" onClick={restart} aria-label={t('新牌局', 'New deal')} title={t('新牌局', 'New deal')}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M3 10h14" /></svg>
          </button>
        </div>
        <div className="sol-stats"><span><small>{t('分数', 'SCORE')}</small><b>{scoreLabel}</b></span><i /><span><small>{t('时间', 'TIME')}</small><b>{timeLabel(seconds)}</b></span></div>
      </div>
    </header>
    <div className="sol-top-row">
      <button ref={stockRef} type="button" className={`sol-pile sol-stock${!state.stock.length ? ' is-empty' : ''}`} onClick={handleStock} disabled={Boolean(flight) || autoCompleting} aria-label={state.stock.length ? t('抽牌', 'Draw cards') : t('重新翻开牌堆', 'Recycle stock')}>
        {state.stock.length ? <CardArt back /> : <span className="sol-recycle">↻</span>}
        <small>{state.stock.length || (state.waste.length ? '↻' : '—')}</small>
      </button>
      <div ref={wasteRef} className="sol-waste" aria-label={t('弃牌堆', 'Waste pile')}>
        {state.waste.slice(-3).map((card, index, visible) => {
          const realIndex = state.waste.length - visible.length + index
          const top = realIndex === state.waste.length - 1
          return <button key={card.id} data-card-id={card.id} type="button" className={`sol-pile sol-waste-card${top ? ' is-top' : ''}${selection?.source.zone === 'waste' && top ? ' is-selected' : ''}`} style={{ left: `${index * 15}%` }} onClick={top ? selectWaste : undefined} onDoubleClick={top ? () => doubleToFoundation({ zone: 'waste', index: 0 }) : undefined} aria-label={cardName(card)} disabled={!top || autoCompleting}>
            <span className="sol-waste-flip-inner">
              <span className="sol-card-back-face"><CardArt back /></span>
              <span className="sol-card-front-face"><CardArt card={card} /></span>
            </span>
          </button>
        })}
      </div>
      <div className="sol-foundations" aria-label={t('基础牌堆', 'Foundations')}>
        {state.foundations.map((pile, index) => <button key={index} data-card-id={pile.at(-1)?.id} type="button" className={`sol-pile sol-foundation${selection?.source.zone === 'foundation' && selection.source.index === index ? ' is-selected' : ''}`} onClick={() => chooseFoundation(index)} disabled={autoCompleting} aria-label={pile.at(-1) ? `${t('基础牌堆', 'Foundation')} ${cardName(pile.at(-1)!)}` : t('空基础牌堆', 'Empty foundation')}>
          {pile.length ? <CardArt card={pile.at(-1)} /> : <span><SuitMark suit={SUITS[index]} size={27} /></span>}
        </button>)}
      </div>
    </div>
    <div className="sol-tableau" aria-label={t('桌面牌列', 'Tableau')}>
      {state.tableau.map((pile, column) => <div key={column} className={`sol-column${pile.length ? '' : ' is-empty'}`} onClick={() => chooseTableau(column)}>
        {pile.map((card, index) => {
          const isSelected = selection?.source.zone === 'tableau' && selection.source.index === column && index >= (selection.startIndex ?? -1)
          const top = index === pile.length - 1
          const offset = pile.slice(0, index).reduce((total, previous) => total + (previous.faceUp ? 21 : 14), 0)
          return <button key={card.id} data-card-id={card.id} type="button" className={`sol-pile sol-tableau-card${card.faceUp ? ' is-face-up' : ' is-face-down'}${isSelected ? ' is-selected' : ''}`} style={{ top: `${offset}px`, zIndex: index + 1 }} onClick={(event) => { event.stopPropagation(); if (card.faceUp) chooseTableau(column, index) }} onDoubleClick={index === pile.length - 1 ? () => doubleToFoundation({ zone: 'tableau', index: column }) : undefined} aria-label={card.faceUp ? cardName(card) : t('盖着的牌', 'Face-down card')} disabled={!card.faceUp || autoCompleting}>
            <span className="sol-card-flip-inner">
              <span className="sol-card-back-face"><CardArt back /></span>
              <span className="sol-card-front-face"><CardArt card={card} /></span>
            </span>
            {top && card.faceUp && <span className="sol-card-glint" />}
          </button>
        })}
        {!pile.length && <span className="sol-king-mark">K</span>}
      </div>)}
    </div>
    {flight && <div
      className={`sol-flight-card${flight.moving ? ' is-moving' : ''}`}
      style={{ left: flight.left, top: flight.top, width: flight.width, height: flight.height, transform: flight.moving ? `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.scale})` : undefined }}
      onTransitionEnd={(event) => { if (event.propertyName === 'transform') finishFlight(flight) }}
      aria-hidden="true"
    >
      <span className={`sol-flight-flip-inner${flight.moving ? ' is-flipping' : ''}`}>
        <span className="sol-card-back-face"><CardArt back /></span>
        <span className="sol-card-front-face"><CardArt card={flight.card} /></span>
      </span>
    </div>}
    {state.won && !autoCompleting && <div className="sol-win-message" role="status">{t('漂亮！你完成了这局！', 'Beautiful! You won!')}</div>}
    {state.won && !autoCompleting && <div className="sol-win-glow" aria-hidden="true">✦</div>}
  </section>
}
