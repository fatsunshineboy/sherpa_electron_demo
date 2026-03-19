const fs = require('fs')
const path = require('path')
const { pinyin } = require('pinyin')

// 加载英文发音词典
function loadEnPhone(filePath) {
  const dict = {}
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 2) {
      dict[parts[0].toUpperCase()] = parts.slice(1).join(' ')
    }
  }
  return dict
}

// 拼音拆分表 - 将完整拼音拆分为模型所需的单个token
const pinyinSplitMap = {
  // 声母
  'b': ['b'], 'p': ['p'], 'm': ['m'], 'f': ['f'],
  'd': ['d'], 't': ['t'], 'n': ['n'], 'l': ['l'],
  'g': ['g'], 'k': ['k'], 'h': ['h'],
  'j': ['j'], 'q': ['q'], 'x': ['x'],
  'zh': ['zh'], 'ch': ['ch'], 'sh': ['sh'], 'r': ['r'],
  'z': ['z'], 'c': ['c'], 's': ['s'],
  'y': ['y'], 'w': ['w'],
  // 单韵母
  'a': ['a'], 'o': ['o'], 'e': ['e'], 'i': ['i'], 'u': ['u'], 'v': ['ü'],
  // 带声调的单韵母
  'ā': ['ā'], 'á': ['á'], 'ǎ': ['ǎ'], 'à': ['à'],
  'ō': ['ō'], 'ó': ['ó'], 'ǒ': ['ǒ'], 'ò': ['ò'],
  'ē': ['ē'], 'é': ['é'], 'ě': ['ě'], 'è': ['è'],
  'ī': ['ī'], 'í': ['í'], 'ǐ': ['ǐ'], 'ì': ['ì'],
  'ū': ['ū'], 'ú': ['ú'], 'ǔ': ['ǔ'], 'ù': ['ù'],
  'ǖ': ['ǖ'], 'ǘ': ['ǘ'], 'ǚ': ['ǚ'], 'ǜ': ['ǜ'],
}

// 根据 tokens.txt 中的定义，支持的韵母token
const validTokens = new Set([
  // 声母
  'b', 'c', 'ch', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 'sh', 't', 'w', 'x', 'y', 'z', 'zh',
  // 韵母
  'a', 'ai', 'an', 'ang', 'ao', 'e', 'ei', 'en', 'eng', 'er', 'i', 'ia', 'ian', 'iang', 'iao', 'ie', 'in', 'ing', 'iu',
  'o', 'ong', 'ou', 'u', 'ua', 'uai', 'uan', 'uang', 'ue', 'ui', 'un', 'uo',
  // 带声调韵母
  'à', 'ài', 'àn', 'àng', 'ào', 'á', 'ái', 'án', 'áng', 'áo', 'è', 'èi', 'èn', 'èng', 'ér',
  'ì', 'ín', 'ìng', 'í', 'ò', 'òng', 'òu', 'ó', 'óng', 'óu', 'ù', 'ún', 'ú',
  'ā', 'āi', 'ān', 'āng', 'āo', 'ē', 'ēi', 'ēn', 'ēng', 'ě', 'ī', 'īn', 'īng', 'ō', 'ōng', 'ōu', 'ū', 'ūn',
  'ià', 'iàn', 'iàng', 'iào', 'iá', 'ián', 'iáng', 'iáo', 'iè', 'ié', 'iòng', 'ióng', 'iù', 'iú',
  'iā', 'iān', 'iāng', 'iāo', 'iē', 'iě', 'iōng', 'iū', 'iǎ', 'iǎn', 'iǎng', 'iǎo', 'iǒng', 'iǔ',
  'uà', 'uài', 'uàn', 'uàng', 'uá', 'uái', 'uán', 'uáng', 'uè', 'ué', 'uì', 'uí', 'uò', 'uó',
  'uā', 'uāi', 'uān', 'uāng', 'uē', 'uě', 'uī', 'uō', 'uǎ', 'uǎi', 'uǎn', 'uǎng', 'uǐ', 'uǒ',
  'üè', 'üě', 'ia', 'ian', 'iang', 'iao', 'ie', 'in', 'ing', 'iu', 'ua', 'uai', 'uan', 'uang', 'ue', 'ui', 'un', 'uo',
])

// 拆分拼音音节为单个token（如 xiao3 -> x iǎo，guang1 -> g uāng）
function splitPinyinSyllable(syllable) {
  // 去除声调数字
  const cleanSyllable = syllable.replace(/[0-9]$/, '')
  const tone = syllable.match(/([0-9])$/)?.[1] || ''

  // 查找声母（按长度优先匹配）
  const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'z', 'c', 's', 'r', 'y', 'w']
  let initial = ''
  let final = cleanSyllable

  for (const ini of initials) {
    if (cleanSyllable.startsWith(ini)) {
      initial = ini
      final = cleanSyllable.slice(ini.length)
      break
    }
  }

  // 如果韵母带声调，需要转换
  const finalWithTone = applyToneToFinal(final, tone)

  // 检查 finalWithTone 是否在有效token中，如果不在，尝试拆分
  const validFinals = [
    'iang', 'iong', 'uang', 'ueng',
    'ian', 'iao', 'ing', 'ong', 'uai', 'uan', 'üan',
    'ia', 'ie', 'in', 'iu', 'ua', 'uo', 'ui', 'un',
    'ao', 'ai', 'an', 'ang', 'ou', 'ei', 'en', 'eng', 'er',
    'a', 'o', 'e', 'i', 'u', 'ü', 'v'
  ]

  const result = []
  if (initial) result.push(initial)

  if (finalWithTone) {
    // 尝试匹配最长的有效韵母
    let matched = false
    for (const vf of validFinals) {
      const toned = applyToneToFinal(vf, tone)
      if (finalWithTone === toned || finalWithTone.endsWith(toned.slice(1))) {
        result.push(finalWithTone)
        matched = true
        break
      }
    }
    if (!matched) {
      result.push(finalWithTone)
    }
  }

  return result
}

