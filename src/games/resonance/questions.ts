import { getLang, type Lang } from '../../lib/i18n'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { toLocalized } from './localized'
import { localSeed } from './seedQuestions'
import type { ResonanceQuestion } from './types'

export interface GeneratedQuestions {
  questions: ResonanceQuestion[]
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

/** Ask the Edge Function for a fresh, fully-localized batch of icebreakers. */
export async function requestQuestions(locale: Lang = getLang()): Promise<GeneratedQuestions> {
  try {
    const client = await getSupabaseClient()
    const { data, error } = await client.functions.invoke('resonance-questions', {
      body: { locale, count: 5 },
    })
    if (error) {
      const detail = error.context instanceof Response
        ? await error.context.clone().text().catch(() => error.message)
        : error.message
      console.warn('[resonance:client] AI questions FAILED → LOCAL SEED fallback.', detail)
      return { questions: localSeed() }
    }
    const parsed = data?.questions
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn('[resonance:client] No questions in 200 response → LOCAL SEED fallback.', data)
      return { questions: localSeed() }
    }
    const questions = parsed.map(normalizeQuestion).filter(Boolean) as ResonanceQuestion[]
    console.info('[resonance:client] AI questions used.', {
      provider: data?.provider, model: data?.model,
      count: questions.length, promptsEn: questions.map((q) => q.prompt.en),
    })
    return {
      questions: questions.length ? questions : localSeed(),
      usage: data?.usage,
    }
  } catch (error) {
    console.warn('[resonance] AI questions unavailable; using local set.', error)
    return { questions: localSeed() }
  }
}

function normalizeQuestion(raw: unknown): ResonanceQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const prompt = toLocalized(q.prompt)
  if (!prompt || !Array.isArray(q.options)) return null
  const options = q.options.slice(0, 4).map((o) => {
    const opt = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
    const label = toLocalized(opt.label)
    return {
      emoji: typeof opt.emoji === 'string' ? opt.emoji : '✦',
      label,
    }
  }).filter((o) => o.label !== null) as Array<{ emoji: string; label: NonNullable<ReturnType<typeof toLocalized>> }>
  if (options.length < 2) return null
  // IDs are ALWAYS positional letters so option_index ↔ id round-trips exactly.
  const withIds: ResonanceQuestion['options'] = options.map((o, i) => ({
    id: String.fromCharCode(97 + i),
    emoji: o.emoji,
    label: o.label,
  }))
  return {
    id: typeof q.id === 'string' ? q.id : `q-${Math.random().toString(36).slice(2, 9)}`,
    prompt,
    options: withIds,
  }
}
