export type AiSource = 'cloud' | 'local'

export default function AiSourceIcon({ source }: { source: AiSource }) {
  const isCloud = source === 'cloud'
  return (
    <span
      role="img"
      aria-label={isCloud ? '云端模型 / Cloud model' : '本地 AI / Local AI'}
      title={isCloud ? '云端模型 / Cloud model' : '本地 AI / Local AI'}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', marginLeft: 5, color: isCloud ? '#60a5fa' : '#a8a29e', filter: isCloud ? 'drop-shadow(0 0 3px #60a5fa66)' : 'drop-shadow(0 0 2px #a8a29e44)' }}
    >
      {isCloud ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 16.2A4.5 4.5 0 0 0 18 7.5a6 6 0 0 0-11.6 1.8A3.8 3.8 0 0 0 7 17h12" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 9h6v6H9zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4" />
        </svg>
      )}
    </span>
  )
}
