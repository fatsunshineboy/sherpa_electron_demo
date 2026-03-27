// 音频播放服务
const Speaker = require('speaker')
const { TTS_CONFIG } = require('../config/constants')

// 播放状态
let isPlaying = false
let currentSpeaker = null

/**
 * 播放 PCM 音频 Buffer
 * @param {Buffer} audioBuffer - PCM 音频数据
 * @returns {Promise<void>}
 */
async function play(audioBuffer) {
  if (isPlaying) {
    stop()
  }

  return new Promise((resolve, reject) => {
    isPlaying = true

    // 创建 Speaker 实例，匹配 TTS 输出参数
    currentSpeaker = new Speaker({
      channels: 1,                        // 单声道
      bitDepth: 16,                       // 16位
      sampleRate: TTS_CONFIG.SAMPLE_RATE, // 24000
    })

    currentSpeaker.on('close', () => {
      isPlaying = false
      currentSpeaker = null
      resolve()
    })

    currentSpeaker.on('error', (err) => {
      isPlaying = false
      currentSpeaker = null
      reject(err)
    })

    // 写入 PCM 数据并结束
    currentSpeaker.write(audioBuffer)

    // 先写入数据，监听 'drain' 事件确保数据完全写入后再 end()
    currentSpeaker.on('drain', () => {
      currentSpeaker.end()
    })
    // currentSpeaker.end()
  })
}

/**
 * 播放多个音频 Buffer（队列播放）
 * @param {Buffer[]} audioBuffers - 音频数据数组
 * @returns {Promise<void>}
 */
async function playQueue(audioBuffers) {
  for (const buffer of audioBuffers) {
    if (!isPlaying) break
    await play(buffer)
  }
}

/**
 * 停止播放
 */
function stop() {
  if (currentSpeaker) {
    try {
      currentSpeaker.end()
    } catch (e) {
      // 忽略错误
    }
    currentSpeaker = null
  }
  isPlaying = false
}

/**
 * 获取播放状态
 * @returns {boolean}
 */
function getPlayingStatus() {
  return isPlaying
}

module.exports = {
  play,
  playQueue,
  stop,
  getPlayingStatus,
}