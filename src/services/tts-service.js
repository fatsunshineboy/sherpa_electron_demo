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

module.exports = {
  synthesize,
}