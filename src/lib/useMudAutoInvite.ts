import { useEffect, useRef } from 'react'
import type { PresenceMember } from './chatTypes'
import type { CompanionProfile } from './companionProfile'
import type { ChatEntry } from './chatTypes'
import { selectMudParty } from './mudSelect'
import { buildInviteText, buildMudBlueprint, buildOpeningScene } from './mudTemplates'
import { requestMudScene, aiPayloadToScene } from './mudGeneration'
import { createInitialMudState, saveMudState } from '../games/mud/cloudState'
import { getLang } from './i18n'

export function useMudAutoInvite(
  profile: unknown,
  companion: CompanionProfile | null,
  presence: PresenceMember[],
  entries: ChatEntry[],
  roomSend: (text: string) => void,
  roomStatus: string,
  identity: { userId: string } | null,
  fold: string,
  hasRevealed: boolean,
): void {
  const triggeredRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!profile || !companion || !identity || !hasRevealed || fold !== 'open') return
    if (roomStatus === 'closed' || roomStatus === 'error') return
    const key = `one-hour-mud-invited:${companion.id}`
    if (triggeredRef.current === companion.id) return
    try { if (globalThis.localStorage?.getItem(key)) { triggeredRef.current = companion.id; return } } catch { /* ignore */ }
    if (presence.length < 3) return
    // Deduplicate across clients: if a recent MUD card already exists, don't create another
    const hasRecentMud = entries.some((e) => e.content.includes('__GAME__:mud:') && Date.now() - e.at < 5 * 60 * 1000)
    if (hasRecentMud) { triggeredRef.current = companion.id; try { localStorage.setItem(key, '1') } catch { /* ignore */ }; return }

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      // Re-check deduplication right before sending (another client may have sent in the 3s window)
      const hasRecentMudNow = entries.some((e) => e.content.includes('__GAME__:mud:') && Date.now() - e.at < 5 * 60 * 1000)
      if (hasRecentMudNow) return
      const party = selectMudParty(presence, identity.userId, companion.id)
      if (!party || party.length < 2) return
      triggeredRef.current = companion.id
      try { globalThis.localStorage?.setItem(key, '1') } catch { /* ignore */ }

      const lang = getLang()
      const isZh = lang.startsWith('zh')
      const inviteText = buildInviteText(party, companion.name, isZh)

      void (async () => {
        try { roomSend(inviteText) } catch { /* ignore */ }

        const instanceId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
        const blueprint = buildMudBlueprint(party)
        let scene = buildOpeningScene(blueprint, party, lang)
        try {
          const ai = await requestMudScene(blueprint, party, lang)
          if (ai) scene = aiPayloadToScene(ai)
        } catch { /* fallback to template */ }

        const invited = party.map((p) => ({ userId: p.userId, displayName: p.displayName, role: p.role ?? '' }))
        const state = createInitialMudState(instanceId, identity.userId, invited, blueprint, scene, lang)

        const title = isZh ? blueprint.title : blueprint.titleEn
        const cardText = `🎮 ${title}\n__GAME__:mud:${instanceId}`
        // Send card first so state can be saved without card-existence check failure
        try { roomSend(cardText) } catch { /* ignore */ }
        // Small delay to let message propagate before saving state
        await new Promise((r) => setTimeout(r, 400))
        try { await saveMudState(instanceId, state) } catch { /* ignore */ }
      })()
    }, 3000)

    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [profile, companion, presence, entries, roomSend, roomStatus, identity, fold, hasRevealed])
}
