import { useRef, useState, type ChangeEvent } from 'react'
import { useLang } from '../lib/i18n'
import { uploadAvatarImage } from '../lib/avatarUpload'
import type { AvatarLook } from '../lib/avatar'
import AvatarBadge from './AvatarBadge'
import StylePicker from './StylePicker'
import { UploadIcon } from './icons'
import { GridIcon, RefreshIcon } from './userIcons'

/**
 * The avatar editing block shared by the welcome gate and the profile
 * page: the big face with a tool cluster — reroll, the DiceBear style
 * catalog dropdown, and an upload button for a custom photo (center-
 * cropped, stored in the cloud bucket, rendered by URL everywhere).
 */
export default function AvatarEditor({
  look,
  size,
  avatarClassName,
  rerollLabel,
  allowUpload = false,
  onReroll,
  onPickStyle,
  onUploaded,
}: {
  look: AvatarLook & { url?: string | null }
  size: number
  avatarClassName?: string
  rerollLabel?: string
  /** Custom-photo upload is a signed-in privilege, profile page only. */
  allowUpload?: boolean
  onReroll: () => void
  onPickStyle: (style: string, rerollSeed: boolean) => void
  onUploaded: (url: string) => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    const url = await uploadAvatarImage(file)
    setUploading(false)
    if (url) {
      setPickerOpen(false)
      onUploaded(url)
    }
  }

  return (
    <div className="avatar-editor">
      <div className="welcome-avatar-wrap">
        <AvatarBadge look={look} size={size} className={avatarClassName ?? 'welcome-avatar'} />
        <div className="welcome-avatar-tools">
          <button
            type="button"
            className="welcome-reroll"
            onClick={onReroll}
            aria-label={rerollLabel ?? (zh ? '换一个头像' : 'Reroll avatar')}
            title={rerollLabel ?? (zh ? '换一个' : 'Reroll')}
          >
            <RefreshIcon size={15} />
          </button>
          <button
            type="button"
            className={`welcome-custom${pickerOpen ? ' is-open' : ''}`}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label={zh ? '选择风格' : 'Choose a style'}
            title={zh ? '选择风格' : 'Styles'}
            aria-expanded={pickerOpen}
          >
            <GridIcon size={15} />
          </button>
          {allowUpload && (
            <button
              type="button"
              className="welcome-upload"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label={zh ? '上传自己的头像' : 'Upload your photo'}
              title={zh ? '上传自己的头像' : 'Upload your photo'}
            >
              <UploadIcon size={15} />
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <StylePicker seed={look.seed} currentStyle={look.style} onPick={onPickStyle} />
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  )
}
