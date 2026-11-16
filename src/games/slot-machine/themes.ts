import type { SymbolId } from './model'

export type ThemeArt = Record<SymbolId, string>
export type ThemeLabels = Record<SymbolId, [string, string]>

export interface SlotTheme {
  id: string
  /** Chinese / English name shown in the card subtitle. */
  name: [string, string]
  /** Emoji for every reel symbol. The wild always stays as the 777 image (empty string here). */
  art: ThemeArt
  /** Pay-table names for every symbol. */
  labels: ThemeLabels
}

const WILD_LABEL: [string, string] = ['百搭', 'WILD']

/**
 * Symbol art sets you can cycle with the shuffle button next to the help icon.
 * The seven regular symbols keep their existing weights / payouts (only the
 * artwork changes), and the wild never changes — it is always the 777 image.
 * Emoji sets are picked from the composer's Animals, Food, Activities and
 * Travel categories; the first set is the original classic-fruit machine.
 */
export const SLOT_THEMES: SlotTheme[] = [
  {
    id: 'classic',
    name: ['经典水果', 'Classic Fruits'],
    art: { cherry: '🍒', lemon: '🍋', orange: '🍊', grapes: '🍇', bell: '🔔', star: '⭐', diamond: '💎', wild: '' },
    labels: {
      cherry: ['樱桃', 'Cherry'], lemon: ['柠檬', 'Lemon'], orange: ['橘子', 'Orange'], grapes: ['葡萄', 'Grapes'],
      bell: ['铃铛', 'Bell'], star: ['星星', 'Star'], diamond: ['钻石', 'Diamond'], wild: WILD_LABEL,
    },
  },
  {
    id: 'food',
    name: ['美食甜点', 'Food & Drink'],
    art: { cherry: '🍓', lemon: '🥝', orange: '🍍', grapes: '🍉', bell: '🍩', star: '🍰', diamond: '🍦', wild: '' },
    labels: {
      cherry: ['草莓', 'Strawberry'], lemon: ['猕猴桃', 'Kiwi'], orange: ['菠萝', 'Pineapple'], grapes: ['西瓜', 'Watermelon'],
      bell: ['甜甜圈', 'Donut'], star: ['蛋糕', 'Cake'], diamond: ['冰淇淋', 'Ice Cream'], wild: WILD_LABEL,
    },
  },
  {
    id: 'animals',
    name: ['动物自然', 'Animals & Nature'],
    art: { cherry: '🐱', lemon: '🦊', orange: '🐼', grapes: '🦄', bell: '🌸', star: '🌻', diamond: '🦋', wild: '' },
    labels: {
      cherry: ['猫咪', 'Cat'], lemon: ['狐狸', 'Fox'], orange: ['熊猫', 'Panda'], grapes: ['独角兽', 'Unicorn'],
      bell: ['樱花', 'Cherry Blossom'], star: ['向日葵', 'Sunflower'], diamond: ['蝴蝶', 'Butterfly'], wild: WILD_LABEL,
    },
  },
  {
    id: 'activities',
    name: ['运动游戏', 'Activities'],
    art: { cherry: '⚽', lemon: '🏀', orange: '🎾', grapes: '🎮', bell: '🎲', star: '🎯', diamond: '🏆', wild: '' },
    labels: {
      cherry: ['足球', 'Soccer'], lemon: ['篮球', 'Basketball'], orange: ['网球', 'Tennis'], grapes: ['游戏机', 'Video Game'],
      bell: ['骰子', 'Dice'], star: ['飞镖', 'Bullseye'], diamond: ['奖杯', 'Trophy'], wild: WILD_LABEL,
    },
  },
  {
    id: 'travel',
    name: ['旅行地点', 'Travel & Places'],
    art: { cherry: '🚗', lemon: '✈️', orange: '🚀', grapes: '🏝️', bell: '🎡', star: '⛵', diamond: '🗼', wild: '' },
    labels: {
      cherry: ['汽车', 'Car'], lemon: ['飞机', 'Airplane'], orange: ['火箭', 'Rocket'], grapes: ['海岛', 'Island'],
      bell: ['摩天轮', 'Ferris Wheel'], star: ['帆船', 'Sailboat'], diamond: ['东京塔', 'Tower'], wild: WILD_LABEL,
    },
  },
]

export function themeAt(index: number): SlotTheme {
  return SLOT_THEMES[((index % SLOT_THEMES.length) + SLOT_THEMES.length) % SLOT_THEMES.length] ?? SLOT_THEMES[0]
}
