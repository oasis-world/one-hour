import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MessageMedia } from '../lib/messageMedia'
import YouTubeEmbed from './YouTubeEmbed'
import DirectAudioEmbed from './DirectAudioEmbed'
import TikTokEmbed from './TikTokEmbed'
import SoundCloudEmbed from './SoundCloudEmbed'
import VimeoEmbed from './VimeoEmbed'
import SpotifyEmbed from './SpotifyEmbed'
import MediaSkeleton from './MediaSkeleton'

function InViewMedia({ children, kind }: { children: ReactNode; kind: 'video' | 'spotify' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hasEnteredView, setHasEnteredView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setHasEnteredView(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.01) {
        setHasEnteredView(true)
        observer.disconnect()
      }
    }, { root: element.closest('.chat-log'), threshold: [0, 0.01] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`msg-media-inview msg-media-inview-${kind}`}>
      {hasEnteredView ? children : null}
    </div>
  )
}

function PassiveIframe({ src, title }: { src: string; title: string }) {
  const [ready, setReady] = useState(false)

  return (
    <div className="msg-youtube-frame">
      {!ready && <MediaSkeleton />}
      <iframe src={src} title={title} loading="lazy" onLoad={() => setReady(true)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

interface Props {
  media: MessageMedia
  storageKey: string
}

export default function MessageMediaEmbed({ media, storageKey }: Props) {
  if (media.provider === 'youtube') {
    const id = media.key.slice('youtube:'.length)
    return <InViewMedia kind="video"><YouTubeEmbed id={id} title="YouTube video" storageKey={storageKey} /></InViewMedia>
  }
  if (media.provider === 'direct-audio') {
    return <DirectAudioEmbed src={media.url} title={media.label} storageKey={storageKey} />
  }
  if (media.provider === 'tiktok') {
    return <InViewMedia kind="video"><TikTokEmbed id={media.key.slice('tiktok:'.length)} storageKey={storageKey} /></InViewMedia>
  }
  if (media.provider === 'soundcloud' && media.embedUrl) {
    return <SoundCloudEmbed src={media.embedUrl} storageKey={storageKey} />
  }
  if (media.provider === 'vimeo') {
    return <InViewMedia kind="video"><VimeoEmbed id={media.key.slice('vimeo:'.length)} storageKey={storageKey} /></InViewMedia>
  }
  if (media.provider === 'spotify') {
    // Spotify's iFrame API expects the complete spotify:<type>:<id> URI.
    return <InViewMedia kind="spotify"><SpotifyEmbed uri={media.key} storageKey={storageKey} /></InViewMedia>
  }

  return (
    <div className={`msg-youtube msg-media-${media.kind}`}>
      {media.embedUrl ? (
        media.kind === 'video'
          ? <InViewMedia kind="video"><PassiveIframe src={media.embedUrl} title={`${media.label} video`} /></InViewMedia>
          : <PassiveIframe src={media.embedUrl} title={`${media.label} player`} />
      ) : (
        <a className="msg-youtube-link" href={media.url} target="_blank" rel="noopener noreferrer">
          {media.label} ↗
        </a>
      )}
    </div>
  )
}
