/** Discord-style groups for the composer emoji picker. */
const list = (items: string) => items.trim().split(/\s+/)

const categories = [
  {
    id: 'smileys',
    title: ['表情与人物', 'Smileys & People'],
    emojis: list(`
      😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 😶‍🌫️ 😐 😑 😬 🫠 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 💀 ☠️ 👻 👽 👾 🤖 💩 🎃
      👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🙏 🫡 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 💋 🩸
      👶 🧒 👦 👧 🧑 👨 👩 🧔 🧔‍♂️ 🧔‍♀️ 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 👼 🤰 🫃 🫄 🤱 👩‍🍼 👨‍🍼 🧑‍🍼 💃 🕺 🧍 🧎 🧑‍🦯 🧑‍🦼 🧑‍🦽 🏃 🚶 🧘 🛀 🛌 🧑‍💻 🧑‍🎤 🧑‍🚀 🧑‍🍳
      ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 🩷 🩵 🩶 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💌 🫂
    `),
  },
  {
    id: 'animals',
    title: ['动物与自然', 'Animals & Nature'],
    emojis: list(`
      🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🦍 🦧 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🫎 🫏 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕
      🐙 🦑 🦐 🦞 🦀 🪼 🪸 🐠 🐟 🐡 🐬 🦈 🐳 🐋 🦭 🐊 🐅 🐆 🦓 🦍 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🦮 🐕‍🦺 🐩 🐈 🐈‍⬛ 🪽 🪿 🦃 🦤 🦚 🦜 🪽 🪶 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔
      🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🪺 🪹 🍄 🪷 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ 🌠 🌌 ☄️ 🌈 🌥️ ☀️ 🌤️ ⛅ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊
    `),
  },
  {
    id: 'food',
    title: ['食物与饮品', 'Food & Drink'],
    emojis: list(`
      🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🫒 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰
      🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡
      🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🧃 🥤 🧋 🧊 🥢 🍽️ 🍴 🥄
    `),
  },
  {
    id: 'activities',
    title: ['活动与游戏', 'Activities'],
    emojis: list(`
      ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️
      🎮 🕹️ 🎰 🎲 🧩 🧸 🪅 🪩 🪆 ♟️ 🎯 🎳 🎪 🎭 🎨 🧵 🪡 🧶 🪢 🎼 🎵 🎶 🎤 🎧 🎷 🪗 🎸 🎹 🎺 🎻 🪕 🥁 🪘 🪇 🎬 🎟️ 🎫 🎠 🎡 🎢 🎤
    `),
  },
  {
    id: 'travel',
    title: ['旅行与地点', 'Travel & Places'],
    emojis: list(`
      🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢
      ⚓ 🛟 ⛽ 🚧 🚦 🚥 🗺️ 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🪵 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎑
      📱 📷 📸 📹 🎥 📽️ 🎞️ 📺 📻 🎙️ 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀
    `),
  },
  {
    id: 'objects',
    title: ['物品与科技', 'Objects'],
    emojis: list(`
      🔋 🪫 🔌 🧯 💡 🔦 🕯️ 🪔 🧸 🪑 🛋️ 🛏️ 🛌 🚪 🪞 🪟 🛁 🚿 🧴 🧷 🧹 🧺 🧻 🪠 🧼 🪥 🧽 🧯 🛒
      🎁 🎈 🎏 🎀 🪄 🪅 🪩 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🔖 🏷️ 📚 📖 📝 ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔑 🗝️ 🔨 🪓 ⛏️ ⚒️ 🛠️ 🗡️ ⚔️ 🔫 🪃 🛡️ 🪚 🔧 🪛 🔩 ⚙️ 🗜️ ⚖️ 🦯 🔗 ⛓️ 🪝 🧰 🧲 🪜
      💎 💍 🪬 🧿 🪙 💰 💴 💵 💶 💷 💸 💳 🧾 💹 🧮 ⚗️ 🧪 🧫 🧬 🔬 🔭 📡 💉 🩹 🩺 🩻 🩼 💊 🩸 🧴 🧷 🪪 🛂 🛃 🛄 🛅
      🕰️ ⏰ ⌚ ⏱️ ⏲️ 🕛 🕧 🕐 🕜 🕑 🕝 🕒 🕞 🕓 🕟 🕔 🕠 🕕 🕡 🕖 🕢 🕗 🕣 🕘 🕤 🕙 🕥 🕚 🕦 ⌛ ⏳
    `),
  },
  {
    id: 'symbols',
    title: ['符号', 'Symbols'],
    emojis: list(`
      ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💟 ❣️ 💌 💢 💥 💫 💦 💨 🕳️ 💬 👁️‍🗨️ 🗨️ 🗯️ 💭 💤
      🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ ⬛ ⬜ 🟥 🟧 🟨 🟩 🟦 🟪 ⬜ 🟫
      ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ 💯 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔱 ⚜️ 🔰 ♻️ 💠 🔘 🔆 🔅 ⚛️ 🕉️ ✡️ ☸️ ☯️ ✝️ ☦️ ☪️ ☮️ 🕎 🔯 🛐
      🚫 ⛔ 📛 🚷 🚯 🚳 🚱 🔞 📵 🔕 🔇 🔔 🔊 🔉 🔈 📣 📢 📴 🆗 🆕 🆙 🆒 🆓 🆖 🆘 🆚 🈁 🈯 🈳 🈵 🈶 🈚 🈸 🈺 🉐 ㊙️ ㊗️
      ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 🔀 🔁 🔂 ▶️ ⏩ ⏭️ ⏯️ ◀️ ⏪ ⏮️ 🔼 ⏫ 🔽 ⏬ ⏸️ ⏹️ ⏺️ ⏏️
      🔟 🔢 #️⃣ *️⃣ 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔠 🔡 🔢 🔣 🔤 🔤 🔤
    `),
  },
  {
    id: 'flags',
    title: ['旗帜', 'Flags'],
    emojis: list(`
      🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️
      🇺🇸 🇨🇦 🇲🇽 🇧🇷 🇦🇷 🇬🇧 🇮🇪 🇫🇷 🇩🇪 🇪🇸 🇮🇹 🇵🇹 🇳🇱 🇧🇪 🇨🇭 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇵🇱 🇺🇦 🇷🇺 🇹🇷 🇬🇷
      🇨🇳 🇭🇰 🇯🇵 🇰🇷 🇮🇳 🇹🇭 🇻🇳 🇸🇬 🇲🇾 🇵🇭 🇮🇩 🇵🇰 🇦🇺 🇳🇿 🇿🇦 🇪🇬 🇳🇬 🇰🇪 🇦🇪 🇸🇦 🇮🇱 🇺🇳
    `),
  },
] as const

