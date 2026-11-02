export type AiMode = 'cloud' | 'local'

const KEY = 'one-hour-ai-mode'

export function getCachedAiMode(): AiMode | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'cloud' || v === 'local' ? v : null
  } catch {
    return null
  }
}

export function setCachedAiMode(mode: AiMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // ignore
  }
}
