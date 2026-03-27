// TTS 服务 - 文本转语音
const fetch = require('node-fetch')
const { TTS_CONFIG } = require('../config/constants')

/**
 * 调用 TTS API 将文本转换为语音
 * @param {string} text - 要转换的文本
 * @param {Object} options - 可选参数
 * @param {string} options.voice - 音色 (tongtong, chuichui, xiaochen, etc.)
 * @param {number} options.speed - 语速 [0.5, 2.0]
 * @returns {Promise<Buffer>} - PCM 音频数据 Buffer
 */
async function synthesize(text, options = {}) {
  const voice = options.voice || TTS_CONFIG.VOICE
  const speed = options.speed || TTS_CONFIG.SPEED

  const requestBody = {
    model: TTS_CONFIG.MODEL,
    input: text,
    voice: voice,
    response_format: TTS_CONFIG.RESPONSE_FORMAT, // pcm
  }

  // 添加可选参数
  if (speed !== 1.0) {
    requestBody.speed = speed
  }

  const requestOptions = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TTS_CONFIG.KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }

  try {
    const response = await fetch(TTS_CONFIG.URL, requestOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS API error: ${response.status} - ${errorText}`)
    }

    // 获取 PCM 音频数据 (ArrayBuffer)
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('TTS service error:', error)
    throw error
  }
}

/**
 * 处理长文本，分段合成（TTS 单次请求最大 1024 字符）
 * @param {string} text - 要转换的长文本
 * @param {Object} options - 可选参数
 * @returns {Promise<Buffer[]>} - 音频数据 Buffer 数组
 */
async function synthesizeLongText(text, options = {}) {
  const maxLength = 1000 // 留一些余量
  const buffers = []

  // 按句子分割
  const sentences = splitIntoSentences(text)

  let currentChunk = ''
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      // 当前块已满，先合成
      if (currentChunk.trim()) {
        const buffer = await synthesize(currentChunk.trim(), options)
        buffers.push(buffer)
      }
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }

  // 处理最后一块
  if (currentChunk.trim()) {
    const buffer = await synthesize(currentChunk.trim(), options)
    buffers.push(buffer)
  }

  return buffers
}

/**
 * 将文本按句子分割
 * @param {string} text - 输入文本
 * @returns {string[]} - 句子数组
 */
function splitIntoSentences(text) {
  // 按中英文句号、问号、感叹号分割
  const sentences = text.split(/(?<=[。！？.!?])\s*/)

  // 对于没有标点结束的长文本，强制分割
  const result = []
  for (const sentence of sentences) {
    if (sentence.length > 500) {
      // 每 500 字符强制分割
      for (let i = 0; i < sentence.length; i += 500) {
        result.push(sentence.slice(i, i + 500))
      }
    } else {
      result.push(sentence)
    }
  }

  return result.filter(s => s.trim())
}

/**
 * 获取支持的音色列表
 * @returns {Array} - 音色列表
 */
function getSupportedVoices() {
  return [
    { id: 'tongtong', name: '彤彤', description: '默认女声' },
    { id: 'chuichui', name: '锤锤', description: '男声' },
    { id: 'xiaochen', name: '小陈', description: '男声' },
    { id: 'jam', name: 'Jam', description: '动动动物圈' },
    { id: 'kazi', name: 'Kazi', description: '动动动物圈' },
    { id: 'douji', name: 'Douji', description: '动动动物圈' },
    { id: 'luodo', name: 'Luodo', description: '动动动物圈' },
  ]
}

module.exports = {
  synthesize,
  synthesizeLongText,
  getSupportedVoices,
}