const CATEGORY_ORDER = ['smileys', 'food', 'activities', 'animals', 'travel', 'objects', 'symbols', 'flags']

const seen = new Set<string>()
export const EMOJI_CATEGORIES = categories
  .slice()
  .sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id))
  .map((category) => ({
    ...category,
    emojis: category.emojis.filter((emoji) => {
      if (seen.has(emoji)) return false
      seen.add(emoji)
      return true
    }),
  }))

export const EMOJI_LIST = EMOJI_CATEGORIES.flatMap((category) => category.emojis)

/** Common searchable names and aliases; the emoji glyph itself is also searchable. */
export const EMOJI_SEARCH_TERMS: Record<string, string> = {
  '😀': 'grin smile 开心 笑', '😃': 'smile 开心 笑', '😄': 'grin 开心 大笑', '😁': 'beaming 笑',
  '😆': 'laugh 大笑', '😅': 'sweat laugh 尴尬 笑', '😂': 'joy laugh 笑哭', '🤣': 'rofl rolling 笑翻',
  '🥲': 'smile tear 感动', '😊': 'blush happy 开心 微笑', '🙂': 'slight smile 微笑', '😉': 'wink 眨眼',
  '😍': 'heart eyes love 爱 心动', '🥰': 'love hearts 爱 心', '😘': 'kiss 亲吻', '😋': 'yummy delicious 好吃',
  '😜': 'wink tongue 调皮', '🤪': 'crazy goofy 疯', '🤔': 'think 思考', '😎': 'cool sunglasses 酷',
  '🥳': 'party 庆祝 派对', '😏': 'smirk 得意', '🥺': 'pleading 可怜 撒娇', '😢': 'cry sad 哭 难过',
  '😭': 'sob cry 大哭', '😤': 'angry huff 生气', '😡': 'angry mad 生气 愤怒', '🤯': 'mind blown 震惊',
  '😱': 'scream scared 尖叫 害怕', '😴': 'sleep sleepy 睡觉 困', '🤢': 'sick nauseated 恶心',
  '💩': 'poop poo 便便', '👻': 'ghost 幽灵', '🤖': 'robot 机器人', '👋': 'wave hi bye 挥手',
  '👌': 'ok perfect 好', '🤌': 'pinched fingers 意大利手势', '✌️': 'victory peace 耶', '🤞': 'crossed fingers 祈祷',
  '🤟': 'love you 手势', '🤘': 'rock 手势', '👉': 'point right 指向', '👈': 'point left 指向',
  '👍': 'thumbs up like good 赞 喜欢', '👎': 'thumbs down dislike 差', '👏': 'clap applause 鼓掌',
  '🙌': 'raised hands hooray 欢呼', '🫶': 'heart hands 爱心', '🙏': 'pray please thanks 谢谢 拜托',
  '💪': 'strong muscle 力量 加油', '❤️': 'heart love red heart 爱 心', '💔': 'broken heart heartbreak 心碎',
  '💕': 'hearts love 爱心', '🔥': 'fire hot 火 热', '✨': 'sparkles star 闪亮', '⭐': 'star 星星',
  '🌈': 'rainbow 彩虹', '🎉': 'party celebration 庆祝', '🎂': 'cake birthday 生日 蛋糕',
  '☕': 'coffee 咖啡', '🍺': 'beer 啤酒', '🍕': 'pizza 披萨', '🍔': 'burger hamburger 汉堡',
  '🍜': 'noodles ramen 面 拉面', '🍣': 'sushi 寿司', '🍦': 'ice cream 冰淇淋', '🍩': 'donut doughnut 甜甜圈',
  '🐶': 'dog puppy 狗 小狗', '🐱': 'cat kitten 猫 小猫', '🐼': 'panda 熊猫', '🦊': 'fox 狐狸',
  '🐸': 'frog 青蛙', '🦄': 'unicorn 独角兽', '🌸': 'cherry blossom flower 樱花 花',
  '🌻': 'sunflower 向日葵', '⚽': 'soccer football 足球', '🏀': 'basketball 篮球', '🎮': 'video game gaming 游戏',
  '🎵': 'music note 音乐', '🚀': 'rocket 火箭', '✈️': 'airplane plane 飞机', '🚗': 'car 汽车',
  '🏠': 'house home 家 房子', '📷': 'camera 相机', '📱': 'phone mobile 手机', '💻': 'laptop computer 电脑',
  '💡': 'light bulb idea 灯泡 主意', '🎁': 'gift present 礼物', '💰': 'money bag 钱', '✅': 'check done yes 完成 对',
  '❌': 'cross no wrong 错 叉', '💯': 'hundred perfect 满分', '🚫': 'no prohibited 禁止',
}
