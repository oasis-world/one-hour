// Open-world MUD card — slim tabbed layout (Puzzle / Map / Tasks / Guide).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadSnapshot } from './openWorldStore'
import { tOpen } from './openWorldI18n'
import { useLang } from '../../lib/i18n'
import { loadUserProfile } from '../../lib/userProfile'
import { roomNameOf, districtNameOf } from '../../lib/worldI18n'
import { WorldSnapshot } from './WorldSnapshot'
import { useTranslatedTexts } from './useTranslated'
import { PuzzleRowItem, TaskComposer, GuidePanel } from './OpenWorldPanels'
import { TideGenesisIcon } from './MudIcons'
import './WorldMudGame.css'

type Tab = 'puzzle' | 'map' | 'tasks' | 'guide'

export default function WorldMudGame({ onlineMembers }: GameComponentProps) {
  const lang = useLang()
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? 'Traveler'
  const [snap, setSnap] = useState<Awaited<ReturnType<typeof loadSnapshot>>['snap'] | null>(null)
  const [userId, setUserId] = useState('')
  const [roomId, setRoomId] = useState('plaza_center')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('puzzle')

  const refresh = useCallback(async () => {
    const { snap: s, userId: uid } = await loadSnapshot(displayName, lang)
    setSnap(s); setUserId(uid)
    if (s.rooms.some((r) => r.id === 'plaza_center')) setRoomId('plaza_center')
    setLoading(false)
  }, [displayName, lang])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { snap: s, userId: uid } = await loadSnapshot(displayName, lang)
      if (cancelled) return
      setSnap(s); setUserId(uid)
      if (s.rooms.some((r) => r.id === 'plaza_center')) setRoomId('plaza_center')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [displayName, lang])

  const onlineCount = useMemo(() => onlineMembers?.length ?? 0, [onlineMembers])
  const room = useMemo(() => snap?.rooms.find((r) => r.id === roomId) ?? null, [snap, roomId])
  const regionId = room?.region_id ?? 'plaza'
  const puzzlesHere = useMemo(() => {
    if (!snap) return []
    return snap.puzzles.filter((p) => p.room_id === roomId || p.region_id === regionId)
  }, [snap, roomId, regionId])
  const tasksHere = useMemo(() => (snap ? snap.tasks : []), [snap])

  if (loading || !snap) {
    return (
      <div className="world-mud-card world-mud-loading">
        <div className="world-mud-loading-orb" aria-hidden="true"><span /></div>
        <div className="world-mud-loading-text">{tOpen(lang, 'loading')}</div>
      </div>
    )
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'puzzle', label: tOpen(lang, 'tabPuzzle'), count: puzzlesHere.length },
    { id: 'map', label: tOpen(lang, 'tabMap') },
    { id: 'tasks', label: tOpen(lang, 'tabQuest'), count: tasksHere.length },
    { id: 'guide', label: tOpen(lang, 'tabGuide') },
  ]

  return (
    <div className="world-mud-card" role="article" aria-label={tOpen(lang, 'worldTitle')}>
      <div className="world-mud-head">
        <div className="world-mud-head-main">
          <span className="world-mud-icon"><TideGenesisIcon size={22} /></span>
          <div className="world-mud-head-text">
            <span className="world-mud-title">{tOpen(lang, 'worldTitle')}</span>
            <span className="world-mud-loc">{districtNameOf(regionId, lang)} · {roomNameOf(roomId, lang)}</span>
          </div>
        </div>
      </div>

      <WorldSnapshot snap={snap} onlineCount={onlineCount} />

      <div className="wmf-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`wmf-tab ${tab === t.id ? 'is-on' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}{t.count != null ? ` ${t.count}` : ''}
          </button>
        ))}
      </div>

      {tab === 'puzzle' && (
        <div className="wmf-puzzles">
          {puzzlesHere.length === 0 && <div className="world-mud-online-pop-empty">{tOpen(lang, 'noLogYet')}</div>}
          {puzzlesHere.slice(0, 4).map((p) => (
            <PuzzleRowItem key={p.id} puzzle={p} snap={snap} userId={userId}
              solved={snap.mySolvedIds.includes(p.id)}
              onSolved={() => void refresh()} />
          ))}
          {snap.items.length > 0 && <EquipmentRow snap={snap} />}
        </div>
      )}

      {tab === 'map' && (
        <div className="world-mud-map"><div className="world-mud-map-grid">
          {snap.rooms.map((r) => (
            <button key={r.id} className={`world-mud-map-room ${r.id === roomId ? 'is-active' : ''}`}
              onClick={() => { setRoomId(r.id); setTab('puzzle') }}>{roomNameOf(r.id, lang)}</button>
          ))}
        </div></div>
      )}

      {tab === 'tasks' && <TaskComposer snap={snap} userId={userId} roomId={roomId} onCreated={() => void refresh()} />}
      {tab === 'guide' && <GuidePanel snap={snap} userId={userId} />}
    </div>
  )
}

function EquipmentRow({ snap }: { snap: import('./openWorldTypes').OpenWorldSnapshot }) {
  const lang = useLang()
  const profile = snap.myProfile
  const ownedIds = new Set<string>([
    ...Object.values(profile?.equipped ?? {}),
    ...snap.puzzles.filter((p) => snap.mySolvedIds.includes(p.id) && p.reward_item_id).map((p) => p.reward_item_id as string),
  ])
  const owned = snap.items.filter((it) => ownedIds.has(it.id))
  const shown = owned.slice(0, 4)
  const tr = useTranslatedTexts(
    shown.flatMap((it) => {
      const name = langFamilyItem(it, lang)
      return name ? [{ id: `${it.id}-n`, text: name }] : []
    }),
    lang,
  )
  if (owned.length === 0) return null
  return (
    <div className="wmf-equiprow wmf-equiprow-owned">
      <span className="wmf-equiprow-label">{tOpen(lang, 'ownedGear')} {owned.length}</span>
      {shown.map((it) => {
        const name = langFamilyItem(it, lang)
        return <span key={it.id} className={`wmf-item rarity-${it.rarity}`} title={tr[`${it.id}-n`] ?? name ?? it.name}>{it.icon}</span>
      })}
    </div>
  )
}

function langFamilyItem(it: import('./openWorldTypes').ItemRow, lang: string): string | null {
  if (lang.startsWith('zh')) return it.name
  return it.name_en ?? it.name
}
