import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import { setPopoverOpen } from '../lib/popoverGuard'
import type { AiSource } from './AiSourceIcon'
import { setCachedAiMode } from './aiModePreference'
import './GameCardMenu.css'

interface Props {
  aiMode: AiSource
  canChangeAiMode?: boolean
  aiIsThinking?: boolean
  hasAi?: boolean
  onChangeAiMode: (mode: AiSource) => void
  onToggleBoardStyle?: () => void
  onAiTutor?: () => void
}

function CloudMenuIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A3.8 3.8 0 0 0 7 17h12" />
    </svg>
  )
}

function LocalMenuIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4" />
    </svg>
  )
}

function PaletteMenuIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="3" fill="#ef4444" />
      <circle cx="12" cy="4" r="3" fill="#f59e0b" />
      <circle cx="4" cy="12" r="3" fill="#22c55e" />
      <circle cx="12" cy="12" r="3" fill="#3b82f6" />
    </svg>
  )
}

function TutorMenuIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.2 8.3l3.2 3.2 6.4-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KebabIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  )
}

export default function GameCardMenu({ aiMode, onChangeAiMode, onToggleBoardStyle, onAiTutor }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setPopoverOpen(true)
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      setPopoverOpen(false)
    }
  }, [open])

  const close = () => setOpen(false)

  const handlePickMode = (mode: AiSource) => {
    setCachedAiMode(mode)
    onChangeAiMode(mode)
    close()
  }

  return (
    <div ref={rootRef} className="game-card-menu-root">
      <button
        type="button"
        className="game-card-menu-trigger"
        aria-label={t('更多操作', 'More actions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <KebabIcon size={16} />
      </button>
      {open && (
        <div className="game-card-menu-pop" role="menu" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={aiMode === 'local'}
            className={`game-card-menu-item${aiMode === 'local' ? ' is-active' : ''}`}
            onClick={() => handlePickMode('local')}
          >
            <span className="game-card-menu-icon"><LocalMenuIcon /></span>
            <span className="game-card-menu-label">{t('本地 AI', 'Local AI')}</span>
            {aiMode === 'local' && <span className="game-card-menu-check"><CheckIcon /></span>}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={aiMode === 'cloud'}
            className={`game-card-menu-item${aiMode === 'cloud' ? ' is-active' : ''}`}
            onClick={() => handlePickMode('cloud')}
          >
            <span className="game-card-menu-icon"><CloudMenuIcon /></span>
            <span className="game-card-menu-label">{t('云端 AI', 'Cloud AI')}</span>
            {aiMode === 'cloud' && <span className="game-card-menu-check"><CheckIcon /></span>}
          </button>
          <div className="game-card-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="game-card-menu-item"
            onClick={() => { onToggleBoardStyle?.() }}
          >
            <span className="game-card-menu-icon"><PaletteMenuIcon /></span>
            <span className="game-card-menu-label">{t('切换界面', 'Switch UI')}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="game-card-menu-item"
            onClick={() => { onAiTutor?.(); close() }}
          >
            <span className="game-card-menu-icon"><TutorMenuIcon /></span>
            <span className="game-card-menu-label">{t('AI 教学', 'AI Tutor')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
