import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const OPENCODE_MODEL = 'muse-spark-1.3-contributor'
const OPENCODE_ENDPOINT = 'https://opencode.ai/inference/go/openai/v1/responses'

function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v && typeof v === 'object' && !Array.isArray(v)) }
function parseJsonObject(text: string): Record<string, unknown> | null {
  try { const p: unknown = JSON.parse(text); return isRecord(p) ? p : null } catch { /* fallback below */ }
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s < 0 || e <= s) return null
  try { const p: unknown = JSON.parse(text.slice(s, e + 1)); return isRecord(p) ? p : null } catch { return null }
}
function extractOpenCodeText(result: Record<string, unknown>): string {
  const output = result.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined
  if (!Array.isArray(output)) return ''
  return output
    .flatMap((it) => it.content ?? [])
    .filter((it) => it.type === 'output_text')
    .map((it) => it.text ?? '')
    .join('')
}
async function stableSessionId(seed: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))
  return `ses_${Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`
}

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

  const apiKey = Deno.env.get('OPENCODE_API_KEY')
  if (!apiKey) {
    console.warn('[world-mud-narrate] missing OPENCODE_API_KEY — returning fallback (check Supabase Edge Secrets)')
    const fb = fallback(reqLang(narrativeLang ?? lang), actionText, locationId, roomName, reqLang(lang))
    return json({ ...fb, _fallback: 'missing-opencode-key', _debug: 'OPENCODE_API_KEY not set in Edge Secrets' })
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
  const baseLangRule = uiLang === narrLang
    ? (uiLang.startsWith('en')
      ? 'CRITICAL LANGUAGE RULE: Respond ONLY in English. All narrative/choices/broadcast must be 100% English.'
      : `CRITICAL LANGUAGE RULE: Respond ONLY in ${uiLangName}. All narrative/choices/broadcast must be 100% that language.`)
    : `CRITICAL LANGUAGE RULE: NARRATIVE must be ONLY in ${narrLangName} (code ${narrLang}). CHOICES+hint must be ONLY in ${uiLangName} (code ${uiLang}). Broadcast may be in ${narrLangName}. Never mix.`
  // Length rule must ALWAYS apply — previous version only added it in the mismatch branch, so ja with uiLang===narrLang lost it
  const lengthRule = `CRITICAL LENGTH RULE (applies to ALL languages equally): Narrative MUST be 2-3 sentences, 50-90 words (100-180 characters for CJK like ja/zh/ko). Never 1 short sentence or a single line. Must have rich sensory detail (sight/sound/smell), be specific to room/action, hint at consequences. For CJK (zh/ja/ko), count characters not words — must be visibly 2-3 full sentences. For Japanese (ja), MUST be natural vivid Japanese (not transliteration), 120-180 characters, 2-3 sentences with atmosphere, e.g. "あなたは…と告げた。冷たい空気が微かに震え、石壁から埃の匂いと吐息が漂い、遠くで足音が響く。砂時計の光が次の道を仄かに照らし、新たな扉が軋む。" Never just "了解" or a few words. All languages must be equally long — Japanese must NOT be shorter than English.`
  const sysPrompt = `You are the living narrator of a persistent shared MUD world "The Eternal Hourglass".
World: one eternal city where every soul lives 1 hour. Districts: plaza/ruin/lab/forest/ocean/city/tavern/academy. No fixed plot — AI + players co-evolve it.
Player: ${playerDesc}, at ${roomName ?? locationId} in district ${districtId ?? 'plaza'}.
Recent world log:
${logSnippet || '(world just awoke)'}
${globalEvent ? `Global event: ${globalEvent}` : ''}
Narrative language: ${narrLangName} (code ${narrLang}) — narrative MUST be this language.
Choices language: ${uiLangName} (code ${uiLang}) — choices MUST be this language (buttons stay in page language).
${baseLangRule}
${lengthRule}
Rules:
- Narrative: ${lengthRule}
- Choices: 3-4 short action labels (4-10 chars each) reflecting what to do next. Labels must be in choices language (${uiLangName}).
- Broadcast: very short 3-8 word summary in narrative language.
Output ONLY valid JSON: {"narrative": string, "choices": [{"label": string, "action": string, "icon": string?}], "broadcast": string, "hint": string?}
action is snake_case command the client sends back (e.g. "go_north", "talk", "search", "look").
No fixed NPC dialogue — improvise NPCs as needed.
Never break JSON.`

  try {
    const sessionId = await stableSessionId(JSON.stringify([locationId ?? '', districtId ?? '', playerDesc])).catch(() => 'world-mud-narrate')
    const upstream = await fetch(OPENCODE_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'x-opencode-session': sessionId },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        instructions: sysPrompt,
        input: JSON.stringify({ actionText, locationId, districtId, roomName, player, lang, narrativeLang, recentLog: logSnippet, globalEvent }),
        max_output_tokens: 4096,
        reasoning: { effort: 'minimal' },
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
    if (result.status && result.status !== 'completed') {
      const reason = (result.incomplete_details as Record<string, unknown> | undefined)?.reason ?? result.status
      console.warn('[world-mud-narrate] OpenCode incomplete', reason, JSON.stringify(result).slice(0, 800))
      const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
      return json({ ...fb, _fallback: 'incomplete-upstream', _debug: String(reason) })
    }
    console.log('[world-mud-narrate] upstream ok', { model: OPENCODE_MODEL, usage })
    const text = extractOpenCodeText(result).trim()
    if (!text) {
      const full = JSON.stringify(result)
      console.warn('[world-mud-narrate] empty upstream content', full.slice(0, 1200), { usage })
      const fb = fallback(reqLang(narrLang), actionText, locationId, roomName, uiLang)
      return json({ ...fb, _fallback: 'empty-upstream', _debug: `empty content, usage=${JSON.stringify(usage ?? {}).slice(0, 200)}` })
    }
    const parsed = parseJsonObject(text)
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
  if (isZhNarr) narrative = `你说道“${actionText.slice(0, 40)}”，${loc}的空气微微颤动，墙面渗出细密水珠，远处传来低沉回响。前方有新的可能在等待，沙漏的光轻轻指引着下一步。`
  else if (narrLang === 'ja') narrative = `あなたは「${actionText.slice(0, 40)}」と告げた。${loc}の冷たい空気が微かに震え、石壁から埃の匂いと吐息が漂い遠くで足音が響く。砂時計の光が次の道を仄かに照らし、新たな扉が軋む。`
  else if (narrLang === 'ar') narrative = `تقول “${actionText.slice(0, 40)}” — يهتز الهواء في ${loc}، وتفوح رائحة الغبار والحجر، وهمس بعيد يتردد. إمكانيات جديدة بانتظارك، وضوء الساعة يرشدك إلى الأمام.`
  else if (narrLang === 'ko') narrative = `당신은 “${actionText.slice(0, 40)}”라고 말했다. ${loc}의 차가운 공기가 미세하게 떨리고, 벽에서는 먼지 냄새와 낮은 울림이 퍼진다. 새로운 가능성이 눈앞에 펼쳐지고, 모래시계 빛이 다음 길을 비춘다.`
  else if (narrLang === 'fr') narrative = `Vous dites « ${actionText.slice(0, 40)} » — l’air à ${loc} frémit, une odeur de pierre humide flotte, un murmure lointain répond. De nouvelles possibilités s’ouvrent, la lueur du sablier montre la suite.`
  else if (narrLang === 'es') narrative = `Dices “${actionText.slice(0, 40)}” — el aire en ${loc} vibra, huele a piedra húmeda y un murmullo lejano responde. Nuevas posibilidades se abren, la luz del reloj guía tu próximo paso.`
  else if (narrLang === 'de') narrative = `Du sagst „${actionText.slice(0, 40)}“ — die Luft in ${loc} zittert, feuchter Stein riecht, ein fernes Murmeln antwortet. Neue Möglichkeiten öffnen sich, das Sanduhrlicht weist den nächsten Schritt.`
  else if (narrLang === 'it') narrative = `Dici “${actionText.slice(0, 40)}” — l’aria a ${loc} vibra, odore di pietra umida, un mormorio lontano risponde. Nuove possibilità si aprono, la luce della clessidra indica il prossimo passo.`
  else narrative = `You say "${actionText.slice(0, 40)}" — the air at ${loc} shivers, damp stone scent hangs, a distant murmur answers. New possibilities await ahead, the hourglass light guiding your next step.`
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
