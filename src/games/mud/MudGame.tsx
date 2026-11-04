import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadMudState, saveMudProgress } from './cloudState'
import { fallbackNextScene } from '../../lib/mudTemplates'
import type { MudState } from './types'
import './MudGame.css'

export default function MudGame({ instanceId, hostUserId }: GameComponentProps) {
  const [state, setState] = useState<MudState | null>(null)
  const [loading, setLoading] = useState(true)
  const [choosing, setChoosing] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading reset on instance change
    setLoading(true)
    void loadMudState(instanceId, ac.signal).then(({ state: s }) => {
      if (ac.signal.aborted) return
      setState(s)
      setLoading(false)
    })
    return () => ac.abort()
  }, [instanceId])

  const isHost = hostUserId === instanceId || !state ? true : false

  const handleChoice = useCallback(async (action: string) => {
    if (!state || choosing) return
    setChoosing(action)
    const nextStep = state.step + 1
    const nextScene = fallbackNextScene(state.blueprint, nextStep, state.lang)
    const next: MudState = {
      ...state,
      step: nextStep,
      history: [...state.history, `> ${action}`, nextScene.text].slice(-20),
      scene: nextScene,
    }
    setState(next)
    await saveMudProgress(instanceId, next)
    setChoosing(null)
  }, [state, choosing, instanceId])

  const title = useMemo(() => {
    if (!state) return 'MUD'
    const isZh = state.lang.startsWith('zh')
    return isZh ? state.blueprint.title : state.blueprint.titleEn
  }, [state])

  if (loading) return <div className="mud-card mud-loading">Loading adventure…</div>
  if (!state) return <div className="mud-card mud-empty">Adventure not found — it may have expired.</div>

  const isZh = state.lang.startsWith('zh')
  const room = state.blueprint.rooms[Math.min(state.step, state.blueprint.rooms.length - 1)]

  return (
    <div className="mud-card">
      <div className="mud-header">
        <span className="mud-icon">🗺️</span>
        <span className="mud-title">{title}</span>
        <span className="mud-step">{state.step + 1} / {state.blueprint.rooms.length}</span>
      </div>
      <div className="mud-players">
        {state.invited.map((p) => (
          <span key={p.userId} className="mud-player-chip" title={p.role ?? ''}>{p.displayName}{p.role ? ` · ${p.role}` : ''}</span>
        ))}
      </div>
      <div className="mud-room-name">{isZh ? room.name : room.nameEn}</div>
      <div className="mud-scene">{state.scene.text}</div>
      <div className="mud-history">
        {state.history.slice(-4, -1).map((h, i) => (
          <div key={i} className="mud-history-line">{h}</div>
        ))}
      </div>
      <div className="mud-choices">
        {state.scene.choices.map((c) => (
          <button key={c.action} className="mud-choice-btn" disabled={!!choosing} onClick={() => void handleChoice(c.action)}>
            {choosing === c.action ? (isZh ? '…' : '…') : c.label}
          </button>
        ))}
      </div>
      <div className="mud-progress">
        <div className="mud-progress-bar" style={{ width: `${((state.step + 1) / state.blueprint.rooms.length) * 100}%` }} />
      </div>
      <div className="mud-footer">
        <span className="mud-hint">{isZh ? '点击选项推进故事（所有人共享进度）' : 'Tap a choice to advance — progress is shared'}</span>
        {isHost && state.step >= state.blueprint.rooms.length - 1 && (
          <span className="mud-finish">{isZh ? '🎉 冒险完成！' : '🎉 Adventure complete!'}</span>
        )}
      </div>
    </div>
  )
}
