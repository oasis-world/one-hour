import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadWorldState, saveWorldState, subscribeWorldState, upsertWorldPlayer } from './worldState'
import { type WorldMudState, type WorldLogEntry, findRoom, findDistrict } from './worldTypes'
import { requestWorldNarrate, tWorld } from '../../lib/worldMudNarrate'
import { loadUserProfile } from '../../lib/userProfile'
import { getCompanionIfAlive } from '../../lib/companionProfile'
import { useLang } from '../../lib/i18n'
import { useImeEnter } from '../../lib/ime'
import { WorldHourglassIcon, DistrictIcon, ChoiceIcon } from './MudIcons'
import './WorldMudGame.css'

function isWorldInstance(id: string): boolean {
  return id === 'world' || id === 'main' || id.length < 10
}

export default function WorldMudGame({ instanceId, onlineMembers, hostUserId }: GameComponentProps) {
  const lang = useLang()
  const profile = loadUserProfile()
  const nickname = profile?.nickname ?? 'Traveler'
  const roleLabel = profile?.role ?? (lang.startsWith('zh') ? '旅人' : 'Traveler')

  const [world, setWorld] = useState<WorldMudState | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationId, setLocationId] = useState('plaza_center')
  const [narrative, setNarrative] = useState('')
  const [choices, setChoices] = useState<Array<{ label: string; action: string; icon?: string }>>([])
  const [input, setInput] = useState('')
  const [acting, setActing] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showOnline, setShowOnline] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const ime = useImeEnter()

  const tw = useCallback((k: string) => tWorld(lang, k), [lang])
  const isZh = lang.startsWith('zh')

  // Build initial narrative with strict lang gate — never mix Chinese into English
  const buildIntro = useCallback((w: WorldMudState, locId: string) => {
    const room = findRoom(w, locId)
    const district = room ? findDistrict(w, room.districtId) : null
    const zh = lang.startsWith('zh')
    const districtDesc = zh ? (district?.description ?? '') : (district?.descriptionEn ?? '')
    const roomName = zh ? (room?.name ?? '沙漏广场') : (room?.nameEn ?? 'Hourglass Plaza')
    const lore = zh ? w.lore.slice(0, 90) : w.loreEn.slice(0, 120)
    const worldTitle = zh ? w.loreTitle : w.loreTitleEn
    if (zh) {
      return `欢迎来到${worldTitle}，${nickname}（${roleLabel}）。${lore} 你正站在${roomName}，${districtDesc}。远处传来脚步声——这个世界因你们而生。`
    }
    return `Welcome to ${worldTitle}, ${nickname} (${roleLabel}). ${lore} You stand at ${roomName} — ${districtDesc}. Footsteps echo nearby. This world lives because of you.`
  }, [lang, nickname, roleLabel])

  const fallbackChoices = useCallback((zh: boolean) => {
    if (zh) return [{ label: '观察四周', action: 'look', icon: '👁️' }, { label: '与人交谈', action: 'talk', icon: '💬' }, { label: '往北走', action: 'go north', icon: '🚶' }]
    return [{ label: 'Look around', action: 'look', icon: '👁️' }, { label: 'Talk', action: 'talk', icon: '💬' }, { label: 'Go north', action: 'go north', icon: '🚶' }]
  }, [])

  // Load world once
  useEffect(() => {
    let cancelled = false
    void loadWorldState().then((w) => {
      if (cancelled) return
      const me: WorldMudState['players'][number] = {
        userId: hostUserId ?? (profile ? `${profile.nickname}|${profile.role ?? ''}`.slice(0, 40) : `guest-${Date.now()}`),
        displayName: nickname,
        role: roleLabel,
        avatarStyle: profile?.style ?? null,
        avatarSeed: profile?.seed ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        locationId,
        joinedAt: Date.now(),
        level: 1, hp: 100, maxHp: 100, inventory: [],
      }
      const withMe = upsertWorldPlayer(w, me)
      if (withMe !== w) void saveWorldState(withMe)
      setWorld(withMe)
      setLoading(false)
      setNarrative(buildIntro(withMe, locationId))
      setChoices(fallbackChoices(lang.startsWith('zh')))
    }).catch(() => setLoading(false))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep narrative language-synced if user switches language before any action
  useEffect(() => {
    if (!world || world.log.length > 0) return
    setNarrative(buildIntro(world, locationId))
    setChoices(fallbackChoices(isZh))
  }, [lang, world, locationId, buildIntro, fallbackChoices, isZh])

  useEffect(() => {
    let off: (() => void) | null = null
    void subscribeWorldState((w) => setWorld((prev) => {
      // Don't clobber local narrative/choices on remote player join spam
      // but do refresh online list and world log
      if (prev && w.log.length === prev.log.length && w.players.length !== prev.players.length) {
        return { ...prev, players: w.players, globalEvent: w.globalEvent }
      }
      return w
    })).then((fn) => { off = fn })
    return () => off?.()
  }, [])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [world?.log])

  // Heartbeat: keep self alive and prune expired (mirrors one-hour presence 1h TTL)
  useEffect(() => {
    if (!world) return
    const id = window.setInterval(() => {
      const now = Date.now()
      const pruned = world.players.filter((p) => p.joinedAt + 60 * 60 * 1000 > now)
      const selfIdx = pruned.findIndex((p) => p.displayName === nickname)
      if (selfIdx >= 0) pruned[selfIdx] = { ...pruned[selfIdx], joinedAt: now }
      if (pruned.length !== world.players.length || selfIdx >= 0) {
        const next: WorldMudState = { ...world, players: pruned, updatedAt: now }
        setWorld(next)
        void saveWorldState(next)
      }
    }, 30_000)
    return () => window.clearInterval(id)
  }, [world, nickname])

  const handleAction = useCallback(async (raw: string) => {
    if (!world || acting || !raw.trim()) return
    const actionText = raw.trim().slice(0, 300)
    setActing(true)
    setInput('')
    const curLoc = locationId
    // language captured at action time — edge must obey it
    const actionLang = lang
    try {
      const res = await requestWorldNarrate(
        { actionText, locationId: curLoc, player: { displayName: nickname, role: roleLabel }, lang: actionLang, recentLog: world.log.slice(-10), globalEvent: world.globalEvent?.title ?? null },
        world,
      )
      let nextLoc = curLoc
      const lower = actionText.toLowerCase()
      if (lower.startsWith('go ')) {
        const dir = lower.slice(3).trim()
        const room = findRoom(world, curLoc)
        const target = room?.exits[dir]
        if (target) nextLoc = target
      }
      setLocationId(nextLoc)
      // Hard gate: if AI returned wrong language (contains CJK while lang=en), strip and fallback
      let cleanNarrative = res.narrative
      if (!actionLang.startsWith('zh') && /[\u4e00-\u9fff]/.test(cleanNarrative)) {
        // mixed Chinese in English mode — use broadcast instead which is shorter
        cleanNarrative = res.broadcast || cleanNarrative.replace(/[\u4e00-\u9fff]+/g, '').trim() || cleanNarrative
      }
      setNarrative(cleanNarrative)
      setChoices(res.choices)
      const entry: WorldLogEntry = {
        id: `log-${Date.now()}`, at: Date.now(), userId: nickname, displayName: nickname,
        role: roleLabel, locationId: nextLoc, action: actionText, result: res.broadcast.slice(0, 60), lang: actionLang,
      }
      const now = Date.now()
      const nextWorld: WorldMudState = {
        ...world,
        log: [...world.log, entry].slice(-80),
        stats: { ...world.stats, totalActions: world.stats.totalActions + 1 },
        players: world.players
          .map((p) => (p.displayName === nickname ? { ...p, locationId: nextLoc, joinedAt: now } : p))
          .filter((p) => p.joinedAt + 60 * 60 * 1000 > now),
        updatedAt: now,
      }
      setWorld(nextWorld)
      void saveWorldState(nextWorld)
    } catch (e) {
      console.warn('[world] action failed', e)
      setToast(tw('helpText'))
      window.setTimeout(() => setToast(null), 2500)
    } finally { setActing(false) }
  }, [world, acting, locationId, nickname, roleLabel, lang, tw])

  const room = useMemo(() => world ? findRoom(world, locationId) : null, [world, locationId])
  const district = useMemo(() => world && room ? findDistrict(world, room.districtId) : null, [world, room])
  const visiblePlayers = useMemo(() => {
    const companion = getCompanionIfAlive()
    const now = Date.now()
    let list = (world?.players ?? []).filter((p) => {
      if (p.userId.startsWith('companion-')) return false
      if (companion && p.displayName === companion.name) return false
      if (p.joinedAt + 60 * 60 * 1000 <= now) return false
      return true
    })
    // Presence intersection: MUD online ≤ one-hour在线 (no stale accumulation)
    if (onlineMembers && onlineMembers.length > 0) {
      const byId = new Set(onlineMembers.map((m) => m.userId))
      const byName = new Set(onlineMembers.map((m) => m.displayName))
      const intersected = list.filter((p) => {
        // real uuid path
        if (p.userId.includes('-') && p.userId.length >= 20) return byId.has(p.userId)
        // legacy nickname|role path
        return byName.has(p.displayName)
      })
      // If intersection yields 0 but presence has people, fall back to raw list
      // (covers first-load race where presence hasn't hydrated yet)
      if (intersected.length > 0 || onlineMembers.length === 0) list = intersected
    }
    return list
  }, [world, onlineMembers])
  const onlineCount = visiblePlayers.length

  if (loading || !world) {
    return (
      <div className="world-mud-card world-mud-loading">
        <div className="world-mud-loading-orb" aria-hidden="true"><span /></div>
        <div className="world-mud-loading-text">{isWorldInstance(instanceId) ? (isZh ? '正在编织世界…' : 'Weaving the world…') : 'Loading…'}</div>
      </div>
    )
  }

  const exits = room ? Object.keys(room.exits) : []
  const districtName = isZh ? district?.name : district?.nameEn
  const roomName = isZh ? room?.name : room?.nameEn

  return (
    <div className="world-mud-card" role="article" aria-label={isZh ? world.loreTitle : world.loreTitleEn}>
      {/* Compact header */}
      <div className="world-mud-head">
        <div className="world-mud-head-main">
          <span className="world-mud-icon" aria-hidden><WorldHourglassIcon size={16} /></span>
          <div className="world-mud-head-text">
            <span className="world-mud-title">{isZh ? world.loreTitle : world.loreTitleEn}</span>
            <span className="world-mud-loc" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{district && <DistrictIcon id={district.id} size={16} />} {districtName} · {roomName}</span>
          </div>
        </div>
        <button className="world-mud-online" onClick={() => setShowOnline((v) => !v)} aria-expanded={showOnline} title={tw('onlineNow')}>
          <span className="world-mud-online-dot" />
          {onlineCount}
        </button>
      </div>

      {world.globalEvent && (
        <div className="world-mud-event">
          <span style={{ display: 'inline-flex', color: 'var(--wm-gold)' }}><WorldHourglassIcon size={16} /></span>
          <strong>{isZh ? world.globalEvent.title : world.globalEvent.titleEn}</strong>
          <span className="world-mud-event-desc">{isZh ? world.globalEvent.description : world.globalEvent.descriptionEn}</span>
        </div>
      )}

      {/* Online popover */}
      {showOnline && (
        <div className="world-mud-online-pop">
          <div className="world-mud-online-pop-head">{onlineCount} {tw('onlineNow')} · {world.stats.totalPlayersEver} {tw('playersEver')}</div>
          <div className="world-mud-online-pop-list">
            {visiblePlayers.slice(0, 24).map((p) => {
              const r = findRoom(world, p.locationId)
              return (
                <div key={p.userId} className="world-mud-online-pop-item">
                  <span className="world-mud-online-pop-name">{p.displayName}</span>
                  <span className="world-mud-online-pop-role">{p.role}</span>
                  <span className="world-mud-online-pop-at">{isZh ? r?.name : r?.nameEn}</span>
                </div>
              )
            })}
            {visiblePlayers.length === 0 && <div className="world-mud-online-pop-empty">{tw('noLogYet')}</div>}
          </div>
        </div>
      )}

      {/* Narrative — with acting mask */}
      <div className="world-mud-scene-wrap">
        <div className="world-mud-scene">{narrative}</div>
        {acting && (
          <div className="world-mud-acting-mask" aria-live="polite" aria-busy="true">
            <div className="world-mud-acting-inner">
              <span className="world-mud-acting-orb" aria-hidden><i /><i /><i /></span>
              <span className="world-mud-acting-text">{isZh ? '沙漏流转中…' : 'Weaving…'}</span>
            </div>
          </div>
        )}
      </div>
      {exits.length > 0 && <div className="world-mud-exits">{isZh ? '出口' : 'Exits'}: {exits.join(' · ')}</div>}

      {/* Choices — primary actions */}
      <div className="world-mud-choices">
        {choices.map((c) => (
          <button key={c.action} className="world-mud-choice" disabled={acting} onClick={() => void handleAction(c.action)}>
            <ChoiceIcon action={c.action} iconEmoji={c.icon} size={18} /> {c.label}
          </button>
        ))}
      </div>

      {/* Input — with language-correct placeholder */}
      <div className="world-mud-inputrow">
        <input
          className="world-mud-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tw('typePlaceholder')}
          maxLength={300}
          disabled={acting}
          {...ime.imeProps}
          onKeyDown={(e) => {
            if (ime.imeConsumesEnter(e)) return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const v = input.trim()
              if (v) void handleAction(v)
            }
          }}
        />
        <button className="world-mud-send" disabled={acting || !input.trim()} onClick={() => { const v = input.trim(); if (v) void handleAction(v) }}>
          {acting ? '…' : '→'}
        </button>
      </div>

      {/* Minimal footer */}
      <div className="world-mud-foot">
        <button className={`world-mud-footbtn ${showMap ? 'is-on' : ''}`} onClick={() => setShowMap((v) => !v)}>{tw('map')}</button>
        <span className="world-mud-footmeta">{world.stats.totalActions} {tw('actionsCount')}</span>
        <span className="world-mud-footnote">{tw('privateNote')}</span>
      </div>

      {toast && <div className="world-mud-toast">{toast}</div>}

      {showMap && (
        <div className="world-mud-map">
          <div className="world-mud-map-grid">
            {world.districts.map((d) => (
              <div key={d.id} className={`world-mud-map-d ${room?.districtId === d.id ? 'is-here' : ''}`}>
                <div className="world-mud-map-dtitle" style={{ color: d.color }}><DistrictIcon id={d.id} size={16} /> {isZh ? d.name : d.nameEn}</div>
                <div className="world-mud-map-rooms">
                  {d.rooms.map((r) => (
                    <button key={r.id} className={`world-mud-map-room ${r.id === locationId ? 'is-active' : ''}`} onClick={() => {
                      if (r.id === locationId) return
                      const inExits = room ? Object.values(room.exits).includes(r.id) : false
                      if (inExits) void handleAction(`go ${Object.entries(room!.exits).find(([, v]) => v === r.id)?.[0] ?? ''}`)
                      else setLocationId(r.id)
                    }}>{isZh ? r.name : r.nameEn}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="world-mud-map-note">{tw('helpText')}</div>
        </div>
      )}
    </div>
  )
}
