import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASETEN_MODEL = 'meta-models/muse-spark-open-1026'
const BASETEN_ENDPOINT = 'https://inference.baseten.co/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    if (!await isAuthenticated(req)) return json({ error: 'Authentication required' }, 401)
  } catch {
    return json({ error: 'Authentication check failed' }, 401)
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const {
    actionText, locationId, districtId, roomName, player, lang, narrativeLang, recentLog, globalEvent,
  } = body as {
    actionText?: string; locationId?: string; districtId?: string; roomName?: string
    player?: { displayName?: string; role?: string }; lang?: string; narrativeLang?: string; recentLog?: unknown[]; globalEvent?: string | null
  }
  if (typeof actionText !== 'string' || !actionText.trim()) return json({ error: 'Missing actionText' }, 400)

  const apiKey = Deno.env.get('BASETEN_API_KEY')
  if (!apiKey) {
    console.warn('[world-mud-narrate] missing BASETEN_API_KEY — returning fallback (check Supabase Edge Secrets)')
    const fb = fallback(reqLang(narrativeLang ?? lang), actionText, locationId, roomName, reqLang(lang))
    return json({ ...fb, _fallback: 'missing-baseten-key', _debug: 'BASETEN_API_KEY not set in Edge Secrets' })
  }

  const playerDesc = `${player?.displayName ?? 'Traveler'} (${player?.role ?? 'adventurer'})`
  const logSnippet = Array.isArray(recentLog) ? recentLog.slice(-6).map((e: unknown) => {
    const r = e as Record<string, unknown>
    return `${r.displayName ?? ''}: ${r.action ?? ''} → ${r.result ?? ''}`
  }).join('\n') : ''

  const langName: Record<string, string> = {
    zh: 'Simplified Chinese (zh)', 'zh-TW': 'Traditional Chinese (zh-TW)', en: 'English', ja: 'Japanese',
    fr: 'French', es: 'Spanish', de: 'German', ko: 'Korean', it: 'Italian', ar: 'Arabic',
  }
  const uiLang = lang ?? 'zh'
  const narrLang = narrativeLang ?? lang ?? 'zh'
  const uiLangName = langName[uiLang] ?? langName.en
  const narrLangName = langName[narrLang] ?? langName.en

  // Narrative follows input language, choices follow UI language — keep buttons in page language
  const langRule = uiLang === narrLang
    ? (uiLang.startsWith('en')
      ? 'CRITICAL LANGUAGE RULE: Respond ONLY in English. All narrative/choices/broadcast must be 100% English.'
      : `CRITICAL LANGUAGE RULE: Respond ONLY in ${uiLangName}. All narrative/choices/broadcast must be 100% that language.`)
    : `CRITICAL LANGUAGE RULE: NARRATIVE must be ONLY in ${narrLangName} (code ${narrLang}). CHOICES+hint must be ONLY in ${uiLangName} (code ${uiLang}). Broadcast may be in ${narrLangName}. Never mix.`
  const sysPrompt = `You are the living narrator of a persistent shared MUD world "The Eternal Hourglass".
World: one eternal city where every soul lives 1 hour. Districts: plaza/ruin/lab/forest/ocean/city/tavern/academy. No fixed plot — AI + players co-evolve it.
Player: ${playerDesc}, at ${roomName ?? locationId} in district ${districtId ?? 'plaza'}.
Recent world log:
${logSnippet || '(world just awoke)'}
${globalEvent ? `Global event: ${globalEvent}` : ''}
Narrative language: ${narrLangName} (code ${narrLang}) — narrative MUST be this language.
Choices language: ${uiLangName} (code ${uiLang}) — choices MUST be this language (buttons stay in page language).
${langRule}
Rules:
- Narrative: MUST be 3-4 sentences, 80-150 words (150-300 characters for CJK like ja/zh/ko), vivid second-person, rich sensory detail (sight/sound/smell), specific to room and action, hint at consequences or next hooks. Must be equally long and detailed in ALL languages — Japanese/Chinese/Korean must NOT be shorter than English. Never 1 short sentence or a few words; never generic filler.
- Choices: 3-4 short action labels (4-10 chars each) reflecting what to do next. Labels must be in choices language (${uiLangName}).
- Broadcast: very short 3-8 word summary in narrative language.
Output ONLY valid JSON: {"narrative": string, "choices": [{"label": string, "action": string, "icon": string?}], "broadcast": string, "hint": string?}
action is snake_case command the client sends back (e.g. "go_north", "talk", "search", "look").
No fixed NPC dialogue — improvise NPCs as needed.
Never break JSON.`

  try {
    const upstream = await fetch(BASETEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: BASETEN_MODEL,
        messages: [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: `Player action: "${actionText}"\nCurrent room: ${roomName ?? locationId}\nNarrative: MUST be ${narrLangName} only. Choices: MUST be ${uiLangName} only. Never swap.` },
        ],
        max_completion_tokens: 20000,
        temperature: 0.9,
        top_p: 0.95,
        response_format: { type: 'json_object' } as unknown as Record<string, unknown>,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => '')
      console.warn('[world-mud-narrate] upstream', upstream.status, t.slice(0, 600))
      const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
      return json({ ...fb, _fallback: `upstream-${upstream.status}`, _debug: t.slice(0, 300) })
    }
    const result = await upstream.json() as Record<string, unknown>
    const usage = result.usage as Record<string, unknown> | undefined
    console.log('[world-mud-narrate] upstream ok', { model: BASETEN_MODEL, usage, finishReason: (result.choices as unknown as Array<{ finish_reason?: string }>)?.[0]?.finish_reason })
    const choice = (result.choices as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined
    const msg = (choice?.message ?? {}) as Record<string, unknown>
    // Baseten/muse may put reasoning in separate fields — try all known slots
    let text = ''
    if (typeof msg.content === 'string' && msg.content.trim()) text = msg.content
    else if (Array.isArray(msg.content)) text = (msg.content as unknown[]).map((p: unknown) => (p as { text?: string })?.text ?? '').join('')
    // fallback slots for reasoning models
    if (!text.trim() && typeof (msg as { reasoning_content?: unknown }).reasoning_content === 'string') text = (msg as { reasoning_content: string }).reasoning_content
    if (!text.trim() && typeof (choice as { text?: unknown })?.text === 'string') text = (choice as { text: string }).text
    if (!text.trim() && typeof (result as { output_text?: unknown }).output_text === 'string') text = (result as { output_text: string }).output_text
    text = text.trim()
    if (!text) {
      const full = JSON.stringify(result)
      console.warn('[world-mud-narrate] empty upstream content', full.slice(0, 1200), { usage })
      const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
      return json({ ...fb, _fallback: 'empty-upstream', _debug: `empty content, usage=${JSON.stringify(usage ?? {}).slice(0,200)}, finish=${(choice as { finish_reason?: string })?.finish_reason ?? 'unknown'}` })
    }
    const parsed = (() => { try { return JSON.parse(text) as Record<string, unknown> } catch { return null } })()
    if (!parsed || typeof parsed.narrative !== 'string' || !Array.isArray(parsed.choices)) {
      console.warn('[world-mud-narrate] bad JSON', text.slice(0, 600))
      const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
      return json({ ...fb, _fallback: 'bad-json', _debug: text.slice(0, 300) })
    }
    return json({
      narrative: (parsed.narrative as string).slice(0, 800),
      choices: (parsed.choices as unknown[]).slice(0, 4).filter((c) => c && typeof (c as { label?: unknown }).label === 'string').map((c) => {
        const cc = c as { label: string; action: string; icon?: string }
        return { label: cc.label.slice(0, 28), action: (cc.action || 'look').slice(0, 32), icon: cc.icon?.slice(0, 4) }
      }),
      broadcast: typeof parsed.broadcast === 'string' ? parsed.broadcast.slice(0, 60) : actionText.slice(0, 40),
      hint: typeof parsed.hint === 'string' ? parsed.hint.slice(0, 80) : undefined,
    })
  } catch (e) {
    console.warn('[world-mud-narrate] error', (e as Error).message, (e as Error).stack?.slice(0, 500))
    const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
    return json({ ...fb, _fallback: 'exception', _debug: (e as Error).message })
  }
})

