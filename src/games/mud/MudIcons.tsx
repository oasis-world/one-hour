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

// ── Choice icons — premium action glyphs (same line-art language as DistrictIcon)
function LookIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.6 10c1.7-2.8 4.3-4.9 7.4-4.9s5.7 2.1 7.4 4.9c-1.7 2.8-4.3 4.9-7.4 4.9S4.3 12.8 2.6 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="10" cy="10" r="1.7" fill="currentColor" opacity={0.15} stroke="currentColor" strokeWidth="1.05" />
      <circle cx="10" cy="10" r="0.85" fill="currentColor" />
      <circle cx="8.9" cy="9" r="0.45" fill="white" opacity={0.92} />
      <path d="M10 5.1v1.1M10 13.8v1.1M5.4 7.2l-.7-.7M14.6 7.2l.7-.7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.32} />
    </svg>
  )
}
function TalkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4.2 4.4h7.2c1.15 0 2.1.92 2.1 2.05v3.2c0 1.13-.95 2.05-2.1 2.05H8L4.5 14.6V11.7H4.2c-1.15 0-2.1-.92-2.1-2.05v-3.2C2.1 5.32 3.05 4.4 4.2 4.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4.2 6.1c1 .3 2 .45 3 .45M12.6 14.6v1.1c0 .45-.36.8-.8.8H9.5" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" opacity={0.28} />
      <circle cx="6.25" cy="8.05" r="0.95" fill="currentColor" />
      <circle cx="9.05" cy="8.05" r="0.95" fill="currentColor" />
      <circle cx="11.85" cy="8.05" r="0.95" fill="currentColor" />
    </svg>
  )
}
function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.4" cy="8.4" r="4.85" stroke="currentColor" strokeWidth="1.45" />
      <circle cx="8.4" cy="8.4" r="3.15" stroke="currentColor" strokeWidth="1" opacity={0.18} />
      <circle cx="8.4" cy="8.4" r="1.35" fill="currentColor" opacity={0.14} />
      <path d="M12 12l4.2 4.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <path d="M13.2 13.6l1.4 1.1-.3 1.7-1.1-1.4 1.4-1.1-.3.8-.3-.8z" fill="currentColor" opacity={0.85} style={{ display: 'none' }} />
      <path d="M12.25 11.95l3.55 3.55M12 12l-.95-.95" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity={0.5} />
      <path d="M14.6 2.8l.65 1.35 1.35.65-1.35.65-.65 1.35-.65-1.35-1.35-.65 1.35-.65z" fill="currentColor" opacity={0.92} />
      <path d="M14.6 2.8l.65 1.35 1.35.65-1.35.65-.65 1.35-.65-1.35-1.35-.65 1.35-.65z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
    </svg>
  )
}
function GoIcon({ size = 14, dir = 'north' }: { size?: number; dir?: string }) {
  const rot: Record<string, number> = { north: 0, south: 180, east: 90, west: -90, up: 0, down: 180, left: -90, right: 90 }
  const d = dir.toLowerCase()
  let angle = 0
  for (const k in rot) if (d.includes(k)) { angle = rot[k]; break }
  if (d.includes('北') || d.includes('north')) angle = 0
  else if (d.includes('南') || d.includes('south')) angle = 180
  else if (d.includes('东') || d.includes('east')) angle = 90
  else if (d.includes('西') || d.includes('west')) angle = -90
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden style={{ transform: `rotate(${angle}deg)` }}>
      <circle cx="10" cy="10" r="6.4" stroke="currentColor" strokeWidth="1.3" opacity={0.92} />
      <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="0.9" opacity={0.16} />
      <path d="M10 4.6v1M10 15.4v-1M4.6 10h1M14.4 10h-1" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity={0.32} />
      <path d="M10 13.9V5.8M10 5.8l-2.85 2.85M10 5.8l2.85 2.85" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="0.9" fill="currentColor" />
      <circle cx="10" cy="10" r="0.35" fill="white" opacity={0.75} />
    </svg>
  )
}
function SneakIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M2.7 10c1.6-2.55 4.1-4.55 7.3-4.55S15.7 7.45 17.3 10c-1.6 2.55-4.1 4.55-7.3 4.55S4.3 12.55 2.7 10z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M3.1 3.1l13.8 13.8" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.9" stroke="currentColor" strokeWidth="1.15" opacity={0.7} />
      <path d="M7.6 8.35l1.05 1.05M11.35 11.6l1.05 1.05M12.4 8.35l-1.05 1.05M8.6 11.6l-1.05 1.05" stroke="currentColor" strokeWidth="0.95" strokeLinecap="round" opacity={0.35} />
    </svg>
  )
}
function UseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M7.1 3.6h5.8M7.6 3.6V4.9c0 .62.5 1.12 1.12 1.12h2.56c.62 0 1.12-.5 1.12-1.12V3.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.4 6.5h13.2v8c0 1.1-.9 2-2 2H5.4c-1.1 0-2-.9-2-2v-8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.4 8.8h13.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity={0.85} />
      <path d="M3.4 7.8c.9-.5 2.05-.8 3.2-.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity={0.35} />
      <circle cx="10" cy="12.35" r="1.55" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="12.35" r="0.6" fill="currentColor" />
      <path d="M10 13V14" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity={0.95} />
    </svg>
  )
}
function StrikeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3.6 3.7l6.4 6.4M3.1 5.1l1.45-1.45M5.1 3.1l-1.45 1.45M12.2 13.45l3.15 3.15" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.75 3.6h1.7v1.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <path d="M16.4 3.7l-6.4 6.4M16.9 5.1l-1.45-1.45M14.9 3.1l1.45 1.45M7.8 13.45l-3.15 3.15" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.25 3.6h-1.7v1.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <circle cx="10" cy="10.05" r="1.35" fill="currentColor" opacity={0.14} stroke="currentColor" strokeWidth="1.1" />
      <circle cx="10" cy="10.05" r="0.55" fill="currentColor" />
    </svg>
  )
}
function GenericActionIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.3" opacity={0.9} />
      <circle cx="10" cy="10" r="3.8" stroke="currentColor" strokeWidth="0.85" opacity={0.14} />
      <path d="M10 3.6l1 3.05 3.05 1-3.05 1-1 3.05-1-3.05-3.05-1 3.05-1z" fill="currentColor" opacity={0.92} />
      <path d="M10 3.6l1 3.05 3.05 1-3.05 1-1 3.05-1-3.05-3.05-1 3.05-1z" stroke="currentColor" strokeWidth="0.85" strokeLinejoin="round" />
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
