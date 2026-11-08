// Hook: async upgrade of a set of strings to the UI language.
// Renders original immediately, swaps in Edge translation when ready.
import { useEffect, useMemo, useState } from 'react'
import type { Lang } from '../../lib/i18n'
import { requestTranslateBatch, type TranslateItem } from './translateClient'

export function useTranslatedTexts(entries: TranslateItem[], targetLang: Lang): Record<string, string> {
  const key = useMemo(
    () => entries.map((e) => `${e.id}:${e.text.slice(0, 40)}:${e.text.length}`).join('|') + `::${targetLang}`,
    [entries, targetLang],
  )
  const [translated, setTranslated] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const items: TranslateItem[] = entries.filter((e) => e.text.trim())
    if (items.length === 0) return
    void requestTranslateBatch(items, targetLang).then((m) => {
      if (!cancelled) setTranslated((prev) => ({ ...prev, ...m }))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of entries) m[e.id] = translated[e.id] ?? e.text
    return m
  }, [entries, translated])
}
