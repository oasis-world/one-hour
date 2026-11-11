import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ChatEntry, MessageReply } from '../lib/chatTypes'
import { COMPOSER_PLACEHOLDER, COMPOSER_PRIVATE_PLACEHOLDER, useLang, t } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { setPopoverOpen, suppressNextClick } from '../lib/popoverGuard'
import { markFilePickerOpened } from '../lib/filePickerGuard'
import { CameraIcon, ChessCrownIcon, ChevronRightIcon, EmojiIcon, GameIcon, GomokuIcon, PlusIcon, SendIcon, ThinXIcon, UploadIcon, VoteIcon, XiangqiGeneralIcon } from './icons'
import { PhotoIcon } from './userIcons'
import EmojiPanel from './EmojiPanel'
import AvatarBadge from './AvatarBadge'
import type { CompanionProfile } from '../lib/companionProfile'
import type { PresenceMember } from '../lib/chatTypes'
import { getGameList } from '../games/registry'
type MentionCandidate =
  | { kind: 'companion'; id: string; displayName: string; role: string; style: string; seed: string; avatarUrl: string | null }
  | { kind: 'whisper'; member: PresenceMember }

interface Props {
  onSend: (text: string, replyTo?: MessageReply | null) => void
  replyTo: MessageReply | null
  onClearReply: () => void
  /** When set, the composer edits this existing message instead of sending. */
  editing: ChatEntry | null
  onClearEditing: () => void
  onEdit: (id: string, text: string) => void
  /** Photo from the camera (single shot). */
  onImagePicked: (file: File) => void
  /** Photos from the library — up to 5, sent as independent messages. */
  onImagesPicked: (files: File[]) => void
  /** Start a game message for the given game id. */
  onStartGame?: (gameId: string) => void
  /** Open the create-poll window (plus menu → Poll). */
  onStartPoll?: () => void
  /** Notifies the shell while a popover is up (mobile hides the gear). */
  onMenuOpenChange?: (open: boolean) => void
  companion?: CompanionProfile | null
  onMentionCompanion?: () => void
  privateMode?: boolean
  onExitPrivateChat?: () => void
  presence?: PresenceMember[]
  selfId?: string | null
  onWhisperSelect?: (member: PresenceMember) => void
  pendingInsertName?: string | null
  onConsumeInsert?: () => void
}

function isCoarsePointer(): boolean {
  try {
    return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false
  } catch {
    return false
  }
}

/**
 * The plus menu follows the *form factor*: phones get the camera /
 * photo-library pair, wide pointers get the single "Upload image" item.
 */
function useMobileFormFactor(): boolean {
  const [mobile, setMobile] = useState(() =>
    isCoarsePointer() || window.innerWidth <= 820,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px), (pointer: coarse)')
    const onChange = () => setMobile(isCoarsePointer() || window.innerWidth <= 820)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return mobile
}

/**
 * The composer pill: the plus (camera / photo library) on the left, the
 * field, emoji and the round send arrow on the right. Clicking the plus
 * or emoji button toggles its popover (a click outside closes it); there
 * is no hover-to-open.
 */
