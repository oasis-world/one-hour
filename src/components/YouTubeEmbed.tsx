import { useState } from 'react'

interface Props {
  id: string
  title?: string
}

export default function YouTubeEmbed({ id, title }: Props) {
  const [loaded, setLoaded] = useState(false)
  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`

  return (
    <div className="msg-youtube">
      <div className="msg-youtube-frame">
        {!loaded && <div className="msg-youtube-placeholder" aria-hidden="true" />}
        <iframe
          src={src}
          title={title || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
      <a
        className="msg-youtube-link"
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        YouTube ↗
      </a>
    </div>
  )
}