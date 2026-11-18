import type { CompanionNewsCardData } from '../lib/newsCard'
import type { Lang } from '../lib/i18n'
import './NewsCard.css'

const labels: Record<Lang, { latest: string; open: string }> = {
  zh: { latest: '实时新闻', open: '阅读原文' },
  'zh-TW': { latest: '即時新聞', open: '閱讀原文' },
  en: { latest: 'LIVE NEWS', open: 'Read original' },
  ja: { latest: '最新ニュース', open: '記事を読む' },
  fr: { latest: 'ACTUALITÉS', open: 'Lire l’article' },
  es: { latest: 'NOTICIAS', open: 'Leer noticia' },
  de: { latest: 'EILMELDUNG', open: 'Original öffnen' },
  ko: { latest: '실시간 뉴스', open: '원문 보기' },
  it: { latest: 'ULTIME NOTIZIE', open: 'Leggi originale' },
  ar: { latest: 'أخبار عاجلة', open: 'اقرأ المصدر' },
}

export default function NewsCard({ news }: { news: CompanionNewsCardData }) {
  const text = labels[news.lang]
  const time = new Date(news.publishedAt)
  const timeLabel = Number.isNaN(time.getTime())
    ? ''
    : new Intl.DateTimeFormat(news.lang, { hour: '2-digit', minute: '2-digit' }).format(time)

  return (
    <a className="companion-news-card" href={news.url} target="_blank" rel="noopener noreferrer">
      <span className="companion-news-meta">
        <span className="companion-news-live"><i />{text.latest}</span>
        <span>{news.source}{timeLabel ? ` · ${timeLabel}` : ''}</span>
      </span>
      <strong>{news.title}</strong>
      <span className="companion-news-summary">{news.summary}</span>
      <span className="companion-news-link">{text.open} <span aria-hidden="true">↗</span></span>
    </a>
  )
}
