import { EMOJI_CATEGORIES } from './emoji'
import { getLang } from './i18n'

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]
const flowers = ['🌷', '🌹', '🌼', '🌻', '🌸', '🪷', '💐']
const leaves = ['🌿', '🍃', '☘️', '🍀']
const animals = ['🐱', '🐶', '🐰', '🐼', '🦊', '🐸', '🐧', '🐻', '🦄', '🐨']
const faces = ['😊', '🥰', '😎', '🤭', '😺', '🥳']
const palette = EMOJI_CATEGORIES.flatMap((group) => group.emojis)
const randomFromPalette = (choices: string[]) => pick(choices.filter((emoji) => palette.includes(emoji)))

const designs = [
  () => {
    const flower = randomFromPalette(flowers); const leaf = randomFromPalette(leaves)
    return `  ${flower}\n ${flower}${flower}${flower}\n  ${leaf}\n 🍃 ${leaf} 🍃\n    🪴`
  },
  () => {
    const animal = randomFromPalette(animals); const face = pick(faces)
    return ` ✨ ✨\n ${animal}${animal}${animal}\n${animal} ${face} ${animal}\n ${animal}${animal}${animal}\n 🐾 🐾`
  },
  () => {
    const person = pick(['👩', '👨', '🧑', '👸', '🤴'])
    const hair = randomFromPalette(['🌸', '🌻', '🎀', '👑'])
    return `  ${hair}${hair}\n ${hair}${person}${hair}\n  👀\n  ${pick(faces)}\n 💐 💐`
  },
  () => {
    const fish = randomFromPalette(['🐠', '🐟', '🐡', '🐬'])
    return `  🫧 🫧\n ${fish}${fish}${fish} ✨\n🌊 🐚 🪸\n 🫧 ${fish} 🫧`
  },
  () => {
    const moon = randomFromPalette(['🌙', '🌛', '🌜'])
    const tree = randomFromPalette(['🌲', '🌳', '🎄'])
    return ` ✨ ${moon} ✨\n    🏠\n 🏠 🏠 🏠\n  ${tree}${tree}\n 🌼 🌷 🌼`
  },
  () => `  🎈\n 🎈🧸🎈\n  ${pick(faces)}\n 🍰 🍓`,
  () => {
    const butterfly = randomFromPalette(['🦋', '🐝', '🐞'])
    return `🌷 🌼 🌷\n ${butterfly} ✨\n🍃 🌸 🍃\n 🌱 🌱`
  },
]

const captions: Record<string, string[]> = {
  zh: ['送你一幅刚出炉的小画，今天也要开心呀！', '路过公共频道，留下一个可爱的小宇宙～', '猜猜我画的是什么？不许说像一团 emoji！', '把一点点可爱偷偷放进今天。', '小小艺术家报到，掌声在哪里？'],
  'zh-TW': ['送你一幅剛出爐的小畫，今天也要開心呀！', '路過公共頻道，留下可愛的小宇宙～', '猜猜我畫的是什麼？不准說像一團 emoji！'],
  en: ['A tiny emoji masterpiece, freshly delivered!', 'Just dropping a little pocket-sized joy into the room.', 'What do you think I made? Be nice to the artist!', 'A little burst of cute for your day.'],
  ja: ['できたての絵文字アートをどうぞ！', 'お部屋に小さなかわいさを置いていくね。', '何を描いたかわかる？作者にやさしくね！'],
  fr: ['Une petite œuvre emoji toute fraîche !', 'Je dépose un peu de douceur dans le salon.', 'Tu devines ce que j’ai dessiné ? Sois gentil avec l’artiste !'],
  es: ['¡Una mini obra de emoji recién hecha!', 'Dejo un poquito de alegría por aquí.', '¿Adivinas qué dibujé? ¡Sé amable con el artista!'],
  de: ['Ein frisch gemaltes kleines Emoji-Kunstwerk!', 'Ich lasse etwas Freude im Chat zurück.', 'Was habe ich gemalt? Sei lieb zum Künstler!'],
  ko: ['갓 만든 작은 이모지 그림이야!', '채팅방에 귀여움을 살짝 놓고 갈게.', '뭘 그렸는지 맞혀볼래? 작가에게 친절하게!'],
  it: ['Una piccola opera emoji appena creata!', 'Lascio un pizzico di allegria nella stanza.', 'Indovini cosa ho disegnato? Sii gentile con l’artista!'],
  ar: ['لوحة إيموجي صغيرة وصلت للتو!', 'أترك قليلًا من البهجة في الدردشة.', 'هل تخمن ما رسمته؟ كن لطيفًا مع الفنان!'],
}

export function createCompanionEmojiArt(name: string): string {
  const lang = getLang()
  const titles: Record<string, string> = {
    zh: '的 emoji 小画', 'zh-TW': '的 emoji 小畫', en: "'s emoji art",
    ja: 'の絵文字アート', fr: ' crée un dessin emoji', es: ' comparte su arte emoji',
    de: 's Emoji-Kunst', ko: '의 이모지 그림', it: ' crea un disegno emoji', ar: ' يرسم لوحة إيموجي',
  }
  const line = pick(captions[lang] ?? captions.en)
  return `🎨 ${name}${titles[lang] ?? titles.en}\n${pick(designs)()}\n${line}`
}
