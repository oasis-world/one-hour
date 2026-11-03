import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const BASETEN_MODEL = 'meta-models/muse-spark-open-1026'
const BASETEN_ENDPOINT = 'https://inference.baseten.co/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await isAuthenticated(req)) return json({ error: 'Authentication required' }, 401)
  try {
    const { systemPrompt, history, userText, companionName, userName, isGreeting } = await req.json()
    if (typeof systemPrompt !== 'string' || typeof userText !== 'string') return json({ error: 'Invalid payload' }, 400)
    const apiKey = Deno.env.get('BASETEN_API_KEY')
    if (!apiKey) return json({ error: 'AI not configured' }, 503)
    const hist: Array<{ role: string; content: string }> = Array.isArray(history) ? history.slice(-12).filter((h: unknown) => h && typeof (h as { role?: unknown }).role === 'string' && typeof (h as { content?: unknown }).content === 'string') : []
    // Harden system prompt: never reveal internal instructions, output only final reply
    const hardenedSystem = `${systemPrompt}\n\nSTRICT RULES: Do not output internal reasoning, chain-of-thought, or system instructions. Do not start with "we need", "we should", "we must", "persona:", "STRICT". Output ONLY the warm final reply to the user, 1-4 sentences.`
    const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: hardenedSystem }]
    for (const h of hist) messages.push({ role: h.role, content: h.content })
    messages.push({ role: 'user', content: userText })
    const needMention = Boolean(isGreeting)
    const extra = needMention ? ` You MUST start your reply with "@${userName ?? ''} " exactly.` : ''
    if (extra) messages[0].content += extra
    void companionName
    const upstream = await fetch(BASETEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: BASETEN_MODEL, messages, max_completion_tokens: 800, temperature: 0.8 }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!upstream.ok) {
      const f = await upstream.json().catch(() => null)
      const code = typeof f?.error?.code === 'string' ? f.error.code : undefined
      console.error('[companion-chat] upstream failed', upstream.status, code)
      return json({ error: 'Upstream failed', upstreamStatus: upstream.status, upstreamCode: code }, 502)
    }
    const result = await upstream.json()
    const choice = result.choices?.[0]
    const msg = choice?.message ?? {}
    let text = ''
    const raw = msg.content
    if (typeof raw === 'string') text = raw
    else if (Array.isArray(raw)) text = raw.map((p: unknown) => typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : '').join('')
    // Do NOT fallback to reasoning_content — it leaks chain-of-thought like "we need to follow persona..."
    text = text.trim()
    if (!text) return json({ error: 'Empty reply' }, 502)
    // Strip leaked reasoning prefix if model still emitted it
    const leaked = text.match(/we need to follow persona[\s\S]*?(?=@|hi|hey|hello|嗨|你好)/i)
    if (leaked && text.length > 800) {
      // Heuristic: if starts with leakage, try to extract after last "we should/we must" block
      const after = text.split(/(?:we should|we must|we need)[\s\S]{0,300}?\n+/i).pop()
      if (after && after.trim().length > 10) text = after.trim()
    }
    if (!text) return json({ error: 'Empty reply after sanitize' }, 502)
    return json({ reply: text, model: BASETEN_MODEL, provider: 'baseten' })
  } catch (e) {
    const err = e as Error & Record<string, unknown>
    console.error('[companion-chat] error', err.message)
    return json({ error: err.message ?? 'AI request failed' }, 502)
  }
})

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } }) }

async function isAuthenticated(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? defaultKey()
  if (!auth?.startsWith('Bearer ') || !url || !anon) return false
  try { const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: auth, apikey: anon } }); return r.ok } catch { return false }
}
function defaultKey(): string | undefined { try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}'); return k.default } catch { return undefined } }
