import { COMPANION_STORE, idbClear, idbDelete, idbGetAll, idbPut } from './idb'

export interface CompanionMessage {
  id: string
  from: 'user' | 'companion'
  content: string
  at: number
  expiresAt: number
  kind?: 'greeting'
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function companionMessageExpiresAt(at: number): number { return at + 60 * 60 * 1000 }

export async function loadCompanionMessages(): Promise<CompanionMessage[]> {
  const rows = await idbGetAll<CompanionMessage>(COMPANION_STORE)
  if (!rows) return []
  const now = Date.now()
  return rows.filter((r) => r && typeof r.id === 'string' && r.expiresAt > now).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
}

export async function saveCompanionMessage(msg: CompanionMessage): Promise<void> { await idbPut(COMPANION_STORE, msg) }

export async function removeCompanionMessage(id: string): Promise<void> { await idbDelete(COMPANION_STORE, id) }

export async function clearCompanionMessages(): Promise<void> { await idbClear(COMPANION_STORE) }

export async function pruneCompanionMessages(): Promise<void> {
  const rows = await idbGetAll<CompanionMessage>(COMPANION_STORE)
  if (!rows) return
  const now = Date.now()
  for (const r of rows) if (r.expiresAt <= now) await idbDelete(COMPANION_STORE, r.id)
}

export function createUserCompanionMessage(content: string, at = Date.now()): CompanionMessage {
  return { id: newId(), from: 'user', content, at, expiresAt: companionMessageExpiresAt(at) }
}

export function createCompanionReply(content: string, at = Date.now()): CompanionMessage {
  return { id: newId(), from: 'companion', content, at, expiresAt: companionMessageExpiresAt(at) }
}
