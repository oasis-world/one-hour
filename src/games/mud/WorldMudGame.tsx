import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameComponentProps } from '../types'
import { loadWorldState, saveWorldState, subscribeWorldState, upsertWorldPlayer } from './worldState'
import { type WorldMudState, type WorldLogEntry, findRoom, findDistrict } from './worldTypes'
import { requestWorldNarrate, tWorld } from '../../lib/worldMudNarrate'
import { loadUserProfile } from '../../lib/userProfile'
import { getCompanionIfAlive } from '../../lib/companionProfile'
import { useLang } from '../../lib/i18n'
import { useImeEnter } from '../../lib/ime'
import { detectInputLang, isKnownCommand } from '../../lib/detectInputLang'
import { districtNameOf, roomNameOf, loreTitleOf, loreOf, getDistrictDesc } from '../../lib/worldI18n'
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

  // Per-user local progress: always keyed by the viewer (current user), not the card author
  const progressKey = useMemo(() => {
    const uid = profile ? `${profile.nickname}|${profile.role ?? ''}` : hostUserId
    return uid ? `one-hour:mud-progress:${uid}` : null
  }, [profile, hostUserId])
  const saveLocalProgress = useCallback((loc: string, nar: string, ch: Array<{ label: string; action: string; icon?: string }>) => {
    if (!progressKey) return
    try { localStorage.setItem(progressKey, JSON.stringify({ locationId: loc, narrative: nar, choices: ch, at: Date.now() })) } catch { /* quota */ }
  }, [progressKey])

  const tw = useCallback((k: string) => tWorld(lang, k), [lang])
  const isZh = lang.startsWith('zh')

  // Build initial narrative — fully localized for 10 langs
  const buildIntro = useCallback((w: WorldMudState, locId: string) => {
    const room = findRoom(w, locId)
    const district = room ? findDistrict(w, room.districtId) : null
    const districtDesc = district ? getDistrictDesc(district, lang) : ''
    const roomName = room ? roomNameOf(room.id, lang) : (lang.startsWith('zh') ? '沙漏广场' : 'Hourglass Plaza')
    const lore = loreOf(lang).slice(0, lang.startsWith('zh') ? 90 : 120)
    const worldTitle = loreTitleOf(lang)
    const map: Record<string, string> = {
      zh: `欢迎来到${worldTitle}，${nickname}（${roleLabel}）。${lore} 你正站在${roomName}，${districtDesc}。远处传来脚步声——这个世界因你们而生。`,
      'zh-TW': `歡迎來到${worldTitle}，${nickname}（${roleLabel}）。${lore} 你正站在${roomName}，${districtDesc}。遠處傳來腳步聲——這個世界因你們而生。`,
      en: `Welcome to ${worldTitle}, ${nickname} (${roleLabel}). ${lore} You stand at ${roomName} — ${districtDesc}. Footsteps echo nearby. This world lives because of you.`,
      ja: `ようこそ${worldTitle}へ、${nickname}（${roleLabel}）。${lore} あなたは${roomName}に立ち、${districtDesc}。足音が響く——この世界はあなたと共に生きている。`,
      fr: `Bienvenue dans ${worldTitle}, ${nickname} (${roleLabel}). ${lore} Vous vous tenez à ${roomName} — ${districtDesc}. Des pas résonnent — ce monde vit grâce à vous.`,
      es: `Bienvenido a ${worldTitle}, ${nickname} (${roleLabel}). ${lore} Estás en ${roomName} — ${districtDesc}. Pasos resuenan cerca. Este mundo vive gracias a ti.`,
      de: `Willkommen in ${worldTitle}, ${nickname} (${roleLabel}). ${lore} Du stehst in ${roomName} — ${districtDesc}. Schritte hallen wider. Diese Welt lebt durch euch.`,
      ko: `${worldTitle}에 오신 것을 환영합니다, ${nickname} (${roleLabel}). ${lore} 당신은 ${roomName}에 서 있습니다 — ${districtDesc}. 발소리가 울려퍼집니다. 이 세계는 당신으로 인해 살아갑니다.`,
      it: `Benvenuto in ${worldTitle}, ${nickname} (${roleLabel}). ${lore} Ti trovi a ${roomName} — ${districtDesc}. Passi echeggiano. Questo mondo vive grazie a te.`,
      ar: `مرحباً بك في ${worldTitle}، ${nickname} (${roleLabel}). ${lore} أنت تقف في ${roomName} — ${districtDesc}. خطوات تتردد في الجوار. هذا العالم يحيا بكم.`,
    }
    return map[lang] ?? map.en
  }, [lang, nickname, roleLabel])

  const fallbackChoices = useCallback((l: string) => {
    const map: Record<string, Array<{ label: string; action: string; icon?: string }>> = {
      zh: [{ label: '观察四周', action: 'look', icon: '👁️' }, { label: '与人交谈', action: 'talk', icon: '💬' }, { label: '往北走', action: 'go north', icon: '🚶' }],
      'zh-TW': [{ label: '觀察四周', action: 'look', icon: '👁️' }, { label: '與人交談', action: 'talk', icon: '💬' }, { label: '往北走', action: 'go north', icon: '🚶' }],
      ja: [{ label: '周りを見る', action: 'look', icon: '👁️' }, { label: '話しかける', action: 'talk', icon: '💬' }, { label: '北へ進む', action: 'go north', icon: '🚶' }],
      fr: [{ label: 'Regarder autour', action: 'look', icon: '👁️' }, { label: 'Parler', action: 'talk', icon: '💬' }, { label: 'Aller au nord', action: 'go north', icon: '🚶' }],
      es: [{ label: 'Mirar alrededor', action: 'look', icon: '👁️' }, { label: 'Hablar', action: 'talk', icon: '💬' }, { label: 'Ir al norte', action: 'go north', icon: '🚶' }],
      de: [{ label: 'Umschauen', action: 'look', icon: '👁️' }, { label: 'Reden', action: 'talk', icon: '💬' }, { label: 'Nach Norden', action: 'go north', icon: '🚶' }],
      ko: [{ label: '주변 둘러보기', action: 'look', icon: '👁️' }, { label: '대화하기', action: 'talk', icon: '💬' }, { label: '북쪽으로', action: 'go north', icon: '🚶' }],
      it: [{ label: 'Guardati intorno', action: 'look', icon: '👁️' }, { label: 'Parla', action: 'talk', icon: '💬' }, { label: 'Vai a nord', action: 'go north', icon: '🚶' }],
      ar: [{ label: 'انظر حولك', action: 'look', icon: '👁️' }, { label: 'تحدث', action: 'talk', icon: '💬' }, { label: 'اذهب شمالاً', action: 'go north', icon: '🚶' }],
    }
    return map[l] ?? map.en ?? [{ label: 'Look around', action: 'look', icon: '👁️' }, { label: 'Talk', action: 'talk', icon: '💬' }, { label: 'Go north', action: 'go north', icon: '🚶' }]
  }, [])

  // Load world once — restore per-user location + narrative so refresh keeps progress
  useEffect(() => {
    let cancelled = false
    void loadWorldState().then((w) => {
      if (cancelled) return
      const userId = profile ? `${profile.nickname}|${profile.role ?? ''}`.slice(0, 40) : (hostUserId ?? `guest-${Date.now()}`)
      const existing = w.players.find((p) => p.userId === userId)
      const saved = (() => {
        try {
          const raw = localStorage.getItem(progressKey ?? '')
          if (!raw) return null
          const p = JSON.parse(raw) as { locationId?: string; narrative?: string; choices?: Array<{ label: string; action: string; icon?: string }>; at?: number }
          if (!p?.locationId || !p?.narrative || !Array.isArray(p?.choices)) return null
          if (typeof p.at === 'number' && Date.now() - p.at > 60 * 60 * 1000) return null
          return p as { locationId: string; narrative: string; choices: Array<{ label: string; action: string; icon?: string }>; at?: number }
        } catch { return null }
      })()
      const startLoc = (existing?.locationId ?? saved?.locationId ?? locationId) as string
      const me: WorldMudState['players'][number] = {
        userId,
        displayName: nickname,
        role: roleLabel,
        avatarStyle: profile?.style ?? null,
        avatarSeed: profile?.seed ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        locationId: startLoc,
        joinedAt: Date.now(),
        level: existing?.level ?? 1, hp: existing?.hp ?? 100, maxHp: existing?.maxHp ?? 100, inventory: existing?.inventory ?? [],
      }
      const withMe = upsertWorldPlayer(w, me)
      if (withMe !== w) void saveWorldState(withMe)
      setWorld(withMe)
      setLoading(false)
      if (saved) {
        setLocationId(saved.locationId)
        setNarrative(saved.narrative)
        setChoices(saved.choices)
      } else {
        setLocationId(startLoc)
        setNarrative(buildIntro(withMe, startLoc))
        setChoices(fallbackChoices(lang))
      }
    }).catch(() => setLoading(false))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep narrative language-synced if user switches language before any action
  useEffect(() => {
    if (!world || world.log.length > 0) return
    setNarrative(buildIntro(world, locationId))
    setChoices(fallbackChoices(lang))
  }, [lang, world, locationId, buildIntro, fallbackChoices])

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
    const isButton = isKnownCommand(actionText)
    const detected = !isButton ? detectInputLang(actionText) : null
    const narrativeLang = detected ?? lang
    const uiLang = lang
    try {
      const res = await requestWorldNarrate(
        { actionText, locationId: curLoc, player: { displayName: nickname, role: roleLabel }, lang: uiLang, narrativeLang, recentLog: world.log.slice(-10), globalEvent: world.globalEvent?.title ?? null },
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
      let cleanNarrative = res.narrative
      // Fix: Japanese Kanji shares \u4e00-\u9fff with Chinese — must not strip Kanji from ja narrative.
      // Only treat Han chars as "Chinese leak" when narrative is non-CJK, or when ja text has Han but zero Kana (suspicious).
      const hasKana = /[\u3040-\u30FF]/.test(cleanNarrative)
      const isCjkNarr = narrativeLang.startsWith('zh') || narrativeLang === 'ja' || narrativeLang === 'ko'
      if (!isCjkNarr && /[\u4e00-\u9fff]/.test(cleanNarrative)) {
        cleanNarrative = res.broadcast || cleanNarrative.replace(/[\u4e00-\u9fff]+/g, '').trim() || cleanNarrative
      } else if (narrativeLang === 'ja' && !hasKana && /[\u4e00-\u9fff]/.test(cleanNarrative)) {
        // ja narrative with Kanji but no Hiragana/Katakana at all — likely Chinese leak, not real Japanese
        cleanNarrative = res.broadcast || cleanNarrative.replace(/[\u4e00-\u9fff]+/g, '').trim() || cleanNarrative
      }
      setNarrative(cleanNarrative)
      setChoices(res.choices)
      saveLocalProgress(nextLoc, cleanNarrative, res.choices)
      const entry: WorldLogEntry = {
        id: `log-${Date.now()}`, at: Date.now(), userId: nickname, displayName: nickname,
        role: roleLabel, locationId: nextLoc, action: actionText, result: res.broadcast.slice(0, 60), lang: narrativeLang,
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
    } catch {
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
    const loadingMap: Record<string, string> = {
      zh: '正在编织世界…', 'zh-TW': '正在編織世界…', en: 'Weaving the world…', ja: '世界を編んでいます…',
      fr: 'Tissage du monde…', es: 'Tejiendo el mundo…', de: 'Welt wird gewoben…', ko: '세계를 엮는 중…',
      it: 'Intrecciando il mondo…', ar: 'ننسج العالم…',
    }
    const loadingText = isWorldInstance(instanceId) ? (loadingMap[lang] ?? loadingMap.en) : 'Loading…'
    return (
      <div className="world-mud-card world-mud-loading">
        <div className="world-mud-loading-orb" aria-hidden="true"><span /></div>
        <div className="world-mud-loading-text">{loadingText}</div>
      </div>
    )
  }

  const districtName = district ? districtNameOf(district.id, lang) : ''
  const roomName = room ? roomNameOf(room.id, lang) : ''
  const worldTitle = loreTitleOf(lang)

  return (
    <div className="world-mud-card" role="article" aria-label={worldTitle}>
      {/* Compact header */}
      <div className="world-mud-head">
        <div className="world-mud-head-main">
          <span className="world-mud-icon" aria-hidden><WorldHourglassIcon size={16} /></span>
          <div className="world-mud-head-text">
            <span className="world-mud-title">{worldTitle}</span>
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
                  <span className="world-mud-online-pop-at">{r ? roomNameOf(r.id, lang) : ''}</span>
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
              <span className="world-mud-acting-text">{({ zh: '沙漏流转中…', 'zh-TW': '沙漏流轉中…', en: 'Weaving…', ja: '紡いでいます…', fr: 'Tissage…', es: 'Tejiendo…', de: 'Weben…', ko: '엮는 중…', it: 'Intreccio…', ar: 'ننسج…' } as Record<string, string>)[lang] ?? 'Weaving…'}</span>
            </div>
          </div>
        )}
      </div>

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
                <div className="world-mud-map-dtitle" style={{ color: d.color }}><DistrictIcon id={d.id} size={16} /> {districtNameOf(d.id, lang)}</div>
                <div className="world-mud-map-rooms">
                  {d.rooms.map((r) => (
                    <button key={r.id} className={`world-mud-map-room ${r.id === locationId ? 'is-active' : ''}`} onClick={() => {
                      if (r.id === locationId) return
                      const inExits = room ? Object.values(room.exits).includes(r.id) : false
                      if (inExits) void handleAction(`go ${Object.entries(room!.exits).find(([, v]) => v === r.id)?.[0] ?? ''}`)
                      else {
                        setLocationId(r.id)
                        saveLocalProgress(r.id, narrative, choices)
                      }
                    }}>{roomNameOf(r.id, lang)}</button>
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
