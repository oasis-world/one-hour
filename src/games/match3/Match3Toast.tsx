import type { Match3ToastData } from './match3ToastTypes'

export default function Match3Toast({ toast }: { toast: Match3ToastData | null }) {
  if (!toast) return null
  return (
    <div key={toast.id} className={`m3-toast-overlay is-${toast.kind}`} role="status" aria-live="polite">
      <span className="m3-toast-spark" aria-hidden="true">✦</span>
      {toast.message
        ? <strong>{toast.message}</strong>
        : <><strong>{toast.title}</strong><b>{toast.amount && toast.amount > 0 ? '+' : ''}{toast.amount?.toLocaleString()}</b></>}
      <span className="m3-toast-spark" aria-hidden="true">✦</span>
    </div>
  )
}