export default function Composer({ onSend, replyTo, onClearReply, editing, onClearEditing, onEdit, onImagePicked, onImagesPicked, onMenuOpenChange, onStartGame, onStartPoll, companion, onMentionCompanion, privateMode, onExitPrivateChat, presence, selfId, onWhisperSelect, pendingInsertName, onConsumeInsert }: Props) {
  const lang = useLang()
  const [draft, setDraft] = useState(editing?.content ?? '')
  const [plusOpen, setPlusOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [isComposing, setIsComposing] = useState(false)
  const [frozenQuery, setFrozenQuery] = useState<string | null>(null)
  const coarse = isCoarsePointer()
  const mobileForm = useMobileFormFactor()
  const ime = useImeEnter()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const getFilteredPresence = (query: string): PresenceMember[] => {
    const companionId = companion?.id ?? null
    const list = (presence ?? []).filter((p) => p.userId !== selfId && p.userId !== companionId)
    if (!query) return list.slice(0, 5)
    const q = query.toLowerCase()
    return list.filter((p) => {
      const name = (p.displayName ?? '').toLowerCase()
      const role = (p.role ?? '').toLowerCase()
      return name.includes(q) || role.includes(q)
    }).slice(0, 5)
  }

  const updateMentionState = (value: string) => {
    const lastAt = value.lastIndexOf('@')
    if (lastAt === -1) { setMentionOpen(false); return }
    const after = value.slice(lastAt)
    // If already completed @name + space/newline, close — check companion tag
    if (companion) {
      const tag = `@${companion.name}`
      if (after === tag || after === tag + ' ' || after.startsWith(tag + ' ') || after.startsWith(tag + '\n')) {
        setMentionOpen(false)
        return
      }
    }
    // Also close if already completed a whisper target's name (exact @name + space)
    // Check presence members for exact match (companion excluded — it is already
    // rendered as its own first candidate and must not appear twice).
    if (presence && presence.length > 0) {
      const companionId = companion?.id ?? null
      for (const m of presence) {
        if (m.userId === companionId) continue
        const tag = `@${m.displayName}`
        if (after === tag || after === tag + ' ' || after.startsWith(tag + ' ') || after.startsWith(tag + '\n')) {
          setMentionOpen(false)
          return
        }
      }
    }
    // Need at least companion or at least one filtered presence to show
    const query = value.slice(lastAt + 1).trim().split(/\s/)[0] ?? ''
    const hasCompanion = Boolean(companion)
    const hasPresence = (() => {
      const companionId = companion?.id ?? null
      const list = (presence ?? []).filter((p) => p.userId !== selfId && p.userId !== companionId)
      if (!query) return list.length > 0
      const q = query.toLowerCase()
      return list.some((p) => (p.displayName ?? '').toLowerCase().includes(q) || (p.role ?? '').toLowerCase().includes(q))
    })()
    if (!hasCompanion && !hasPresence) { setMentionOpen(false); return }
    setMentionOpen(true)
    setMentionIndex(0)
  }

  // During IME composition the draft carries half-finished pinyin / kana
  // fragments — filtering on them would make the @ list jitter and flicker.
  // Freeze on the last committed query until composition ends.
  const getMentionQuery = (value: string): string => {
    const lastAt = value.lastIndexOf('@')
    return lastAt === -1 ? '' : value.slice(lastAt + 1).trim().split(/\s/)[0] ?? ''
  }
  const liveQuery = getMentionQuery(draft)
  const effectiveQuery = isComposing && frozenQuery != null ? frozenQuery : liveQuery
  const mentionCandidates: MentionCandidate[] = (() => {
    const query = effectiveQuery
    const filtered = getFilteredPresence(query)
    const out: MentionCandidate[] = []
    if (companion) {
      // Companion always stays first while the popup is open (matches or not).
      out.push({ kind: 'companion', id: companion.id, displayName: companion.name, role: companion.role, style: companion.style, seed: companion.seed, avatarUrl: companion.avatarUrl ?? null })
    }
    for (const m of filtered) out.push({ kind: 'whisper', member: m })
    // If no companion and no presence, return empty to close
    if (out.length === 0) return []
    // Limit to 1 + 5 = 6 max
    return out.slice(0, 6)
  })()
  useLayoutEffect(() => {
    if (replyTo) inputRef.current?.focus()
  }, [replyTo])

  useLayoutEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    try {
      el.setSelectionRange(len, len)
    } catch {
      // Some mobile inputs don't support selection ranges.
    }
  }, [editing])

  useEffect(() => {
    if (!replyTo) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      event.preventDefault()
      event.stopPropagation()
      onClearReply()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClearReply, replyTo])

  useEffect(() => {
    if (!editing) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      event.preventDefault()
      event.stopPropagation()
      onClearEditing()
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClearEditing, editing])

  // Auto-grow: the single-line height stays on the CSS 38px so every
  // webview (including WeChat's, whose font metrics differ) renders the
  // same pill — only true multiline content sets an explicit height.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const grown = el.scrollHeight > 44
    el.style.height = grown ? `${Math.min(el.scrollHeight, 108)}px` : ''
    el.style.overflowY = grown ? '' : 'hidden'
    setMultiline(grown)
  }, [draft])

  // Tap outside closes the popovers.
  useEffect(() => {
    if (!plusOpen && !emojiOpen && !mentionOpen) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        suppressNextClick()
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setPlusOpen(false)
        setEmojiOpen(false)
        setGamesOpen(false)
        setMentionOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [plusOpen, emojiOpen, mentionOpen])

  useEffect(() => {
    const menuOpen = plusOpen || emojiOpen || mentionOpen
    onMenuOpenChange?.(menuOpen)
    if (!menuOpen) return
    setPopoverOpen(true)
    return () => setPopoverOpen(false)
  }, [plusOpen, emojiOpen, mentionOpen, onMenuOpenChange])

  // Sync mention popover with draft — frozen while IME is composing so the
  // half-finished pinyin never opens / closes / re-filters the @ list.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (!isComposing) updateMentionState(draft) }, [draft, companion, presence, selfId, isComposing])

  // External insert trigger (avatar / online list click)
  useEffect(() => {
    if (!pendingInsertName) return
    const tag = `@${pendingInsertName} `
    setDraft((prev) => {
      const lastAt = prev.lastIndexOf('@')
      let insertDraft: string
      if (lastAt !== -1) {
        const after = prev.slice(lastAt)
        if (after.startsWith('@') && !after.includes(' ') && !after.includes('\n')) {
          insertDraft = prev.slice(0, lastAt) + tag
        } else {
          insertDraft = prev.includes(`@${pendingInsertName}`) ? prev : (prev ? (prev.endsWith(' ') || prev.endsWith('\n') ? prev + tag : prev + ' ' + tag) : tag)
        }
      } else {
        insertDraft = prev.includes(`@${pendingInsertName}`) ? prev : (prev ? (prev.endsWith(' ') || prev.endsWith('\n') ? prev + tag : prev + ' ' + tag) : tag)
      }
      requestAnimationFrame(() => {
        const el = inputRef.current
        if (el) {
          el.focus()
          try { el.selectionStart = el.selectionEnd = insertDraft.length } catch { /* noop */ }
          requestAnimationFrame(() => {
            try { el.selectionStart = el.selectionEnd = insertDraft.length } catch { /* noop */ }
          })
        }
      })
      return insertDraft
    })
    onConsumeInsert?.()
  }, [pendingInsertName, onConsumeInsert])

  // Entering private mode should focus the field (mobile: keyboard pops).
  const prevPrivateRef = useRef(privateMode)
  useEffect(() => {
    if (privateMode && !prevPrivateRef.current) {
      inputRef.current?.focus()
      try {
        const el = inputRef.current
        if (el) el.setSelectionRange(el.value.length, el.value.length)
      } catch {}
    }
    prevPrivateRef.current = privateMode
  }, [privateMode])
  // Warm the HEIC decoder while the user browses the plus menu, so a
  // first HEIC pick doesn't pay the chunk-download latency mid-send.
  useEffect(() => {
    if (plusOpen) void import('heic2any').catch(() => {})
  }, [plusOpen])

  /**
   * Insert without touching focus: mousedown on the panel is prevented,
   * so the field keeps (or keeps losing) the keyboard exactly as it was.
   */
  const insertEmoji = (emoji: string) => {
    setDraft((prev) => prev + emoji)
  }

  const canSubmit = editing
    ? draft.trim().length > 0 || Boolean(editing.imageUrl || editing.localImage)
    : draft.trim().length > 0

  const submit = () => {
    const text = draft.trim()
    // Editing an existing message: update it in place instead of sending new.
    if (editing) {
      const hasImage = Boolean(editing.imageUrl || editing.localImage)
      if (!text && !hasImage) return
      const holdKeyboard = document.activeElement === inputRef.current
      onEdit(editing.id, text)
      setDraft('')
      onClearEditing()
      setEmojiOpen(false)
      if (coarse && holdKeyboard) inputRef.current?.focus()
      return
    }
    // Idle (gray) send: ignore the tap entirely — no keyboard pop, and the
    // field doesn't take focus either.
    if (!text) return
    // Hold the keyboard up only if it was already up (field focused). A
    // send tapped with the keyboard down — e.g. after picking an emoji
    // from a closed keyboard — must not pop it back up.
    const holdKeyboard = document.activeElement === inputRef.current
    onSend(text, replyTo)
    setDraft('')
    setEmojiOpen(false)
    if (coarse && holdKeyboard) inputRef.current?.focus()
  }

  /** Side-button taps must not steal the field's focus (the keyboard
      would drop on Android, which moves focus on mousedown/pointerdown). */
  const keepFocus = (e: React.SyntheticEvent) => e.preventDefault()

  const pickFile = (input: RefObject<HTMLInputElement | null>) => {
    setPlusOpen(false)
    // The native dialog blurs the window — flag it so the shell doesn't
    // mistake the return focus for "away" and fold the chat (which would
    // unmount this input before `change` fires).
    markFilePickerOpened()
    input.current?.click()
  }

  const insertMention = (candidate?: MentionCandidate) => {
    const target = candidate ?? mentionCandidates[mentionIndex]
    if (!target) return
    const displayName = target.kind === 'companion' ? target.displayName : target.member.displayName
    const lastAt = draft.lastIndexOf('@')
    const tag = `@${displayName} `
    const newDraft = lastAt === -1 ? tag : draft.slice(0, lastAt) + tag
    setDraft(newDraft)
    setMentionOpen(false)
    if (target.kind === 'whisper') {
      onWhisperSelect?.(target.member)
    } else if (target.kind === 'companion') {
      // companion mention handled by App's private routing via text contains
    }
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        try { el.selectionStart = el.selectionEnd = newDraft.length } catch { /* noop */ }
      }
    })
  }

  return (
    <div className="composer-dock" ref={rootRef}>
      {privateMode && onExitPrivateChat && (
        <div className="composer-private-bar">
          <button type="button" className="composer-private-exit" onClick={onExitPrivateChat}>
            {t('退出私聊', 'Exit private chat')}
          </button>
        </div>
      )}
      {replyTo && (
        <div className="composer-reply-preview">
          <div className="composer-reply-copy">
            <strong>{t('回复给', 'Replying to')} {replyTo.displayName}</strong>
            <span>{(replyTo.content || '').split('\n__GAME__:')[0].split('\n__POLL__:')[0].trim() || (replyTo.hasImage ? t('图片', 'Image') : '')}</span>
          </div>
          <button
            type="button"
            className="composer-reply-close"
            aria-label={t('取消回复', 'Cancel reply')}
            onClick={onClearReply}
          >
            <ThinXIcon size={14} />
          </button>
        </div>
      )}
      {mobileForm && emojiOpen && <EmojiPanel onInsert={insertEmoji} />}
      <div className={`composer${multiline ? ' is-multiline' : ''}`}>
        <div className="composer-zone">
          <button
            type="button"
            className={`composer-side-btn${plusOpen ? ' is-active' : ''}`}
            aria-label={t('添加', 'Add')}
            title={t('添加', 'Add')}
            aria-expanded={plusOpen}
            onMouseDown={keepFocus}
            onPointerDown={keepFocus}
            onClick={() => {
              setPlusOpen((v) => !v)
              setEmojiOpen(false)
              setGamesOpen(false)
              // Leave the keyboard exactly as it is: no focus() call here.
              // The pointerdown preventDefault above already keeps an open
              // keyboard up, and a closed one stays down.
            }}
          >
            <PlusIcon />
          </button>
          {companion && (
            <button
              type="button"
              className="composer-companion-btn"
              aria-label={t('提及伙伴', 'Mention companion')}
              title={companion.name}
              onClick={() => {
                const tag = `@${companion.name} `
                let next = draft
                if (!draft.includes(tag)) {
                  next = !draft ? tag : draft.startsWith('@') ? `${tag}${draft}` : `${tag}${draft}`
                  setDraft(next)
                }
                onMentionCompanion?.()
                const el = inputRef.current
                if (el) {
                  el.focus()
                  // Cursor after the inserted tag; delay one frame so React has flushed the new value
                  requestAnimationFrame(() => {
                    try { el.setSelectionRange(next.length, next.length) } catch { /* ignore */ }
                    requestAnimationFrame(() => { try { el.setSelectionRange(next.length, next.length) } catch { /* ignore */ } })
                  })
                }
              }}
            >
              <AvatarBadge look={{ style: companion.style, seed: companion.seed, avatarUrl: companion.avatarUrl ?? null }} size={24} />
            </button>
          )}

          {plusOpen && (
            <div className="popover plus-menu" role="menu">
              {mobileForm ? (
                <>
                  <button
                    type="button"
                    className="plus-menu-item"
                    role="menuitem"
                    onMouseDown={keepFocus}
                    onPointerDown={keepFocus}
                    onClick={() => pickFile(cameraInputRef)}
                  >
                    <CameraIcon size={17} />
                    {t('拍照', 'Take photo')}
                  </button>
                  <button
                    type="button"
                    className="plus-menu-item"
                    role="menuitem"
                    onMouseDown={keepFocus}
                    onPointerDown={keepFocus}
                    onClick={() => pickFile(uploadInputRef)}
                  >
                    <PhotoIcon size={17} />
                    {t('从相册选择', 'Photo library')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="plus-menu-item"
                  role="menuitem"
                  onMouseDown={keepFocus}
                  onPointerDown={keepFocus}
                  onClick={() => pickFile(uploadInputRef)}
                >
                  <UploadIcon size={17} />
                  {t('上传图片', 'Upload image')}
                </button>
              )}
              {onStartPoll && (
                <button
                  type="button"
                  className="plus-menu-item"
                  role="menuitem"
                  onMouseDown={keepFocus}
                  onPointerDown={keepFocus}
                  onClick={() => {
                    setPlusOpen(false)
                    onStartPoll()
                  }}
                >
                  <VoteIcon size={17} />
                  {t('投票', 'Poll')}
                </button>
              )}
              {onStartGame && (
                <div className="plus-menu-group">
                  <button
                    type="button"
                    className="plus-menu-item plus-games-row"
                    role="menuitem"
                    aria-expanded={gamesOpen}
                    onMouseDown={keepFocus}
                    onPointerDown={keepFocus}
                    onClick={() => setGamesOpen((v) => !v)}
                  >
                    <GameIcon size={17} />
                    {t('游戏', 'Games')}
                    <span className={`plus-menu-chevron${gamesOpen ? ' is-open' : ''}`}>
                      <ChevronRightIcon size={14} />
                    </span>
                  </button>
                  {gamesOpen && (
                    <div className="plus-menu-sub">
                      {getGameList().map((game) => (
                        <button
                          key={game.id}
                          type="button"
                          className="plus-menu-item plus-menu-subitem"
                          role="menuitem"
                          onMouseDown={keepFocus}
                          onPointerDown={keepFocus}
                          onClick={() => {
                            setPlusOpen(false)
                            setGamesOpen(false)
                            onStartGame(game.id)
                          }}
                        >
                          {game.id === 'gomoku' ? <GomokuIcon size={17} /> : game.id === 'xiangqi' ? <XiangqiGeneralIcon size={17} /> : game.id === 'chess' ? <ChessCrownIcon size={17} /> : game.icon}                          {t(game.name, game.nameEn)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="popover mention-popover" role="listbox" aria-label={t('提及', 'Mention')}>
              {mentionCandidates.map((c, idx) => {
                const isCompanion = c.kind === 'companion'
                const name = isCompanion ? c.displayName : c.member.displayName
                const role = isCompanion ? c.role : (c.member.role ?? '')
                const avatarLook = isCompanion
                  ? { style: c.style, seed: c.seed, avatarUrl: c.avatarUrl ?? null }
                  : { style: c.member.avatarStyle ?? 'lorelei', seed: c.member.avatarSeed ?? '', avatarUrl: c.member.avatarUrl ?? null }
                const key = isCompanion ? `companion-${c.id}` : `whisper-${c.member.userId}`
                return (
                  <button
                    key={key}
                    type="button"
                    className={`mention-item${idx === mentionIndex ? ' is-selected' : ''}`}
                    role="option"
                    aria-selected={idx === mentionIndex}
                    onMouseDown={keepFocus}
                    onPointerDown={keepFocus}
                    onMouseEnter={() => setMentionIndex(idx)}
                    onClick={() => insertMention(c)}
                  >
                    <AvatarBadge look={avatarLook as never} size={28} />
                    <span className="mention-item-main">
                      <span className="mention-name">{name}</span>
                      <span className="mention-role">{role}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <textarea
          ref={inputRef}
          className="composer-input"
          value={draft}
          rows={1}
          maxLength={1000}
          placeholder={privateMode ? (COMPOSER_PRIVATE_PLACEHOLDER[lang] ?? COMPOSER_PLACEHOLDER[lang]) : COMPOSER_PLACEHOLDER[lang]}
          onChange={(e) => { setDraft(e.target.value) }}
          {...ime.imeProps}
          onCompositionStart={(e) => {
            ime.imeProps.onCompositionStart()
            setFrozenQuery(getMentionQuery(draft))
            setIsComposing(true)
            void e
          }}
          onCompositionEnd={(e) => {
            ime.imeProps.onCompositionEnd()
            void e
            // Same one-tick delay as useImeEnter: Safari fires the committing
            // Enter keydown *after* compositionend, so the freeze must outlive
            // it by one tick before the @ list resumes filtering.
            window.setTimeout(() => setIsComposing(false), 0)
          }}
          onKeyDown={(e) => {
            if (mentionOpen) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if (ime.imeConsumesEnter(e)) return
                e.preventDefault()
                const dir = e.key === 'ArrowDown' ? 1 : -1
                const len = mentionCandidates.length || 1
                setMentionIndex((i) => (i + dir + len) % len)
                return
              }
              if (e.key === 'Enter') {
                if (ime.imeConsumesEnter(e)) return
                e.preventDefault()
                insertMention()
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setMentionOpen(false)
                return
              }
            }
            if (e.key === 'Escape' && replyTo) {
              e.preventDefault()
              e.stopPropagation()
              onClearReply()
              return
            }
            if (e.key !== 'Enter' || e.shiftKey) return
            if (ime.imeConsumesEnter(e)) return
            e.preventDefault()
            submit()
          }}
        />

        <div className="composer-zone">
          <button
            type="button"
            className={`composer-side-btn${emojiOpen ? ' is-active' : ''}`}
            aria-label={t('表情', 'Emoji')}
            title={t('表情', 'Emoji')}
            aria-expanded={emojiOpen}
            onMouseDown={keepFocus}
            onPointerDown={keepFocus}
            onClick={() => {
              setEmojiOpen((v) => !v)
              setPlusOpen(false)
              // Same as the plus button: never force focus, so the
              // keyboard neither pops up nor drops on these taps.
            }}
          >
            <EmojiIcon />
          </button>

          {!mobileForm && emojiOpen && <EmojiPanel onInsert={insertEmoji} />}
        </div>

        <button
          type="button"
          className={`composer-send${canSubmit ? '' : ' is-idle'}`}
          aria-disabled={!canSubmit}
          aria-label={t('发送', 'Send')}
          title={t('发送', 'Send')}
          onMouseDown={keepFocus}
          onPointerDown={keepFocus}
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>

      {/* Camera — capture opens the rear camera directly. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onImagePicked(file)
        }}
      />
      {/* Photo library / disk upload — multi-select; the shell caps
          the batch at 5 and tells the player about the cut. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length > 0) onImagesPicked(files)
        }}
      />
    </div>
  )
}
