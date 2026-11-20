import { useLang } from '../../lib/i18n'
import { rt } from './resonanceText'
import './ResonanceLoading.css'

/** Animated waiting state while questions are generated / room connects. */
export default function ResonanceLoading({ offline = false }: { offline?: boolean }) {
  const lang = useLang()
  return (
    <div className="res-loading" role="status" aria-live="polite">
      <div className="res-loader" aria-hidden="true">
        <span className="res-loader-halo" />
        <span className="res-loader-ring" />
        <span className="res-loader-ring res-loader-ring-2" />
        <span className="res-loader-ring res-loader-ring-3" />
        <span className="res-loader-core" />
        <span className="res-loader-dot res-loader-dot-a" />
        <span className="res-loader-dot res-loader-dot-b" />
      </div>
      <p className="res-loading-text">
        {rt(offline ? 'Connecting to the room…' : 'Generating questions…', lang)}
        <span className="res-loading-dots"><i /><i /><i /></span>
      </p>
    </div>
  )
}
