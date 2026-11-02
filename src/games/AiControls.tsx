import { t } from '../lib/i18n'
import AiSourceIcon, { type AiSource } from './AiSourceIcon'
import './AiControls.css'

export function AiModeSwitch({ mode, onChange, thinking = false }: { mode: AiSource; onChange: (mode: AiSource) => void; thinking?: boolean }) {
  return (
    <div className="game-ai-mode" role="group" aria-label={t('AI 对战模式', 'AI opponent mode')}>
      <span className="game-ai-mode-label">AI</span>
      <button type="button" className={mode === 'cloud' ? 'is-active' : ''} aria-pressed={mode === 'cloud'} onClick={() => onChange('cloud')}>
        <AiSourceIcon source="cloud" />{t('云端', 'Cloud')}
      </button>
      <button type="button" className={mode === 'local' ? 'is-active' : ''} aria-pressed={mode === 'local'} onClick={() => onChange('local')}>
        <AiSourceIcon source="local" />{t('本地', 'Local')}
      </button>
      {thinking && <span className="game-ai-mode-spinner" role="status" aria-label={t('AI 正在思考', 'AI is thinking')} />}
    </div>
  )
}
