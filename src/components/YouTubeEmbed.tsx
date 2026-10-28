import { useState } from 'react'
import { useYouTubePlayer } from './useYouTubePlayer'
import MediaSkeleton from './MediaSkeleton'

interface Props {
  id: string
  title?: string
  storageKey?: string
}

export default function YouTubeEmbed({ id, title, storageKey }: Props) {
  const [ready, setReady] = useState(false)
  const iframeRef = useYouTubePlayer(id, storageKey)
  return (
    <div className="msg-youtube">
      <div className="msg-youtube-frame">
        {!ready && <MediaSkeleton />}
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1`}
          title={title || 'YouTube video'}
          loading="lazy"
          onLoad={() => setReady(true)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  )
}
