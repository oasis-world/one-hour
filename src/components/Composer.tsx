import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ChatEntry, MessageReply } from '../lib/chatTypes'
import { COMPOSER_PLACEHOLDER, COMPOSER_PRIVATE_PLACEHOLDER, useLang, t } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { setPopoverOpen, suppressNextClick } from '../lib/popoverGuard'
import { markFilePickerOpened } from '../lib/filePickerGuard'
import { CameraIcon, ChessCrownIcon, ChevronRightIcon, EmojiIcon, GameIcon, GomokuIcon, MudIcon, PlusIcon, SendIcon, ThinXIcon, UploadIcon, XiangqiGeneralIcon } from './icons'
import { PhotoIcon } from './userIcons'
import EmojiPanel from './EmojiPanel'
import AvatarBadge from './AvatarBadge'
import type { CompanionProfile } from '../lib/companionProfile'
import { getGameList } from '../games/registry'

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
  /** Notifies the shell while a popover is up (mobile hides the gear). */
  onMenuOpenChange?: (open: boolean) => void
  companion?: CompanionProfile | null
  onMentionCompanion?: () => void
  privateMode?: boolean
  onExitPrivateChat?: () => void
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
export default function Composer({ onSend, replyTo, onClearReply, editing, onClearEditing, onEdit, onImagePicked, onImagesPicked, onMenuOpenChange, onStartGame, companion, onMentionCompanion, privateMode, onExitPrivateChat }: Props) {
  const lang = useLang()
  const [draft, setDraft] = useState(editing?.content ?? '')
  const [plusOpen, setPlusOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [gamesOpen, setGamesOpen] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionIndex, setMentionIndex] = useState(0)
  const coarse = isCoarsePointer()
  const mobileForm = useMobileFormFactor()
  const ime = useImeEnter()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const updateMentionState = (value: string) => {
    if (!companion) { setMentionOpen(false); return }
    const lastAt = value.lastIndexOf('@')
    if (lastAt === -1) { setMentionOpen(false); return }
    const after = value.slice(lastAt)
    const tag = `@${companion.name}`
    const tagWithSpace = `${tag} `
    if (after === tag || after === tagWithSpace || after.startsWith(tagWithSpace) || after.startsWith(tag)) {
      setMentionOpen(false)
      return
    }
    setMentionOpen(true)
    setMentionIndex(0)
  }

  const mentionCandidates = companion ? [companion] : []
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

  // Sync mention popover with draft
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { updateMentionState(draft) }, [draft, companion])

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

  const insertMention = (candidate?: CompanionProfile) => {
    const target = candidate ?? (mentionCandidates[mentionIndex] ?? companion)
    if (!target) return
    const lastAt = draft.lastIndexOf('@')
    const tag = `@${target.name} `
    const newDraft = lastAt === -1 ? tag : draft.slice(0, lastAt) + tag
    setDraft(newDraft)
    setMentionOpen(false)
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
            <span>{(replyTo.content || '').split('\n__GAME__:')[0].trim() || (replyTo.hasImage ? t('图片', 'Image') : '')}</span>
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
                          {game.id === 'gomoku' ? <GomokuIcon size={17} /> : game.id === 'xiangqi' ? <XiangqiGeneralIcon size={17} /> : game.id === 'chess' ? <ChessCrownIcon size={17} /> : game.id === 'mud' ? <MudIcon size={17} /> : game.icon}
                          {t(game.name, game.nameEn)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {mentionOpen && companion && (
            <div className="popover mention-popover" role="listbox" aria-label={t('提及', 'Mention')}>
              {mentionCandidates.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className={`mention-item${idx === mentionIndex ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={idx === mentionIndex}
                  onMouseDown={keepFocus}
                  onPointerDown={keepFocus}
                  onMouseEnter={() => setMentionIndex(idx)}
                  onClick={() => insertMention(c)}
                >
                  <AvatarBadge look={{ style: c.style, seed: c.seed, avatarUrl: c.avatarUrl ?? null }} size={28} />
                  <span className="mention-item-main">
                    <span className="mention-name">{c.name}</span>
                    <span className="mention-role">{c.role}</span>
                  </span>
                </button>
              ))}
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
