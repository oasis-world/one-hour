import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useLang, COMPOSER_PLACEHOLDER, t } from '../lib/i18n'
import { useImeEnter } from '../lib/ime'
import { CameraIcon, EmojiIcon, PlusIcon, SendIcon, UploadIcon } from './icons'
import { PhotoIcon } from './userIcons'
import EmojiPanel from './EmojiPanel'

interface Props {
  onSend: (text: string) => void
  /** Photo from the camera (single shot). */
  onImagePicked: (file: File) => void
  /** Photos from the library — up to 5, sent as independent messages. */
  onImagesPicked: (files: File[]) => void
  /** Notifies the shell while a popover is up (mobile hides the gear). */
  onMenuOpenChange?: (open: boolean) => void
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
export default function Composer({ onSend, onImagePicked, onImagesPicked, onMenuOpenChange }: Props) {
  const lang = useLang()
  const [draft, setDraft] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const coarse = isCoarsePointer()
  const mobileForm = useMobileFormFactor()
  const ime = useImeEnter()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

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
    if (!plusOpen && !emojiOpen) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPlusOpen(false)
        setEmojiOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [plusOpen, emojiOpen])

  useEffect(() => {
    onMenuOpenChange?.(plusOpen || emojiOpen)
  }, [plusOpen, emojiOpen, onMenuOpenChange])

  /**
   * Insert without touching focus: mousedown on the panel is prevented,
   * so the field keeps (or keeps losing) the keyboard exactly as it was.
   */
  const insertEmoji = (emoji: string) => {
    setDraft((prev) => prev + emoji)
  }

  const submit = () => {
    const text = draft.trim()
    if (text) {
      onSend(text)
      setDraft('')
      setEmojiOpen(false)
    }
    // Keep the keyboard up on mobile — the player is mid-conversation,
    // even when the tap landed on the gray (empty) send button.
    if (coarse) inputRef.current?.focus()
  }

  /** Side-button taps must not steal the field's focus (the keyboard
      would drop on Android, which moves focus on mousedown/pointerdown). */
  const keepFocus = (e: React.SyntheticEvent) => e.preventDefault()

  const pickFile = (input: RefObject<HTMLInputElement | null>) => {
    setPlusOpen(false)
    input.current?.click()
  }

  return (
    <div className="composer-dock" ref={rootRef}>
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
              // Leave the keyboard exactly as it is: no focus() call here.
              // The pointerdown preventDefault above already keeps an open
              // keyboard up, and a closed one stays down.
            }}
          >
            <PlusIcon />
          </button>

          {plusOpen && (
            <div className="popover plus-menu" role="menu">
              {mobileForm ? (
                <>
                  <button
                    type="button"
                    className="plus-menu-item"
                    role="menuitem"
                    onClick={() => pickFile(cameraInputRef)}
                  >
                    <CameraIcon size={17} />
                    {t('拍照', 'Take photo')}
                  </button>
                  <button
                    type="button"
                    className="plus-menu-item"
                    role="menuitem"
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
                  onClick={() => pickFile(uploadInputRef)}
                >
                  <UploadIcon size={17} />
                  {t('上传图片', 'Upload image')}
                </button>
              )}
            </div>
          )}
        </div>

        <textarea
          ref={inputRef}
          className="composer-input"
          value={draft}
          rows={1}
          maxLength={1000}
          placeholder={COMPOSER_PLACEHOLDER[lang]}
          onChange={(e) => setDraft(e.target.value)}
          {...ime.imeProps}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return
            // Guard IME confirmation (candidates) — that Enter commits
            // the composition, it must not send.
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

          {emojiOpen && <EmojiPanel onInsert={insertEmoji} />}
        </div>

        <button
          type="button"
          className={`composer-send${draft.trim().length === 0 ? ' is-idle' : ''}`}
          aria-disabled={draft.trim().length === 0}
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
      {/* Photo library / disk upload — up to 5 at once. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 5)
          e.target.value = ''
          if (files.length > 0) onImagesPicked(files)
        }}
      />
    </div>
  )
}
