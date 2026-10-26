import type { ReactElement } from 'react'
import type { Lang } from '../lib/i18n'
import UsFlag from './flags/UsFlag'
import { starPoints } from './flags/star'

/**
 * Language flags, all hand-drawn in SVG (no bitmaps, no CSS gradients):
 * every flag keeps its real proportions (3:2, the US 19:10) so the
 * shapes stay recognisable, even at the 21×14 badge used in the
 * language picker.
 */

const FRAME = {
  width: '100%',
  height: '100%',
  display: 'block',
} as const

/** China: red field, one large star and four small ones aimed at it. */
function ChinaFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#de2910" />
      <polygon points={starPoints(5, 5, 3)} fill="#ffde00" />
      <polygon points={starPoints(10, 2, 1, 149)} fill="#ffde00" />
      <polygon points={starPoints(12, 4, 1, 172)} fill="#ffde00" />
      <polygon points={starPoints(12, 7, 1, 196)} fill="#ffde00" />
      <polygon points={starPoints(10, 9, 1, 219)} fill="#ffde00" />
    </svg>
  )
}

/** Japan: white field, the crimson disc exactly centered. */
function JapanFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </svg>
  )
}

/** France: blue / white / red vertical thirds. */
function FranceFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      <rect width="10" height="20" fill="#0055a4" />
      <rect x="20" width="10" height="20" fill="#ef4135" />
    </svg>
  )
}

/** Spain: red / yellow / red bands, the yellow one twice as tall. */
function SpainFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#f1bf00" />
      <rect width="30" height="5" fill="#aa151b" />
      <rect y="15" width="30" height="5" fill="#aa151b" />
    </svg>
  )
}

/** Germany: black / red / gold horizontal thirds. */
function GermanyFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#ffce00" />
      <rect width="30" height="6.667" fill="#000000" />
      <rect y="6.667" width="30" height="6.667" fill="#dd0000" />
    </svg>
  )
}

/** Italy: green / white / red vertical thirds. */
function ItalyFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      <rect width="10" height="20" fill="#009246" />
      <rect x="20" width="10" height="20" fill="#ce2b37" />
    </svg>
  )
}

/**
 * South Korea: white field, the taegeuk tilted along the flag diagonal
 * and the four trigrams (☰ ☲ ☵ ☷) on the corners, drawn from the
 * official geometry (144×96 construction).
 */
function KoreaFlag() {
  return (
    <svg viewBox="-72 -48 144 96" style={FRAME} aria-hidden="true">
      <rect x="-72" y="-48" width="144" height="96" fill="#ffffff" />
      <g stroke="#000000" strokeWidth="4">
        <path
          transform="rotate(33.69006752598)"
          d="M-50-12v24m6 0v-24m6 0v24m76 0V11m0-2v-11m6 0v11m0 2v11m6 0V11m0-2v-11"
        />
        <path
          transform="rotate(-33.69006752598)"
          d="M-50-12v24m6 0V1m0-2v-11m6 0v24m76 0V1m0-2v-11m6 0v24m6 0V1m0-2v-11"
        />
      </g>
      <g transform="rotate(33.69006752598)">
        <path fill="#cd2e3a" d="M12 0a18 18 0 11-36 0 24 24 0 1148 0" />
        <path fill="#0047a0" d="M-24 0a24 24 0 1048 0A12 12 0 100 0a12 12 0 11-24 0" />
      </g>
    </svg>
  )
}

/** Arabic: the Saudi green field with the white shahada and sword. */
function ArabicFlag() {
  return (
    <svg viewBox="0 0 30 20" style={FRAME} aria-hidden="true">
      <rect width="30" height="20" fill="#006c35" />
      <text
        x="15"
        y="9.6"
        textAnchor="middle"
        fontSize="3.2"
        fill="#ffffff"
        fontFamily="serif"
      >
        لا إله إلا الله محمد رسول الله
      </text>
      <path
        d="M5.2 14.2h16.4l1.5 0.9-1.5 0.9H5.2l1.3-0.9z"
        fill="#ffffff"
      />
      <rect x="21.9" y="13.2" width="1.1" height="3.8" rx="0.4" fill="#ffffff" />
      <rect x="23" y="14.4" width="3.1" height="1.4" rx="0.6" fill="#ffffff" />
    </svg>
  )
}

const FLAGS: Record<Lang, () => ReactElement> = {
  zh: ChinaFlag,
  'zh-TW': ChinaFlag,
  en: UsFlag,
  ja: JapanFlag,
  fr: FranceFlag,
  es: SpainFlag,
  de: GermanyFlag,
  ko: KoreaFlag,
  it: ItalyFlag,
  ar: ArabicFlag,
}

/** One flag badge — the row label next to it carries the language name. */
export default function LangFlag({ code }: { code: Lang }) {
  const Flag = FLAGS[code]
  return (
    <span className="lang-flag">
      <Flag />
    </span>
  )
}
