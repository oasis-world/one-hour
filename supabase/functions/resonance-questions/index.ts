import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// ── Gemini Developer API — generates icebreaker "同频" questions ──
// Single-file to avoid Supabase bundler issues; mirrors game-ai-move.

type Locale = string
type Localized = Record<string, string>
interface ResonanceOption { id: string; emoji: string; label: Localized }
interface ResonanceQuestion { id: string; prompt: Localized; options: ResonanceOption[] }

const LANGS = ['zh', 'zh-TW', 'en', 'ja', 'fr', 'es', 'de', 'ko', 'it', 'ar'] as const

const GEMINI_MODEL = 'gemini-3.5-flash-lite'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const LOCALE_NAMES: Record<string, string> = {
  zh: 'Simplified Chinese (简体中文)', 'zh-TW': 'Traditional Chinese', en: 'English',
  ja: 'Japanese', fr: 'French', es: 'Spanish', de: 'German', ko: 'Korean', it: 'Italian', ar: 'Arabic',
}

function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)) }

function parseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { /* fall through */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  const a = text.indexOf('['), z = text.lastIndexOf(']')
  const slice = s >= 0 && e > s ? text.slice(s, e + 1) : (a >= 0 && z > a ? text.slice(a, z + 1) : '')
  if (!slice) return null
  try { return JSON.parse(slice) } catch { return null }
}

function asLocalized(raw: unknown): Localized | null {
  if (!isRecord(raw)) return null
  const out: Localized = {}
  for (const lang of LANGS) {
    const value = raw[lang]
    if (typeof value === 'string' && value.trim()) out[lang] = value.trim().slice(0, 160)
  }
  return Object.keys(out).length ? out : null
}

/** Fill any languages the model skipped with the English value. */
function completeLocalized(value: Localized): Localized {
  const fallback = value.en ?? value.zh ?? Object.values(value)[0] ?? ''
  const out: Localized = { ...value }
  for (const lang of LANGS) if (!out[lang]) out[lang] = fallback
  return out
}

function validate(raw: unknown): ResonanceQuestion[] {
  const list = Array.isArray(raw) ? raw : (isRecord(raw) && Array.isArray(raw.questions) ? raw.questions : [])
  const out: ResonanceQuestion[] = []
  for (const item of list) {
    if (!isRecord(item)) continue
    const prompt = asLocalized(item.prompt)
    if (!prompt || !Array.isArray(item.options)) continue
    const options: ResonanceOption[] = []
    item.options.slice(0, 4).forEach((o, i) => {
      if (!isRecord(o)) return
      const label = asLocalized(o.label)
      if (!label) return
      options.push({
        id: typeof o.id === 'string' ? o.id : String.fromCharCode(97 + i),
        emoji: typeof o.emoji === 'string' ? o.emoji : '✦',
        label: completeLocalized(label),
      })
    })
    if (options.length >= 2) {
      out.push({
        id: typeof item.id === 'string' ? item.id : `q-${Math.random().toString(36).slice(2, 9)}`,
        prompt: completeLocalized(prompt),
        options,
      })
    }
    if (out.length >= 5) break
  }
  return out
}

