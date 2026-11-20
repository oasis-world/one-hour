import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../lib/i18n'
import { pickLocalized } from '../games/resonance/localized'
import { questionFor } from '../games/resonance/logic'
import { loadResonance } from '../lib/resonanceRemote'
import { parseSyncWhisper, type SyncWhisperPayload } from '../lib/syncWhisper'
import { setPopoverOpen, suppressNextClick } from '../lib/popoverGuard'
import type { PresenceMember } from '../lib/chatTypes'
import AvatarBadge from './AvatarBadge'
import MessageAuthorCard from './MessageAuthorCard'
import './SyncWhisperCard.css'

const COPY = {
  zh: { lead: '你和', tail: '是同频的人 · 你们都选了' },
  'zh-TW': { lead: '你和', tail: '是同頻的人 · 你們都選了' },
  en: { lead: 'You and', tail: 'are in sync · you both picked' },
  ja: { lead: 'あなたと', tail: 'は同調しました · どちらも選んだのは' },
  fr: { lead: 'Vous et', tail: 'êtes en phase · vous avez choisi' },
  es: { lead: 'Tú y', tail: 'están en sintonía · ambos eligieron' },
  de: { lead: 'Du und', tail: 'seid im Einklang · ihr habt gewählt' },
  ko: { lead: '당신과', tail: '은 동기입니다 · 둘 다 선택한 것은' },
  it: { lead: 'Tu e', tail: 'siete in sintonia · avete scelto' },
  ar: { lead: 'أنت و', tail: 'على نفس الموجة · كلاهما اختار' },
} as const

export default function SyncWhisperCard({ content, selfId }: { content: string; selfId: string | null }) {
  const lang = useLang()
  const payload: SyncWhisperPayload | null = parseSyncWhisper(content)
  const iid = payload?.iid ?? ''
  const round = payload?.round ?? 0
  const optionId = payload?.optionId ?? ''
  const [localized, setLocalized] = useState<{ prompt: string; option: string } | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  // Portal into .app-shell so scoped warm-theme styles apply to the popover.
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([])
  const popRef = useRef<HTMLDivElement | null>(null)

  // Fetch the localized question + chosen option from the card's cloud row.
  useEffect(() => {
    if (!iid) return
    let alive = true
    void loadResonance(iid).then((row) => {
      if (!alive || !row) return
      const q = questionFor(row.questions, round)
      const opt = q?.options.find((o) => o.id === optionId)
      setLocalized({
        prompt: q ? pickLocalized(q.prompt, lang) : '',
        option: opt ? pickLocalized(opt.label, lang) : optionId,
      })
    })
    return () => { alive = false }
  }, [iid, round, optionId, lang])

  useEffect(() => {
    if (openIdx === null) return
    setPopoverOpen(true)
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (popRef.current?.contains(target ?? null) || chipRefs.current.some((el) => el?.contains(target ?? null))) return
      suppressNextClick()
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setOpenIdx(null)
    }
    window.addEventListener('pointerdown', dismiss, true)
    return () => {
      window.removeEventListener('pointerdown', dismiss, true)
      setPopoverOpen(false)
    }
  }, [openIdx])

  if (!payload) return null
  const copy = COPY[lang] ?? COPY.en
  const prompt = localized?.prompt ?? ''
  const option = localized?.option ?? payload.optionId

  const toggle = (idx: number, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (openIdx === idx) { setOpenIdx(null); return }
    const rect = event.currentTarget.getBoundingClientRect()
    setPosition({ left: Math.min(rect.left, window.innerWidth - 200), top: rect.bottom + 6 })
    setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-shell'))
    setOpenIdx(idx)
  }

  return (
    <span className="sync-whisper">
      <span className="sync-whisper-text">
        {copy.lead}{' '}
        {payload.partners.map((p, i) => (
          <button
            key={p.userId}
            ref={(el) => { chipRefs.current[i] = el }}
            type="button"
            className="sync-chip"
            onClick={(e) => toggle(i, e)}
          >
            <AvatarBadge
              look={{ style: p.style, seed: p.seed, avatarUrl: p.url }}
              size={20}
              className="sync-chip-avatar"
            />
            <span className="sync-chip-name">{p.name}</span>
          </button>
        ))}
        {' '}{copy.tail}「{payload.emoji} {option}」
      </span>
      {prompt && <span className="sync-whisper-q">「{prompt}」</span>}
      {openIdx !== null && position && createPortal(
        <div ref={popRef} className="author-pop-portal" style={position}>
          <MessageAuthorCard
            member={{
              userId: payload.partners[openIdx]!.userId,
              displayName: payload.partners[openIdx]!.name,
              avatarStyle: payload.partners[openIdx]!.style,
              avatarSeed: payload.partners[openIdx]!.seed,
              avatarUrl: payload.partners[openIdx]!.url,
              enteredAt: 0,
            } as PresenceMember}
            selfId={selfId}
          />
        </div>,
        portalRoot ?? document.body,
      )}
    </span>
  )
}
