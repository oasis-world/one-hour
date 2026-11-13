import { useCallback, useEffect, useState } from 'react'
import type { GameComponentProps } from '../types'
import { useLang } from '../../lib/i18n'
import { recordGamePlayed } from '../../lib/lifetimeStats'
import type { TileDef } from './tiles'
import {
  TILE_TYPES, randomBoard, trySwap, findMatches, collapseBoard, removeMatches,
  hasAnyMove, adjacent,
} from './model'
import { matchText as m } from './matchText'
import {
  DifficultyPicker, Match3ControlRow, Match3StatsRow,
  type BoardSize, type Match3Mode,
} from './Match3Controls'
import Match3Header from './Match3Header'
import Match3Board from './Match3Board'
import Match3HelpDialog from './Match3HelpDialog'
import { useImageDisplayMode } from './useImageDisplayMode'
import { useMatch3Sound } from './useMatch3Sound'
import { bestScoreKey, makeTileSet } from './match3Setup'
import { delay } from './match3Delay'
import {
  playCascadeSound, playClearSound, playInvalidSound, playSelectSound, playSwapSound,
} from './match3Sound'
import './Match3Game.css'

export default function Match3Game({ instanceId }: GameComponentProps) {
  const lang = useLang()
  const [mode, setMode] = useState<Match3Mode>('mixed')
  const [boardSize, setBoardSize] = useState<BoardSize>(6)
  const [tileSet, setTileSet] = useState<TileDef[]>(() => makeTileSet('mixed'))
  const [board, setBoard] = useState<number[][]>(() => randomBoard(TILE_TYPES, 6))
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem(bestScoreKey(instanceId)) || 0) } catch { return 0 }
  })
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [busy, setBusy] = useState(false)
  const [clearing, setClearing] = useState<Set<string>>(new Set())
  const [shakeCells, setShakeCells] = useState<Set<string>>(new Set())
  const [falling, setFalling] = useState(false)
  const [combo, setCombo] = useState(0)
  const [isShaking, setIsShaking] = useState(false)
  const [swapAnim, setSwapAnim] = useState<{ from: [number, number]; to: [number, number] } | null>(null)
  const [swapNoTransition, setSwapNoTransition] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const { mode: imageMode, cycleMode: cycleImageMode } = useImageDisplayMode()
  const { enabled: sound, enabledRef: soundRef, toggle: toggleSound } = useMatch3Sound(instanceId)

  useEffect(() => {
    try { localStorage.setItem(bestScoreKey(instanceId), String(best)) } catch { /* ignore */ }
  }, [instanceId, best])

  useEffect(() => {
    if (combo <= 1) return
    const timeout = window.setTimeout(() => { setCombo(0); setIsShaking(false) }, 1500)
    return () => window.clearTimeout(timeout)
  }, [combo])

  const resetGame = (nextMode = mode, nextSize = boardSize) => {
    setTileSet(makeTileSet(nextMode))
    setBoard(randomBoard(TILE_TYPES, nextSize))
    setScore(0)
    setSelected(null)
    setClearing(new Set())
    setShakeCells(new Set())
    setCombo(0)
    setIsShaking(false)
  }

  const processCascade = async (start: number[][]) => {
    let boardNow = start
    setBoard(boardNow)
    let comboWave = 1
    let runningScore = score
    while (true) {
      const matches = findMatches(boardNow)
      if (!matches.size) break
      setClearing(matches)
      if (comboWave >= 2) {
        setCombo(comboWave)
        setIsShaking(comboWave >= 3)
      }
      playClearSound(comboWave, soundRef.current)
      await delay(620)
      const cleared = removeMatches(boardNow, matches)
      runningScore += matches.size * 10 * comboWave
      setScore(runningScore)
      if (runningScore > best) setBest(runningScore)
      setClearing(new Set())
      const collapsed = collapseBoard(cleared, TILE_TYPES)
      setFalling(true)
      setBoard(collapsed)
      await delay(700)
      setFalling(false)
      boardNow = collapsed
      if (comboWave >= 2) playCascadeSound(comboWave, soundRef.current)
      comboWave += 1
    }
    if (!hasAnyMove(boardNow)) setBoard(randomBoard(TILE_TYPES, boardSize))
    setBusy(false)
  }

  const swapTiles = async (from: [number, number], to: [number, number]) => {
    if (busy || !adjacent(from, to)) return
    setBusy(true)
    setSelected(null)
    setSwapAnim({ from, to })
    await delay(180)
    const next = trySwap(board, from, to)
    if (!next) {
      playInvalidSound(soundRef.current)
      setSwapAnim(null)
      await delay(180)
      setShakeCells(new Set([`${from[0]},${from[1]}`, `${to[0]},${to[1]}`]))
      window.setTimeout(() => setShakeCells(new Set()), 320)
      setBusy(false)
      return
    }

    playSwapSound(soundRef.current)
    const nextPlayCount = playCount + 1
    setPlayCount(nextPlayCount)
    recordGamePlayed('match3', `${instanceId}:${nextPlayCount}`)
    setSwapNoTransition(true)
    setSwapAnim(null)
    setBoard(next)
    window.requestAnimationFrame(() => setSwapNoTransition(false))
    await processCascade(next)
  }

  const handleTile = async (r: number, c: number) => {
    if (busy) return
    if (!selected) { setSelected([r, c]); playSelectSound(soundRef.current); return }
    const [sr, sc] = selected
    if (sr === r && sc === c) { setSelected(null); return }
    if (!adjacent([sr, sc], [r, c])) { setSelected([r, c]); playSelectSound(soundRef.current); return }
    await swapTiles([sr, sc], [r, c])
  }

  const newGame = () => resetGame(mode, boardSize)
  const setDifficulty = (size: BoardSize) => {
    setBoardSize(size)
    resetGame(mode, size)
  }
  const changeMode = (nextMode: Match3Mode) => {
    setMode(nextMode)
    resetGame(nextMode, boardSize)
  }
  const changeImageMode = () => { setSelected(null); cycleImageMode() }
  const closeHelp = useCallback(() => setHelpOpen(false), [])

  return (
    <section className="match3-card" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={m('三消游戏', 'Match-3')}>
      <Match3Header
        soundEnabled={sound}
        onToggleSound={toggleSound}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="m3-overview-row">
        <Match3StatsRow score={score} best={best} />
        <DifficultyPicker boardSize={boardSize} busy={busy} onDifficultyChange={setDifficulty} />
      </div>

      <Match3ControlRow
        mode={mode}
        busy={busy}
        imageMode={imageMode}
        onModeChange={changeMode}
        onImageModeCycle={changeImageMode}
        onNewGame={newGame}
      />

      <Match3Board
        board={board}
        tileSet={tileSet}
        selected={selected}
        busy={busy}
        clearing={clearing}
        shakeCells={shakeCells}
        swapAnim={swapAnim}
        swapNoTransition={swapNoTransition}
        falling={falling}
        isShaking={isShaking}
        combo={combo}
        imageMode={imageMode}
        onTileClick={handleTile}
        onSwap={swapTiles}
        onDragStart={(cell) => { setSelected(cell); playSelectSound(soundRef.current) }}
      />

      {helpOpen && <Match3HelpDialog onClose={closeHelp} />}
    </section>
  )
}