function reqLang(lang?: string): string {
  if (typeof lang === 'string' && lang) return lang
  return 'zh'
}

function fallback(narrLang: string, actionText: string, locationId?: string, roomName?: string, uiLang?: string): Record<string, unknown> {
  const choicesLang = uiLang ?? narrLang
  const isZhNarr = narrLang.startsWith('zh')
  const loc = roomName ?? locationId ?? (isZhNarr ? '未知之地' : 'unknown')
  let narrative: string
  if (isZhNarr) narrative = `你说道“${actionText.slice(0, 40)}”，${loc}的空气微微颤动，似乎在回应你。前方有新的可能在等待。`
  else if (narrLang === 'ja') narrative = `あなたは「${actionText.slice(0, 40)}」と告げる。${loc}の空気がわずかに揺らぎ、世界が応えているようだ。新たな可能性が目の前に広がる。`
  else if (narrLang === 'ar') narrative = `تقول “${actionText.slice(0, 40)}” — يهتز الهواء في ${loc} كما لو أن العالم ينصت. إمكانيات جديدة بانتظارك.`
  else if (narrLang === 'ko') narrative = `당신은 “${actionText.slice(0, 40)}”라고 말한다. ${loc}의 공기가 미세하게 떨린다. 새로운 가능성이 기다린다.`
  else if (narrLang === 'fr') narrative = `Vous dites « ${actionText.slice(0, 40)} » — l’air à ${loc} frémit, comme si le monde écoutait.`
  else if (narrLang === 'es') narrative = `Dices “${actionText.slice(0, 40)}” — el aire en ${loc} vibra como si el mundo escuchara.`
  else if (narrLang === 'de') narrative = `Du sagst „${actionText.slice(0, 40)}“ — die Luft in ${loc} zittert, als würde die Welt lauschen.`
  else if (narrLang === 'it') narrative = `Dici “${actionText.slice(0, 40)}” — l’aria a ${loc} vibra come se il mondo ascoltasse.`
  else narrative = `You say "${actionText.slice(0, 40)}" — the air at ${loc} shivers faintly, as if the world is listening. New possibilities await.`
  const choicesMap: Record<string, Array<{ label: string; action: string; icon?: string }>> = {
    zh: [{ label: '观察四周', action: 'look', icon: '👁️' }, { label: '与人交谈', action: 'talk', icon: '💬' }, { label: '搜索', action: 'search', icon: '🔍' }],
    'zh-TW': [{ label: '觀察四周', action: 'look', icon: '👁️' }, { label: '與人交談', action: 'talk', icon: '💬' }, { label: '搜索', action: 'search', icon: '🔍' }],
    ja: [{ label: '周りを見る', action: 'look', icon: '👁️' }, { label: '話しかける', action: 'talk', icon: '💬' }, { label: '探索する', action: 'search', icon: '🔍' }],
    fr: [{ label: 'Regarder autour', action: 'look', icon: '👁️' }, { label: 'Parler', action: 'talk', icon: '💬' }, { label: 'Chercher', action: 'search', icon: '🔍' }],
    es: [{ label: 'Mirar alrededor', action: 'look', icon: '👁️' }, { label: 'Hablar', action: 'talk', icon: '💬' }, { label: 'Buscar', action: 'search', icon: '🔍' }],
    de: [{ label: 'Umschauen', action: 'look', icon: '👁️' }, { label: 'Reden', action: 'talk', icon: '💬' }, { label: 'Suchen', action: 'search', icon: '🔍' }],
    ko: [{ label: '주변 둘러보기', action: 'look', icon: '👁️' }, { label: '대화하기', action: 'talk', icon: '💬' }, { label: '수색하기', action: 'search', icon: '🔍' }],
    it: [{ label: 'Guardati intorno', action: 'look', icon: '👁️' }, { label: 'Parla', action: 'talk', icon: '💬' }, { label: 'Cerca', action: 'search', icon: '🔍' }],
    ar: [{ label: 'انظر حولك', action: 'look', icon: '👁️' }, { label: 'تحدث', action: 'talk', icon: '💬' }, { label: 'ابحث', action: 'search', icon: '🔍' }],
    en: [{ label: 'Look around', action: 'look', icon: '👁️' }, { label: 'Talk', action: 'talk', icon: '💬' }, { label: 'Search', action: 'search', icon: '🔍' }],
  }
  const choices = choicesMap[choicesLang] ?? choicesMap[choicesLang.startsWith('zh') ? 'zh' : 'en'] ?? choicesMap.en
  return { narrative, choices, broadcast: actionText.slice(0, 40) }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

async function isAuthenticated(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultKey()
  if (!auth?.startsWith('Bearer ') || !url || !anon) return false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: auth, apikey: anon }, signal: controller.signal })
    clearTimeout(timer)
    return r.ok
  } catch { return false }
}
function defaultKey(): string | undefined { try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined } }
