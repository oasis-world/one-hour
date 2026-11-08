// Open-world MUD card — Tide Genesis (normalized tables, 10-lang UI).
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadSnapshot } from './openWorldStore'
import { tOpen } from './openWorldI18n'
import { useLang } from '../../lib/i18n'
import { loadUserProfile } from '../../lib/userProfile'
import { roomNameOf, districtNameOf } from '../../lib/worldI18n'
import { RealmProgress, EquipmentBar } from './CultivationBar'
import { WorldSnapshot } from './WorldSnapshot'
import { PuzzleRowItem, TaskComposer, GuidePanel } from './OpenWorldPanels'
import { DistrictIcon, WorldHourglassIcon } from './MudIcons'
import './WorldMudGame.css'

export default function WorldMudGame({ onlineMembers }: GameComponentProps) {
  const lang = useLang()
  const profile = loadUserProfile()
  const displayName = profile?.nickname ?? 'Traveler'
  const [snap, setSnap] = useState<Awaited<ReturnType<typeof loadSnapshot>>['snap'] | null>(null)
  const [userId, setUserId] = useState('')
  const [roomId, setRoomId] = useState('plaza_center')
  const [loading, setLoading] = useState(true)
  const [showMap, setShowMap] = useState(false)

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

  if (loading || !snap) {
    return (
      <div className="world-mud-card world-mud-loading">
        <div className="world-mud-loading-orb" aria-hidden="true"><span /></div>
        <div className="world-mud-loading-text">{tOpen(lang, 'loading')}</div>
      </div>
    )
  }

  return (
    <div className="world-mud-card" role="article" aria-label={tOpen(lang, 'worldTitle')}>
      <div className="world-mud-head">
        <div className="world-mud-head-main">
          <span className="world-mud-icon"><WorldHourglassIcon size={16} /></span>
          <div className="world-mud-head-text">
            <span className="world-mud-title">{tOpen(lang, 'worldTitle')}</span>
            <span className="world-mud-loc">{districtNameOf(regionId, lang)} · {roomNameOf(roomId, lang)}</span>
          </div>
        </div>
        <span className="world-mud-online"><span className="world-mud-online-dot" />{onlineCount} {tOpen(lang, 'onlineNow')}</span>
      </div>

      <div className="world-mud-loc" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <DistrictIcon id={regionId as never} size={16} /> {tOpen(lang, 'currentRoom')}: <b>{roomNameOf(roomId, lang)}</b>
      </div>

      <WorldSnapshot snap={snap} onlineCount={onlineCount} />
      <RealmProgress profile={snap.myProfile} lang={lang} />
      <EquipmentBar profile={snap.myProfile} items={snap.items} lang={lang} />

      <div className="wmf-sec">{tOpen(lang, 'puzzlesHere')} ({puzzlesHere.length})</div>
      <div className="wmf-puzzles">
        {puzzlesHere.length === 0 && <div className="world-mud-online-pop-empty">{tOpen(lang, 'noLogYet')}</div>}
        {puzzlesHere.slice(0, 4).map((p) => (
          <PuzzleRowItem key={p.id} puzzle={p} snap={snap} userId={userId}
            solved={snap.mySolvedIds.includes(p.id)}
            onSolved={() => void refresh()} />
        ))}
      </div>

      <TaskComposer snap={snap} userId={userId} roomId={roomId} onCreated={() => void refresh()} />
      <GuidePanel snap={snap} userId={userId} />

      <div className="world-mud-foot">
        <button className={`world-mud-footbtn ${showMap ? 'is-on' : ''}`} onClick={() => setShowMap((v) => !v)}>{tOpen(lang, 'map')}</button>
        <span className="world-mud-footmeta">{tOpen(lang, 'region')}: {districtNameOf(regionId, lang)}</span>
      </div>

      {showMap && (
        <div className="world-mud-map"><div className="world-mud-map-grid">
          {snap.rooms.map((r) => (
            <button key={r.id} className={`world-mud-map-room ${r.id === roomId ? 'is-active' : ''}`}
              onClick={() => setRoomId(r.id)}>{roomNameOf(r.id, lang)}</button>
          ))}
        </div></div>
      )}
    </div>
  )
}
