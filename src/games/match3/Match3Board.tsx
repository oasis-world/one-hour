import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { TileDef } from './tiles'
import { adjacent, type Board } from './model'
import type { ImageDisplayMode } from './useImageDisplayMode'
import { matchText as m } from './matchText'
import './Match3Game.css'

type Cell = [number, number]
type SwapAnimation = { from: Cell; to: Cell }
type DragSprite = { src: string; x: number; y: number; width: number; height: number }

interface Match3BoardProps {
  board: Board
  tileSet: TileDef[]
  selected: Cell | null
  busy: boolean
  clearing: Set<string>
  shakeCells: Set<string>
  swapAnim: SwapAnimation | null
  swapNoTransition: boolean
  falling: boolean
  isShaking: boolean
  combo: number
  imageMode: ImageDisplayMode
  onTileClick: (r: number, c: number) => void
  onSwap: (from: Cell, to: Cell) => void
  onDragStart: (cell: Cell) => void
}

export default function Match3Board({
  board, tileSet, selected, busy, clearing, shakeCells, swapAnim, swapNoTransition,
  falling, isShaking, combo, onTileClick, onSwap, onDragStart,
  imageMode,
}: Match3BoardProps) {
  const dragRef = useRef<{ start: Cell; x: number; y: number; moved: boolean } | null>(null)
  const justDraggedRef = useRef(false)
  const [dragSprite, setDragSprite] = useState<DragSprite | null>(null)
  const [dragOrigin, setDragOrigin] = useState<Cell | null>(null)

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || busy) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) < 10) return
      if (!drag.moved) {
        drag.moved = true
        setDragOrigin(drag.start)
      const rect = event.currentTarget.getBoundingClientRect()
      const image = event.currentTarget.querySelector('img')
      const ratio = image?.naturalWidth && image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 1
      let width = rect.width * 1.48
      let height = rect.height * 1.48
      if (width / height > ratio) width = height * ratio
      else height = width / ratio
      setDragSprite({ src: image?.src ?? '', x: event.clientX, y: event.clientY, width, height })
      onDragStart(drag.start)
    } else {
      setDragSprite((sprite) => sprite ? { ...sprite, x: event.clientX, y: event.clientY } : sprite)
    }
  }

  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.moved) return
    setDragSprite(null)
    setDragOrigin(null)
    justDraggedRef.current = true
    window.setTimeout(() => { justDraggedRef.current = false }, 0)

    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-m3-row][data-m3-col]')
    const targetCell: Cell | null = target
      ? [Number(target.dataset.m3Row), Number(target.dataset.m3Col)]
      : null
    if (targetCell?.[0] === drag.start[0] && targetCell?.[1] === drag.start[1]) return
    if (targetCell && adjacent(drag.start, targetCell)) {
      onSwap(drag.start, targetCell)
      return
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    const destination: Cell = [...drag.start]
    if (Math.abs(dx) >= Math.abs(dy)) destination[1] += dx >= 0 ? 1 : -1
    else destination[0] += dy >= 0 ? 1 : -1
    if (destination[0] >= 0 && destination[1] >= 0 && destination[0] < board.length && destination[1] < board.length) {
      onSwap(drag.start, destination)
    }
  }

  return (
    <>
      <div
        className={`m3-grid display-${imageMode}${falling ? ' is-falling' : ''}${isShaking ? ' is-shaking' : ''}${combo > 1 ? ' is-cascade' : ''}`}
        style={{
          gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${board.length}, minmax(0, 1fr))`,
        }}
      >
        {board.map((row, r) => row.map((tile, c) => {
          const key = `${r},${c}`
          const isSelected = selected?.[0] === r && selected?.[1] === c
          const isDragOrigin = dragOrigin?.[0] === r && dragOrigin?.[1] === c
          const style: CSSProperties = {}
          if (swapAnim) {
            const fromKey = `${swapAnim.from[0]},${swapAnim.from[1]}`
            const toKey = `${swapAnim.to[0]},${swapAnim.to[1]}`
            if (key === fromKey) style.transform = `translate(${(swapAnim.to[1] - swapAnim.from[1]) * 100}%, ${(swapAnim.to[0] - swapAnim.from[0]) * 100}%)`
            if (key === toKey) style.transform = `translate(${(swapAnim.from[1] - swapAnim.to[1]) * 100}%, ${(swapAnim.from[0] - swapAnim.to[0]) * 100}%)`
          }
          if (falling) style.animationDelay = `${r * 24 + (c % 2) * 12}ms`
          return (
            <button
              key={key}
              type="button"
              className={`m3-tile${isSelected ? ' is-selected' : ''}${isDragOrigin ? ' is-drag-origin' : ''}${clearing.has(key) ? ' is-clearing' : ''}${shakeCells.has(key) ? ' is-shaking' : ''}${swapNoTransition ? ' no-transition' : ''}`}
              style={style}
              data-m3-row={r}
              data-m3-col={c}
              onClick={() => {
                if (justDraggedRef.current) { justDraggedRef.current = false; return }
                onTileClick(r, c)
              }}
              onPointerDown={(event) => {
                if (busy || event.button !== 0) return
                dragRef.current = { start: [r, c], x: event.clientX, y: event.clientY, moved: false }
                try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* optional */ }
              }}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => { dragRef.current = null; setDragSprite(null); setDragOrigin(null) }}
              disabled={busy}
              aria-label={tileSet[tile]?.id ?? ''}
            >
              {tileSet[tile] && <img src={tileSet[tile].src} alt="" draggable={false} loading="lazy" />}
            </button>
          )
        }))}
      </div>
      {dragSprite && (
        <img
          className="m3-drag-sprite"
          src={dragSprite.src}
          alt=""
          draggable={false}
          style={{
            left: Math.round(dragSprite.x - dragSprite.width / 2),
            top: Math.round(dragSprite.y - dragSprite.height / 2),
            width: Math.round(dragSprite.width),
            height: Math.round(dragSprite.height),
          }}
        />
      )}
      {combo > 1 && <div className="m3-combo" role="status"><span>{m('连消', 'CHAIN')}</span><strong>×{combo}</strong></div>}
    </>
  )
}
