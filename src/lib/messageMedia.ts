/** Link detection and safe embed URL construction for message media. */
export type MediaKind = 'video' | 'audio'
export type MediaProvider =
  | 'youtube' | 'vimeo' | 'dailymotion' | 'twitch' | 'bilibili'
  | 'tencent-video' | 'youku' | 'iqiyi' | 'mgtv' | 'tiktok' | 'douyin'
  | 'spotify' | 'soundcloud' | 'netease-music' | 'qq-music' | 'direct-audio'

export interface MessageMedia {
  key: string
  provider: MediaProvider
  kind: MediaKind
  label: string
  url: string
  embedUrl: string | null
  /** False means provider has no integrated JS event/control adapter yet. */
  coordinated: boolean
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi
const clean = (value: string) => value.replace(/[.,;:!?)\]}]+$/, '')
const make = (provider: MediaProvider, kind: MediaKind, id: string, label: string, url: string, embedUrl: string | null, coordinated = false): MessageMedia => ({
  key: `${provider}:${id}`,
  provider,
  kind,
  label,
  url,
  embedUrl,
  coordinated,
})

function parse(raw: string): MessageMedia | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const path = url.pathname
  const youtube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com'
  if (youtube) {
    const id = host === 'youtu.be' ? path.split('/')[1] : url.searchParams.get('v') ?? path.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1]
    if (id && /^[\w-]{11}$/.test(id)) return make('youtube', 'video', id, 'YouTube', raw, `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0`, true)
  }
  const vimeo = path.match(/^\/(?:video\/)?(\d+)/)
  if ((host === 'vimeo.com' || host === 'player.vimeo.com') && vimeo) {
    const privacy = url.searchParams.get('h')
    const hash = privacy ? `&h=${encodeURIComponent(privacy)}` : ''
    return make('vimeo', 'video', vimeo[1], 'Vimeo', raw, `https://player.vimeo.com/video/${vimeo[1]}?dnt=1${hash}`, true)
  }
  const dm = host === 'dailymotion.com' ? path.match(/^\/video\/([\w]+)/) : host === 'dai.ly' ? path.match(/^\/([\w]+)/) : null
  if (dm) return make('dailymotion', 'video', dm[1], 'Dailymotion', raw, `https://www.dailymotion.com/embed/video/${dm[1]}`)
  if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
    const clip = host === 'clips.twitch.tv' ? path.slice(1) : path.match(/^\/[^/]+\/clip\/([^/]+)/)?.[1]
    const video = host === 'twitch.tv' ? path.match(/^\/videos\/(\d+)/)?.[1] : null
    const channel = host === 'twitch.tv' ? path.match(/^\/([\w]+)/)?.[1] : null
    if (clip || video || (channel && !['videos', 'directory', ''].includes(channel))) {
      const parent = encodeURIComponent(location.hostname || 'localhost')
      const src = clip
        ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${parent}`
        : video
          ? `https://player.twitch.tv/?video=${encodeURIComponent(video)}&parent=${parent}`
          : `https://player.twitch.tv/?channel=${encodeURIComponent(channel!)}&parent=${parent}`
      return make('twitch', 'video', clip ?? video ?? channel!, 'Twitch', raw, src)
    }
  }
  const bv = host === 'bilibili.com' || host === 'b23.tv' ? path.match(/\/(BV[\w]+)/i)?.[1] : null
  if (bv) return make('bilibili', 'video', bv, '哔哩哔哩', raw, `https://player.bilibili.com/player.html?bvid=${bv}`)
  if (host === 'v.qq.com') {
    const id = url.searchParams.get('vid') ?? path.match(/\/([\w]+)\.html$/)?.[1]
    if (id && id !== 'video') return make('tencent-video', 'video', id, '腾讯视频', raw, `https://v.qq.com/txp/iframe/player.html?vid=${id}`)
  }
  if (host === 'youku.com') {
    const id = url.searchParams.get('id') ?? path.match(/id_([\w=]+)/)?.[1]
    if (id) return make('youku', 'video', id, '优酷', raw, `https://player.youku.com/embed/${id}`)
  }
  if (host === 'iqiyi.com') {
    const id = path.match(/\/(v_[\w-]+)\.html/)?.[1]
    if (id) return make('iqiyi', 'video', id, '爱奇艺', raw, null)
  }
  if (host === 'mgtv.com') {
    const id = path.match(/\/(\d+)\.html/)?.[1]
    if (id) return make('mgtv', 'video', id, '芒果TV', raw, null)
  }
  if (host === 'tiktok.com') {
    const id = path.match(/\/video\/(\d+)/)?.[1]
    if (id) return make('tiktok', 'video', id, 'TikTok', raw, `https://www.tiktok.com/player/v1/${id}`, true)
  }
  if (host === 'douyin.com') {
    const id = path.match(/\/(?:video\/)?(\d{10,})/)?.[1]
    if (id) return make('douyin', 'video', id, '抖音', raw, null)
  }
  if (host === 'open.spotify.com') {
    const m = path.match(/^\/(?:embed\/)?(track|album|playlist|episode|show)\/([\w]+)/)
    if (m) return make('spotify', 'audio', `${m[1]}:${m[2]}`, 'Spotify', raw, `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`, true)
  }
  if (host === 'soundcloud.com' && path.split('/').filter(Boolean).length >= 2) {
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&auto_play=false&visual=true`
    return make('soundcloud', 'audio', path, 'SoundCloud', raw, src, true)
  }
  if (host === 'music.163.com') {
    const hashQuery = new URLSearchParams(url.hash.split('?')[1] ?? '')
    const id = url.searchParams.get('id') ?? hashQuery.get('id') ?? path.match(/song\/(\d+)/)?.[1]
    if (id) return make('netease-music', 'audio', id, '网易云音乐', raw, `https://music.163.com/outchain/player?type=2&id=${id}&auto=0&height=66`)
  }
  if (host === 'y.qq.com' || host === 'i.y.qq.com') {
    const id = url.searchParams.get('songmid') ?? path.match(/songDetail\/(\w+)/)?.[1]
    if (id) return make('qq-music', 'audio', id, 'QQ音乐', raw, `https://i.y.qq.com/v8/playsong.html?songmid=${id}&type=0`)
  }
  if (/\.(mp3|m4a|ogg|oga|opus|wav|aac)(?:$|\?)/i.test(url.pathname + url.search)) return make('direct-audio', 'audio', raw, 'Audio', raw, raw, true)
  return null
}

export function findMessageMedia(text: string): MessageMedia[] {
  const found: MessageMedia[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(URL_RE)) {
    const original = clean(match[0])
    const media = parse(original)
    if (!media || seen.has(media.key)) continue
    seen.add(media.key)
    found.push(media)
  }
  return found
}

/** Hide source links and copied iframe code when an inline video/music player is rendered. */
export function stripRenderedMediaMarkup(text: string): string {
  const isRenderedMedia = (source: string) => {
    const media = parse(source)
    return media?.kind === 'video' || media?.provider === 'spotify'
  }
  return text
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/\s*>/gi, '')
    .replace(URL_RE, (url) => isRenderedMedia(clean(url)) ? '' : url)
    .trim()
}
