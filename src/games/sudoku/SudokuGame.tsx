import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { GameComponentProps } from '../types'
import { t, useLang } from '../../lib/i18n'
import SudokuIcon from './SudokuIcon'
import { createSudoku, getConflicts, isSolved, isSudokuState, type Difficulty, type SudokuSnapshot, type SudokuState } from './model'
import './SudokuGame.css'

const storageKey = (id: string) => `sudoku:${id}`
const loadGame = (id: string): SudokuState | null => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null')
    return isSudokuState(value) ? value : null
  } catch { return null }
}
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
const snapshot = (state: SudokuState): SudokuSnapshot => ({ values: [...state.values], notes: state.notes.map((notes) => [...notes]) })
const difficultyName = (level: Difficulty) => level === 'easy' ? t('简单', 'Easy') : level === 'medium' ? t('中等', 'Medium') : t('困难', 'Hard')

export default function SudokuGame({ instanceId }: GameComponentProps) {
  useLang()
  const [state, setState] = useState(() => loadGame(instanceId) ?? createSudoku('easy'))
  const [selected, setSelected] = useState(() => Math.max(0, state.values.findIndex((value, index) => !state.puzzle[index] && !value)))
  const [notesMode, setNotesMode] = useState(false)
  const [now, setNow] = useState(state.startedAt)
  const conflicts = useMemo(() => getConflicts(state.values), [state.values])
  const selectedValue = selected === null ? 0 : state.values[selected]
  const elapsed = Math.floor((now - state.startedAt) / 1000)
  const filled = state.values.filter(Boolean).length

  useEffect(() => {
    try { localStorage.setItem(storageKey(instanceId), JSON.stringify(state)) } catch { /* Storage may be unavailable. */ }
  }, [instanceId, state])
  useEffect(() => {
    if (state.complete) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state.complete])

  const saveHistory = (current: SudokuState) => [...current.history.slice(-99), snapshot(current)]
  const enterDigit = (digit: number) => {
    if (selected === null || state.complete || state.puzzle[selected]) return
    setState((current) => {
      const history = saveHistory(current)
      if (notesMode) {
        if (current.values[selected]) return current
        const notes = current.notes.map((cell, index) => index !== selected ? cell : cell.includes(digit) ? cell.filter((n) => n !== digit) : [...cell, digit].sort())
        return { ...current, notes, history }
      }
      const values = [...current.values]
      values[selected] = digit
      const notes = current.notes.map((cell, index) => index === selected ? [] : cell)
      const complete = isSolved(values, current.solution)
      return { ...current, values, notes, mistakes: current.mistakes + (digit !== current.solution[selected] ? 1 : 0), complete, history }
    })
  }
  const clearCell = () => {
    if (selected === null || state.complete || state.puzzle[selected]) return
    setState((current) => ({ ...current, values: current.values.map((value, index) => index === selected ? 0 : value), notes: current.notes.map((cell, index) => index === selected ? [] : cell), history: saveHistory(current) }))
  }
  const undo = () => setState((current) => {
    const previous = current.history.at(-1)
    return previous ? { ...current, ...previous, complete: false, history: current.history.slice(0, -1) } : current
  })
  const hint = () => {
    const index = selected !== null && !state.values[selected] && !state.puzzle[selected]
      ? selected : state.values.findIndex((value, cell) => !value && !state.puzzle[cell])
    if (index < 0 || state.complete) return
    setSelected(index)
    setState((current) => {
      const values = [...current.values]
      values[index] = current.solution[index]
      return { ...current, values, notes: current.notes.map((cell, i) => i === index ? [] : cell), hints: current.hints + 1, complete: isSolved(values, current.solution), history: saveHistory(current) }
    })
  }
  const newGame = (difficulty: Difficulty = state.difficulty) => {
    const next = createSudoku(difficulty)
    setState(next)
    setSelected(Math.max(0, next.values.findIndex((value, index) => !next.puzzle[index] && !value)))
    setNotesMode(false)
    setNow(next.startedAt)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key >= '1' && event.key <= '9') { event.preventDefault(); enterDigit(Number(event.key)); return }
    if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') { event.preventDefault(); clearCell(); return }
    if (selected === null || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const row = Math.floor(selected / 9), column = selected % 9
    const nextRow = Math.max(0, Math.min(8, row + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0)))
    const nextColumn = Math.max(0, Math.min(8, column + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0)))
    setSelected(nextRow * 9 + nextColumn)
  }
  const moveSelection = (index: number) => setSelected(index)

  return <section className="sudoku-card" onKeyDown={onKeyDown} aria-label={t('数独游戏', 'Sudoku game')}>
    <header className="sudoku-header">
      <div className="sudoku-brand"><span className="sudoku-logo"><SudokuIcon size={27} /></span><span><strong>{t('数独', 'Sudoku')}</strong><small>{t('专注 · 推理 · 沉浸', 'FOCUS · LOGIC · FLOW')}</small></span></div>
      <div className="sudoku-stats"><span><small>{t('时间', 'TIME')}</small><b>{formatTime(elapsed)}</b></span><i /><span><small>{t('错误', 'Mistakes')}</small><b>{String(state.mistakes).padStart(2, '0')}</b></span></div>
    </header>
    <div className="sudoku-difficulties" role="group" aria-label={t('难度', 'Difficulty')}>
      {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => <button key={level} type="button" className={state.difficulty === level ? 'is-active' : ''} onClick={() => newGame(level)}>{difficultyName(level)}</button>)}
    </div>
    <div className="sudoku-board" role="grid" aria-label={t('数独九宫格', 'Sudoku board')}>
      {state.values.map((value, index) => {
        const row = Math.floor(index / 9), column = index % 9
        const isSelected = selected === index
        const selectedRow = selected === null ? -1 : Math.floor(selected / 9)
        const selectedColumn = selected === null ? -1 : selected % 9
        const sameLine = selectedRow === row || selectedColumn === column
        const sameBox = selected !== null && Math.floor(selectedRow / 3) === Math.floor(row / 3) && Math.floor(selectedColumn / 3) === Math.floor(column / 3)
        const sameNumber = Boolean(value && selectedValue === value)
        const wrong = Boolean(value && !state.puzzle[index] && state.solution[index] !== value)
        const classes = ['sudoku-cell', state.puzzle[index] ? 'is-given' : value ? 'is-entry' : '', isSelected ? 'is-selected' : '', sameBox && !isSelected ? 'is-related-box' : '', sameLine && !isSelected ? 'is-related-line' : '', sameNumber && !isSelected ? 'is-same-number' : '', conflicts.has(index) || wrong ? 'is-wrong' : '', column % 3 === 2 && column !== 8 ? 'has-box-right' : '', row % 3 === 2 && row !== 8 ? 'has-box-bottom' : ''].filter(Boolean).join(' ')
        const location = t('第{{row}}行第{{column}}列', 'Row {{row}}, column {{column}}').replace('{{row}}', String(row + 1)).replace('{{column}}', String(column + 1))
        const label = `${location}${value ? `, ${value}` : t('，空格', ', empty')}${state.puzzle[index] ? t('，预设数字', ', given clue') : ''}`
        return <button key={index} type="button" role="gridcell" aria-label={label} aria-selected={isSelected} className={classes} onClick={() => moveSelection(index)}>
          {value ? <span className="sudoku-value">{value}</span> : <span className="sudoku-notes">{state.notes[index].map((note) => <i key={note}>{note}</i>)}</span>}
        </button>
      })}
    </div>
    <div className="sudoku-progress"><span>{t('已填写', 'Filled')} <b>{filled}<i>/81</i></b></span><span>{t('提示', 'Hints')} <b>{state.hints}</b></span><span>{t('可撤销', 'Undo count')} <b>{state.history.length}</b></span></div>
    <div className="sudoku-numberpad" aria-label={t('数字键盘', 'Number pad')}>
      {Array.from({ length: 9 }, (_, i) => i + 1).map((digit) => <button key={digit} type="button" className={selectedValue === digit ? 'is-highlighted' : ''} onClick={() => enterDigit(digit)} aria-label={`${t('填入数字', 'Enter number')} ${digit}`}>{digit}</button>)}
    </div>
    <footer className="sudoku-actions">
      <button type="button" className={notesMode ? 'is-active' : ''} onClick={() => setNotesMode((active) => !active)} aria-pressed={notesMode} title={t('在空格中记录候选数字；它们只是备忘，不会作为答案。', 'Write possible digits in an empty cell; notes are reminders, not answers.')}><span>✎</span>{t('笔记', 'Notes')}</button>
      <button type="button" onClick={clearCell}><span>⌫</span>{t('擦除', 'Erase')}</button>
      <button type="button" onClick={undo} disabled={!state.history.length}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5 3 9l4 4" /><path d="M3.5 9H11a5 5 0 0 1 0 10H9" /></svg>{t('撤销', 'Undo')}</button>
      <button type="button" onClick={hint}><span>✦</span>{t('提示', 'Hint')}</button>
      <button type="button" onClick={() => newGame()}><span>↻</span>{t('新局', 'New')}</button>
    </footer>
    {notesMode && <p className="sudoku-note-help" aria-live="polite">{t('候选数字会以小字记在格内，不会作为答案；再次输入可移除。', 'Candidate digits appear as small notes in an empty cell. Enter one again to remove it.')}</p>}
    {state.complete && <div className="sudoku-win" role="status"><span>✦</span><b>{t('漂亮！全部解开了', 'Brilliant! Puzzle solved')}</b><small>{t('用时', 'Completed in')} {formatTime(elapsed)}</small></div>}
    <p className="sudoku-tip">{t('键盘可直接输入数字，方向键切换格子', 'Type a number or use arrow keys to move')}</p>
  </section>
}
