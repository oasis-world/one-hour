import type { DistrictId } from './worldTypes'

// ── World hourglass (header) — sand + frame + glow
export function WorldHourglassIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 2.5h10M5 17.5h10" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity={0.95} />
      <path d="M6.2 2.5l2.6 6.2a1.2 1.2 0 010 .6L6.2 15.5M13.8 2.5l-2.6 6.2a1.2 1.2 0 000 .6l2.6 6.2" stroke="white" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.1 6.2h5.8M8 13.8h4" stroke="white" strokeWidth="1.15" strokeLinecap="round" opacity={0.85} />
      {/* sand */}
      <path d="M8.4 7.2l1.6 3 1.6-3H8.4z" fill="white" opacity={0.92} />
      <path d="M7 15.5h6l-1.2-1.6a2.2 2.2 0 00-3.6 0L7 15.5z" fill="white" opacity={0.92} />
      {/* glow */}
      <circle cx="10" cy="10" r="8.5" stroke="white" strokeWidth="0.7" opacity={0.18} />
    </svg>
  )
}

// ── District icons — premium line art, colored via currentColor
function PlazaIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 3.2l6 3.6v6.4l-6 3.6-6-3.6V6.8z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M10 3.2v13.6M4 6.8l6 3.6 6-3.6" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" opacity={0.9} />
      <circle cx="10" cy="10.4" r="1.9" fill="currentColor" opacity={0.18} stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10" cy="10.4" r="0.7" fill="currentColor" />
    </svg>
  )
}
function RuinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6.5 3.5h7M6 5.2h8M7 5.2v9.6M13 5.2v9.6" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M5.5 16.2h9M7.5 8.5l1.3 1M10.5 10.2l1.5 1.2M7.2 12.1l1.2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.85} />
      <path d="M4.2 3.5l1.3-1.2M14.5 3.5l1.3-1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity={0.6} />
    </svg>
  )
}
function LabIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.8v4.2L5.2 14.2c-.4.7.1 1.6 1 1.6h7.6c.9 0 1.4-.9 1-1.6L10 7V2.8z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M8.2 6.5h3.6M7 15.8h6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity={0.7} />
      <circle cx="8.5" cy="12.2" r="0.9" fill="currentColor" opacity={0.9} />
      <circle cx="11.5" cy="13.5" r="0.65" fill="currentColor" opacity={0.7} />
      <circle cx="10.2" cy="10.4" r="0.5" fill="currentColor" opacity={0.6} />
    </svg>
  )
}
function ForestIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7.5 5.2l3-3.2 3 3.2-2 2.1 2.2 2.3-3.2 3.4-3.2-3.4 2.2-2.3z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M10.5 13v3.5M3.5 14.5c1-.6 2-.9 3-1M13.5 13.5c1 .6 2 1.1 3 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.65} />
      <path d="M4.5 9.2h2M13.5 8.8h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.4} />
    </svg>
  )
}
function OceanIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.8 10.2c1 .9 2.2 1.4 3.5 1.4 1.4 0 2.6-.5 3.7-1.4 1.1.9 2.3 1.4 3.7 1.4 1.3 0 2.5-.5 3.5-1.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.8 13.2c1 .9 2.2 1.4 3.5 1.4 1.4 0 2.6-.5 3.7-1.4 1.1.9 2.3 1.4 3.7 1.4 1.3 0 2.5-.5 3.5-1.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity={0.7} />
      <path d="M10 3.5l1.1 2.2h2.4l-1.9 1.5 0.7 2.3-2.3-1.6-2.3 1.6 0.7-2.3-1.9-1.5h2.4z" fill="currentColor" opacity={0.9} />
    </svg>
  )
}
function CityIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 16.5V7.2h3.2v9.3M6.2 5.5h3.2v11M9.4 8.2h3.2v8.3M12.6 6.2h3.2v10.3" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M4.2 9.5h0.9M4.2 12h0.9M7.4 7.8h0.9M7.4 10.2h0.9M10.6 10.5h0.8M13.8 8.5h0.8M13.8 11h0.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity={0.85} />
      <path d="M2.5 16.5h15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function TavernIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5.5 6.2h7.2v5.2c0 2-1.6 3.6-3.6 3.6s-3.6-1.6-3.6-3.6z" stroke="currentColor" strokeWidth="1.45" strokeLinejoin="round" />
      <path d="M12.7 7.2h1.6c.8 0 1.5.7 1.5 1.5v1.2c0 .8-.7 1.5-1.5 1.5h-1.6" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M5.5 7.5c1 0 2 .4 3 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity={0.6} />
      <path d="M8.2 4.2c.3-.8 1-1.4 1.8-1.4M10 3.2c.4-.7 1.1-1.1 1.8-1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.9} />
    </svg>
  )
}
function AcademyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3.5 14.8l6.5 2 6.5-2v-8l-6.5-2.4-6.5 2.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 4.4v12.4M3.5 6.8l6.5 2.4 6.5-2.4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity={0.85} />
      <circle cx="10" cy="10.2" r="1.4" fill="currentColor" opacity={0.15} stroke="currentColor" strokeWidth="1.1" />
      <path d="M10 7.8v.8M10 12.8v.8M8.2 10.2h.8M11 10.2h.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.7} />
    </svg>
  )
}

