/**
 * @file tts-service.js
 * @description TTS（Text-To-Speech）服务 - 文本转语音服务，支持本地和 API 两种模式
 * @module services/tts-service
 */

const fetch = require('node-fetch')
const { getConfig } = require('../config/constants')
const sherpa_onnx = require('sherpa-onnx-node')

// 获取配置（包含绝对路径）
const { TTS_CONFIG, LOCAL_TTS_CONFIG } = getConfig()

// TTS 模式：'local' 或 'api'
let ttsMode = 'local'

// 本地 TTS 实例
let localTts = null

/**
 * 初始化本地 TTS 引擎（sherpa-onnx OfflineTts）
 * @function initLocalTts
 * @returns {Object} 本地 TTS 实例
 */
function initLocalTts() {
  if (localTts) return localTts

  const config = {
    model: {
      matcha: {
        acousticModel: LOCAL_TTS_CONFIG.ACOUSTICMODEL,
        vocoder: LOCAL_TTS_CONFIG.VOCODER,
        lexicon: LOCAL_TTS_CONFIG.LEXICON,
        tokens: LOCAL_TTS_CONFIG.TOKENS,
        dataDir: LOCAL_TTS_CONFIG.DATADIR,
      },
      debug: false,
      numThreads: 1,
      provider: 'cpu',
    },
    maxNumSentences: 1,
    ruleFsts: LOCAL_TTS_CONFIG.RULEFSTS,
  }

  localTts = new sherpa_onnx.OfflineTts(config)
  return localTts
}

/**
 * 获取当前 TTS 模式
 * @function getMode
 * @returns {string} 当前模式 ('local' 或 'api')
 */
function getMode() {
  return ttsMode
}

/**
 * 切换 TTS 模式
 * @function toggleMode
 * @returns {string} 切换后的新模式
 */
function toggleMode() {
  ttsMode = ttsMode === 'local' ? 'api' : 'local'
  return ttsMode
}

/**
 * 设置 TTS 模式
 * @function setMode
 * @param {string} mode - 要设置的模式 ('local' 或 'api')
 * @returns {string} 设置后的模式
 */
function setMode(mode) {
  ttsMode = mode
  return ttsMode
}

/**
 * 调用 TTS 将文本转换为语音
 * @param {string} text - 要转换的文本
 * @param {Object} options - 可选参数
 * @param {string} options.voice - 音色 (tongtong, chuichui, xiaochen, etc.)
 * @param {number} options.speed - 语速 [0.5, 2.0]
 * @returns {Promise<Buffer>} - PCM 音频数据 Buffer
 */
async function synthesize(text, options = {}) {
  if (ttsMode === 'local') {
    return synthesizeLocal(text, options)
  } else {
    return synthesizeApi(text, options)
  }
}

/**
 * 本地 TTS 合成 - 使用 sherpa-onnx 将文本转换为语音
 * @async
 * @function synthesizeLocal
 * @param {string} text - 要转换的文本
 * @param {Object} options - 可选参数
 * @param {number} options.speed - 语速 [0.5, 2.0]
 * @returns {Promise<Buffer>} - PCM 音频数据 Buffer（Int16 格式）
 */
async function synthesizeLocal(text, options = {}) {
  const speed = options.speed || 1.0

  const tts = initLocalTts()
  // 使用 generateAsync 并设置 enableExternalBuffer: false 来避免外部缓冲区问题
  const audio = await tts.generateAsync({ text, sid: 0, speed, enableExternalBuffer: false })

  // 使用 Float32Array.from() 创建新副本，避免外部缓冲区问题
  const samplesCopy = Float32Array.from(audio.samples)

  // 转换 Float32 为 Int16 PCM 格式（Speaker 需要 16 位）
  const resultBuffer = Buffer.alloc(samplesCopy.length * 2) // Int16 = 2 bytes
  for (let i = 0; i < samplesCopy.length; i++) {
    // Float32 [-1.0, 1.0] -> Int16 [-32768, 32767]
    const s = Math.max(-1, Math.min(1, samplesCopy[i]))
    resultBuffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, i * 2)
  }
  return resultBuffer
}

/**
 * API TTS 合成 - 调用远程 API 将文本转换为语音
 * @async
 * @function synthesizeApi
 * @param {string} text - 要转换的文本
 * @param {Object} options - 可选参数
 * @param {string} options.voice - 音色
 * @param {number} options.speed - 语速
 * @returns {Promise<Buffer>} - PCM 音频数据 Buffer
 */
async function synthesizeApi(text, options = {}) {
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
  getMode,
  setMode,
  toggleMode,
}