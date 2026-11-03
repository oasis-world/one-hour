import type { ComponentType } from 'react'
import type { PresenceMember } from '../lib/chatTypes'

export interface GameComponentProps {
  instanceId: string
  hostUserId: string
  onlineMembers?: PresenceMember[]
}

export interface GameDefinition {
  id: string
  name: string
  nameEn: string
  /** Compact icon (emoji or short text) for the games menu. */
  icon: string
  minPlayers: number
  maxPlayers: number
  Component: ComponentType<GameComponentProps>
}

/** Parsed from a chat message body. */
export interface GameRef {
  type: string
  instanceId: string
}

export const GAME_MARKER = '__GAME__:'

export function parseGameRef(content: string): GameRef | null {
  const idx = content.indexOf(GAME_MARKER)
  if (idx === -1) return null
  const rest = content.slice(idx + GAME_MARKER.length).trim()
  const parts = rest.split(':')
  if (parts.length < 2) return null
  const type = parts[0]?.trim()
  const instanceId = parts.slice(1).join(':').trim().split(/\s/)[0]
  if (!type || !instanceId) return null
  return { type, instanceId }
}

export function isGameMessage(content: string): boolean {
  return parseGameRef(content) !== null
}
