import { useEffect } from 'react'
import { useLang } from '../lib/i18n'
import { ThinXIcon } from './icons'

/** Fullscreen photo viewer: click the backdrop, the X, or Esc to leave. */
export default function ImageViewer({
  src,
  onClose,
}: {
  src: string
  onClose: () => void
}) {
  const lang = useLang()
  const zh = lang === 'zh'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={zh ? '查看图片' : 'View photo'}
      onClick={onClose}
    >
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
      <button
        type="button"
        className="image-viewer-close"
        aria-label={zh ? '关闭' : 'Close'}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <ThinXIcon size={17} />
      </button>
    </div>
  )
}