// 根据声调数字给韵母加上声调
function applyToneToFinal(final, tone) {
  if (!tone || !final) return final

  const toneNum = parseInt(tone)
  if (toneNum === 0 || toneNum > 4) return final

  // 找韵母中的元音并加上声调
  const vowels = 'aeiouv'
  const toneMarks = {
    'a': ['a', 'ā', 'á', 'ǎ', 'à'],
    'e': ['e', 'ē', 'é', 'ě', 'è'],
    'i': ['i', 'ī', 'í', 'ǐ', 'ì'],
    'o': ['o', 'ō', 'ó', 'ǒ', 'ò'],
    'u': ['u', 'ū', 'ú', 'ǔ', 'ù'],
    'v': ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
  }

  // 按优先级找元音
  const priority = 'aeouiv'
  for (const v of priority) {
    const idx = final.indexOf(v)
    if (idx !== -1) {
      const toned = toneMarks[v][toneNum]
      return final.slice(0, idx) + toned + final.slice(idx + 1)
    }
  }

  return final
}

// 检查并验证token是否在有效集合中
function validateTokens(tokens) {
  return tokens.filter(t => validTokens.has(t))
}

// 英文单词转音素
function englishToPhones(word, enPhoneDict) {
  const upper = word.toUpperCase()
  if (enPhoneDict[upper]) {
    return enPhoneDict[upper]
  }
  // 简单规则：每个字母发音（兜底）
  const letterPhones = {
    'A': 'EY1', 'B': 'B IY1', 'C': 'S IY1', 'D': 'D IY1', 'E': 'IY1',
    'F': 'EH1 F', 'G': 'JH IY1', 'H': 'EY1 CH', 'I': 'AY1', 'J': 'JH EY1',
    'K': 'K EY1', 'L': 'EH1 L', 'M': 'EH1 M', 'N': 'EH1 N', 'O': 'OW1',
    'P': 'P IY1', 'Q': 'K Y UW1', 'R': 'AA1 R', 'S': 'EH1 S', 'T': 'T IY1',
    'U': 'Y UW1', 'V': 'V IY1', 'W': 'D AH1 B AH0 L Y UW0', 'X': 'EH1 K S',
    'Y': 'W AY1', 'Z': 'Z IY1'
  }
  return word.toUpperCase().split('').map(c => letterPhones[c] || c).join(' ')
}

// 中文转拼音（数字声调格式，然后拆分）
function chineseToPinyin(text) {
  const result = pinyin(text, { style: pinyin.STYLE_TONE2, segment: false })
  const syllables = result.flat()

  // 拆分每个音节为单个token
  const tokens = []
  for (const syllable of syllables) {
    const split = splitPinyinSyllable(syllable)
    tokens.push(...split)
  }

  return tokens.join(' ')
}

// 转换单个关键词
function convertKeyword(text, enPhoneDict) {
  // 处理下划线（如 Hi_Siri → Hi Siri）
  const words = text.replace(/_/g, ' ').split(/\s+/)
  const tokens = []

  for (const word of words) {
    if (!word) continue
    if (/[\u4e00-\u9fa5]/.test(word)) {
      // 中文
      tokens.push(chineseToPinyin(word))
    } else {
      // 英文
      const phones = englishToPhones(word, enPhoneDict)
      if (phones) tokens.push(phones)
    }
  }

  return tokens.join(' ') + ' @' + text
}

// 主函数：从 raw 生成 keywords.txt
function generateKeywords(rawFile, outputFile, enPhoneFile) {
  const enPhoneDict = loadEnPhone(enPhoneFile)

  const rawContent = fs.readFileSync(rawFile, 'utf-8')
  const lines = rawContent
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => convertKeyword(l, enPhoneDict))
    .filter(l => l)

  fs.writeFileSync(outputFile, lines.join('\n'))
  return lines.length
}

// 读取原始关键词
function loadRawKeywords(rawFile) {
  if (!fs.existsSync(rawFile)) return []
  return fs.readFileSync(rawFile, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

// 保存原始关键词
function saveRawKeywords(rawFile, content) {
  fs.writeFileSync(rawFile, content)
}

module.exports = {
  generateKeywords,
  loadRawKeywords,
  saveRawKeywords,
  convertKeyword,
  loadEnPhone
}