export function DistrictIcon({ id, size = 14 }: { id: DistrictId; size?: number }) {
  const map: Record<DistrictId, React.ReactNode> = {
    plaza: <PlazaIcon size={size} />, ruin: <RuinIcon size={size} />, lab: <LabIcon size={size} />,
    forest: <ForestIcon size={size} />, ocean: <OceanIcon size={size} />, city: <CityIcon size={size} />,
    tavern: <TavernIcon size={size} />, academy: <AcademyIcon size={size} />,
  }
  return <span style={{ display: 'inline-flex', color: 'currentColor' }}>{map[id] ?? <PlazaIcon size={size} />}</span>
}

// ── Choice icons — premium action glyphs
function LookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.5 10s3-5.2 7.5-5.2S17.5 10 17.5 10s-3 5.2-7.5 5.2S2.5 10 2.5 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <path d="M10 4.8V3.2M10 16.8v-1.6M4.2 10H2.5M17.5 10h-1.7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.45} />
    </svg>
  )
}
function TalkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3.2 5.2c0-1 .8-1.8 1.8-1.8h6.8c1 0 1.8.8 1.8 1.8v4.2c0 1-.8 1.8-1.8 1.8H7.1L4.2 13.8V11H5c-1 0-1.8-.8-1.8-1.8V5.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7" cy="7.6" r="0.9" fill="currentColor" />
      <circle cx="10" cy="7.6" r="0.9" fill="currentColor" />
      <circle cx="13" cy="7.6" r="0.9" fill="currentColor" />
    </svg>
  )
}
function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.8" cy="8.8" r="4.6" stroke="currentColor" strokeWidth="1.45" />
      <path d="M12.2 12.2l3.6 3.6M14.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.8" cy="8.8" r="1.6" fill="currentColor" opacity={0.14} />
    </svg>
  )
}
function GoIcon({ size = 14, dir = 'north' }: { size?: number; dir?: string }) {
  const rot: Record<string, number> = { north: 0, south: 180, east: 90, west: -90, up: 0, down: 180, left: -90, right: 90 }
  const d = dir.toLowerCase()
  let angle = 0
  for (const k in rot) if (d.includes(k)) { angle = rot[k]; break }
  // also zh
  if (d.includes('北') || d.includes('north')) angle = 0
  else if (d.includes('南') || d.includes('south')) angle = 180
  else if (d.includes('东') || d.includes('east')) angle = 90
  else if (d.includes('西') || d.includes('west')) angle = -90
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden style={{ transform: `rotate(${angle}deg)` }}>
      <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.25" opacity={0.9} />
      <path d="M10 13.8V6.2M10 6.2l-3 3M10 6.2l3 3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="0.7" fill="currentColor" opacity={0.25} />
    </svg>
  )
}
function SneakIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.5 10s3-4.8 7.5-4.8S17.5 10 17.5 10s-3 4.8-7.5 4.8S2.5 10 2.5 10z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M3.2 3.2l13.6 13.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.8 8.2l4.4 4.4M12.2 8.2l-4.4 4.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.5} />
    </svg>
  )
}
function UseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M6.2 3.8h7.6M7 3.8V5c0 .7.6 1.2 1.2 1.2h3.6c.7 0 1.2-.5 1.2-1.2V3.8M3.8 6.2h12.4v8.6c0 1-.8 1.8-1.8 1.8H5.6c-1 0-1.8-.8-1.8-1.8V6.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.5 9.5h5M7.5 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity={0.7} />
    </svg>
  )
}
function StrikeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3.5 3.5l5 5M5 3.5l-1.5 1.5M3.5 5l1.5-1.5M14.5 14.5l2 2M12.2 12.2l3.3 3.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 3.5l-5 5M15 3.5l1.5 1.5M16.5 5l-1.5-1.5M5.5 14.5l-2 2M7.8 12.2l-3.3 3.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="1" fill="currentColor" opacity={0.9} />
    </svg>
  )
}
function GenericActionIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="5.8" stroke="currentColor" strokeWidth="1.35" opacity={0.9} />
      <path d="M10 7.2l1.6 2.8h-3.2zM10 12.8l-1.6-2.8h3.2z" fill="currentColor" opacity={0.95} />
    </svg>
  )
}

export function ChoiceIcon({ action, iconEmoji, size = 14 }: { action: string; iconEmoji?: string; size?: number }) {
  const a = `${action} ${iconEmoji ?? ''}`.toLowerCase()
  if (/^go\s|^前往|往.*走|north|south|east|west|北|南|东|西/.test(a)) {
    // extract dir token
    let dir = 'north'
    if (/south|南/.test(a)) dir = 'south'
    else if (/east|东/.test(a)) dir = 'east'
    else if (/west|西/.test(a)) dir = 'west'
    else if (/north|北/.test(a)) dir = 'north'
    return <GoIcon size={size} dir={dir} />
  }
  if (/look|观察|看看|observe|周/.test(a)) return <LookIcon size={size} />
  if (/talk|chat|对话|交谈|speak|说/.test(a)) return <TalkIcon size={size} />
  if (/search|investigat|搜|探|find/.test(a)) return <SearchIcon size={size} />
  if (/sneak|潜行|hide|stealth/.test(a)) return <SneakIcon size={size} />
  if (/use|item|道具|inventory|背包/.test(a)) return <UseIcon size={size} />
  if (/strike|attack|fight|战|击/.test(a)) return <StrikeIcon size={size} />
  return <GenericActionIcon size={size} />
}
