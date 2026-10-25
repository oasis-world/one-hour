import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { EMOJI_LIST } from '../lib/emoji'
import { useLang } from '../lib/i18n'
import { CameraIcon, EmojiIcon, PlusIcon, SendIcon, UploadIcon } from './icons'

interface Props {
  onSend: (text: string) => void
  /** Photo picked from camera (mobile) or the upload menu (desktop). */
  onImagePicked: (file: File) => void
}

function isCoarsePointer(): boolean {
  try {
    return globalThis.matchMedia?.('(pointer: coarse)').matches ?? false
  } catch {
    return false
  }
}

/**
 * The composer's left button follows the *form factor*, not just touch
 * capability: phones and narrow windows get the camera, wide pointers get
 * the plus menu (a mouse on a touch laptop keeps its keyboard Enter-send).
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
 * The composer pill: plus (camera on touch devices) on the left, the field,
 * emoji and the round send arrow on the right. Elegant and quiet in both
 * themes — everything reads the shell's CSS vars.
 */
export default function Composer({ onSend, onImagePicked }: Props) {
  const lang = useLang()
  const zh = lang === 'zh'
  const [draft, setDraft] = useState('')
  const [plusOpen, setPlusOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [multiline, setMultiline] = useState(false)
  const coarse = isCoarsePointer()
  const mobileForm = useMobileFormFactor()
  const composingRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Auto-grow: mirror the content height, capped by CSS max-height.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const grown = el.scrollHeight > 44
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`
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

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current
    setDraft((prev) => prev + emoji)
    el?.focus()
  }

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
    setEmojiOpen(false)
    // Keep the keyboard up on mobile — the player is mid-conversation.
    if (coarse) inputRef.current?.focus()
  }

  const pickFile = (input: RefObject<HTMLInputElement | null>) => {
    setPlusOpen(false)
    input.current?.click()
  }

  return (
    <div className="composer-dock" ref={rootRef}>
      <div className={`composer${multiline ? ' is-multiline' : ''}`}>
        {mobileForm ? (
          <button
            type="button"
            className="composer-side-btn"
            aria-label={zh ? '拍照发送' : 'Take & send photo'}
            title={zh ? '拍照发送' : 'Take & send photo'}
            onClick={() => pickFile(cameraInputRef)}
          >
            <CameraIcon />
          </button>
        ) : (
          <button
            type="button"
            className={`composer-side-btn${plusOpen ? ' is-active' : ''}`}
            aria-label={zh ? '添加' : 'Add'}
            title={zh ? '添加' : 'Add'}
            aria-expanded={plusOpen}
            onClick={() => {
              setPlusOpen((v) => !v)
              setEmojiOpen(false)
            }}
          >
            <PlusIcon />
          </button>
        )}

        <textarea
          ref={inputRef}
          className="composer-input"
          value={draft}
          rows={1}
          maxLength={500}
          placeholder={zh ? '说点什么…' : 'Say something…'}
          onChange={(e) => setDraft(e.target.value)}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            window.setTimeout(() => {
              composingRef.current = false
            }, 0)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return
            if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
              return
            }
            if (coarse) return
            e.preventDefault()
            submit()
          }}
        />

        <button
          type="button"
          className={`composer-side-btn${emojiOpen ? ' is-active' : ''}`}
          aria-label={zh ? '表情' : 'Emoji'}
          title={zh ? '表情' : 'Emoji'}
          aria-expanded={emojiOpen}
          onClick={() => {
            setEmojiOpen((v) => !v)
            setPlusOpen(false)
          }}
        >
          <EmojiIcon />
        </button>

        <button
          type="button"
          className="composer-send"
          disabled={draft.trim().length === 0}
          aria-label={zh ? '发送' : 'Send'}
          title={zh ? '发送' : 'Send'}
          onClick={submit}
        >
          <SendIcon />
        </button>

        {plusOpen && (
          <div className="popover plus-menu" role="menu">
            <button
              type="button"
              className="plus-menu-item"
              role="menuitem"
              onClick={() => pickFile(uploadInputRef)}
            >
              <UploadIcon />
              {zh ? '上传图片' : 'Upload image'}
            </button>
          </div>
        )}

        {emojiOpen && (
          <div className="popover emoji-panel" role="dialog" aria-label="表情选择">
            <div className="emoji-grid">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-cell"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Camera (mobile) — capture opens the rear camera directly. */}
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
      {/* Gallery / disk upload (desktop menu item). */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onImagePicked(file)
        }}
      />
    </div>
  )
}
