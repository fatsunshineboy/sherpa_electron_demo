// 音频播放服务
const Speaker = require('speaker')

// 播放状态
let isPlaying = false
let currentSpeaker = null

/**
 * 播放 PCM 音频 Buffer
 * @param {Buffer} audioBuffer - PCM 音频数据
 * @param {number} sampleRate - 采样率 (默认 24000，本地 TTS 为 16000)
 * @returns {Promise<void>}
 */
async function play(audioBuffer, sampleRate = 24000) {
  if (isPlaying) {
    stop()
  }

  return new Promise((resolve, reject) => {
    isPlaying = true

    // 创建 Speaker 实例
    currentSpeaker = new Speaker({
      channels: 1,          // 单声道
      bitDepth: 16,         // 16 位
      sampleRate: sampleRate,
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
  })
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

module.exports = {
  play,
  stop,
}
