import { useEffect, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadMudState } from './cloudState'
import WorldMudGame from './WorldMudGame'
import { fallbackNextScene } from '../../lib/mudTemplates'
import type { MudState } from './types'
import './MudGame.css'

function isWorldInstance(id: string): boolean {
  return id === 'world' || id === 'main' || id.length < 12
}

export default function MudGame(props: GameComponentProps) {
  const { instanceId } = props
  // World MUD is the primary experience: any short/world id routes to the eternal realm
  if (isWorldInstance(instanceId)) {
    return <WorldMudGame {...props} instanceId="world" />
  }
  return <LegacyMudGame {...props} />
}

function LegacyMudGame({ instanceId, hostUserId }: GameComponentProps) {
  const [state, setState] = useState<MudState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    void loadMudState(instanceId, ac.signal).then(({ state: s }) => {
      if (ac.signal.aborted) return
      setState(s)
      setLoading(false)
    })
    return () => ac.abort()
  }, [instanceId])

  if (loading) return <div className="mud-card mud-loading">Loading adventure…</div>
  if (!state) return <div className="mud-card mud-empty">Adventure not found — it may have expired. Try the new world: ask the assistant for MUD.</div>

  const isZh = state.lang.startsWith('zh')
  const room = state.blueprint.rooms[Math.min(state.step, state.blueprint.rooms.length - 1)]
  const title = isZh ? state.blueprint.title : state.blueprint.titleEn

  return (
    <div className="mud-card">
      <div className="mud-header">
        <span className="mud-icon">🗺️</span>
        <span className="mud-title">{title} · {isZh ? '旧版' : 'Classic'}</span>
        <span className="mud-step">{state.step + 1} / {state.blueprint.rooms.length}</span>
      </div>
      <div className="mud-players">
        {state.invited.map((p) => (
          <span key={p.userId} className="mud-player-chip">{p.displayName}{p.role ? ` · ${p.role}` : ''}</span>
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
          <button key={c.action} className="mud-choice-btn" onClick={() => {
            const nextStep = state.step + 1
            const nextScene = fallbackNextScene(state.blueprint, nextStep, state.lang)
            setState({ ...state, step: nextStep, history: [...state.history, `> ${c.label}`, nextScene.text].slice(-20), scene: nextScene })
          }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="mud-progress">
        <div className="mud-progress-bar" style={{ width: `${((state.step + 1) / state.blueprint.rooms.length) * 100}%` }} />
      </div>
      <div className="mud-footer">
        <span className="mud-hint">{isZh ? '旧版存档，仅本地可玩。试试与助手对话进入永恒沙漏世界。' : 'Legacy save. Ask the assistant for the Eternal Hourglass world.'}</span>
        {hostUserId && state.step >= state.blueprint.rooms.length - 1 && (
          <span className="mud-finish">{isZh ? '🎉 冒险完成！' : '🎉 Adventure complete!'}</span>
        )}
      </div>
    </div>
  )
}