/** Cheap stable fingerprint so repeated question sets are obvious in logs. */
function fingerprint(questions: ResonanceQuestion[]): string {
  const seed = questions.map((q) => q.prompt.en).join('|')
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

async function generate(count: number, locale: Locale): Promise<ResonanceQuestion[]> {
  const key = Deno.env.get('GEMINI_API_KEY')
  console.info('[resonance:debug] generate() called', {
    at: new Date().toISOString(), count, locale, hasKey: Boolean(key),
    model: GEMINI_MODEL, endpoint: GEMINI_ENDPOINT,
  })
  if (!key) throw Object.assign(new Error('AI service is not configured'), { status: 503 })
  const primary = LOCALE_NAMES[locale] ?? LOCALE_NAMES.en
  const system = `You write playful, inclusive icebreaker polls for a small anonymous chat room where people stay exactly one hour. Each poll is a light "choose one" question that sparks friendly conversation — never political, never personal data, never offensive.

Return ONLY a JSON array of ${count} objects. Every string field must be a translation map with ALL TEN of these exact language keys:
zh, zh-TW, en, ja, fr, es, de, ko, it, ar

Shape of each object:
{"prompt":{"zh":"简体中文问题","zh-TW":"繁體中文問題","en":"English question","ja":"日本語","fr":"Français","es":"Español","de":"Deutsch","ko":"한국어","it":"Italiano","ar":"العربية"},
 "options":[{"id":"a","emoji":"🌊","label":{"zh":"选项","zh-TW":"選項","en":"Option","ja":"選択","fr":"Option","es":"Opción","de":"Option","ko":"선택","it":"Opzione","ar":"خيار"}}, ... 2-4 options]}

Rules:
- Provide a natural, idiomatic translation for ALL TEN languages in both the prompt and every option label — no placeholders, no copying English unless the language genuinely uses a loanword. The viewer's own language is ${primary}; make that version especially warm.
- Options are short (2-8 words), parallel in tone, each with a fitting single emoji.
- Cover varied everyday themes: food, travel, weekend plans, weather, hobbies, small whimsical "would you rather" ideas.
- Each question must have 2 to 4 options with unique ids a/b/c/d.
- No markdown, no code fences, no prose — output the raw JSON array only.`

  const upstream = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: `Generate ${count} questions. Output the JSON array now.` }] }],
      generationConfig: { maxOutputTokens: 16384, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!upstream.ok) {
    const f = await upstream.json().catch(() => null)
    const code = typeof f?.error?.message === 'string' ? f.error.message : upstream.status
    console.error('[resonance:debug] Gemini upstream FAILED', upstream.status, code, 'body=', JSON.stringify(f).slice(0, 800))
    throw Object.assign(new Error('AI upstream request failed'), { status: 502 })
  }
  const result = await upstream.json() as Record<string, unknown>
  const candidates = result.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
  const text = candidates?.[0]?.content?.parts?.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') ?? ''
  console.info('[resonance:debug] Gemini upstream OK', {
    httpStatus: upstream.status,
    textLength: text.length,
    finishReason: (result.candidates?.[0] as { finishReason?: unknown } | undefined)?.finishReason,
    usage: result.usageMetadata,
    rawSnippet: text.slice(0, 1000),
  })
  if (!text) throw Object.assign(new Error('Gemini returned no text'), { status: 502 })
  const parsed = parseJson(text)
  console.info('[resonance:debug] parseJson result', { isNull: parsed === null, isArray: Array.isArray(parsed), topKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed as object) : [] })
  const questions = validate(parsed)
  if (questions.length === 0) {
    console.error('[resonance:debug] validate() produced ZERO questions — client will use LOCAL SEED fallback. parsedSnippet=', JSON.stringify(parsed).slice(0, 1200))
    throw Object.assign(new Error('Gemini returned no valid questions'), { status: 502 })
  }
  console.info('[resonance:debug] AI questions ACCEPTED', {
    count: questions.length,
    fingerprint: fingerprint(questions),
    promptsZh: questions.map((q) => q.prompt.zh),
    promptsEn: questions.map((q) => q.prompt.en),
    optionCounts: questions.map((q) => q.options.length),
  })
  return questions
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  if (!await isAuthenticatedUser(request)) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  try {
    const body = await request.json() as Record<string, unknown>
    const count = Math.min(5, Math.max(1, Number(body.count) || 5))
    const locale = typeof body.locale === 'string' ? body.locale : 'zh'
    const questions = await generate(count, locale)
    console.info('[resonance:debug] RETURNING 200 to client', {
      count: questions.length, fingerprint: fingerprint(questions),
      firstPromptEn: questions[0]?.prompt.en,
    })
    return new Response(JSON.stringify({ questions, model: GEMINI_MODEL, provider: 'gemini' }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (error) {
    const err = error as Error & { status?: number }
    const status = typeof err.status === 'number' ? err.status : 502
    console.error('[resonance] Function error', err.message)
    return new Response(JSON.stringify({ error: err.message ?? 'AI request failed' }), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

async function isAuthenticatedUser(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultPublishableKey()
  if (!authorization?.startsWith('Bearer ') || !projectUrl || !anonKey) return false
  try {
    const r = await fetch(`${projectUrl}/auth/v1/user`, { headers: { authorization, apikey: anonKey } })
    return r.ok
  } catch { return false }
}
function defaultPublishableKey(): string | undefined {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined }
}
