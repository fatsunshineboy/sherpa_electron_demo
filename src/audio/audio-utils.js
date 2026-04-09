const { KWS_CONFIG } = require('../config/constants')
const { state } = require('../utils/state-manager')

const portAudio = require('naudiodon2')

// 将 Float32 音频数据转换为 WAV 格式 Buffer
function createWavBuffer(float32Data, sampleRate = 16000) {
  // 转换为 16-bit PCM
  const pcmData = new Int16Array(float32Data.length)
  for (let i = 0; i < float32Data.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Data[i]))
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  const wavBuffer = Buffer.alloc(44 + pcmData.length * 2)

  // WAV 文件头
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(36 + pcmData.length * 2, 4)
  wavBuffer.write('WAVE', 8)
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16)
  wavBuffer.writeUInt16LE(1, 20)  // PCM format
  wavBuffer.writeUInt16LE(1, 22)  // 单声道
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(sampleRate * 2, 28)  // byte rate
  wavBuffer.writeUInt16LE(2, 32)  // block align
  wavBuffer.writeUInt16LE(16, 34) // bits per sample
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(pcmData.length * 2, 40)

  // 写入 PCM 数据
  for (let i = 0; i < pcmData.length; i++) {
    wavBuffer.writeInt16LE(pcmData[i], 44 + i * 2)
  }

  return wavBuffer
}

// 合并多个语音段
function mergeSpeechSegments(segments) {
  if (!segments || segments.length === 0) return null

  const totalSamples = segments.reduce((sum, seg) => sum + seg.samples.length, 0)
  const mergedSamples = new Float32Array(totalSamples)
  let offset = 0
  for (const seg of segments) {
    mergedSamples.set(seg.samples, offset)
    offset += seg.samples.length
  }
  return mergedSamples
}

/**
 * 创建 KWS/VAD 音频处理的音频数据回调
 * @param {BrowserWindow} mainWindow - Electron 窗口
 * @returns {Function} 音频数据回调函数
 */
function createAudioDataCallback(mainWindow) {
  return function handleAudioData(data) {
    if (!state.isRecording) return
    if (state.skipAudioInput) return

    const samples = new Float32Array(data.buffer)

    if (state.asrMode) {
      require('../services/vad-service').processASRWithVAD(samples, mainWindow)
      return
    }

    const currentKws = state.kws
    const currentStream = state.stream
    if (!currentKws || !currentStream) return

    currentStream.acceptWaveform({
      sampleRate: KWS_CONFIG.SAMPLE_RATE,
      samples: samples,
    })

    while (currentKws.isReady(currentStream)) {
      currentKws.decode(currentStream)
    }

    const keyword = currentKws.getResult(currentStream).keyword
    if (keyword !== '') {
      if (!state.keywordCounts[keyword]) {
        state.keywordCounts[keyword] = 0
      }
      state.keywordCounts[keyword]++

      mainWindow.webContents.send('keyword-detected', {
        keyword: keyword,
        count: state.keywordCounts[keyword],
        allCounts: state.keywordCounts,
      })

      require('../services/vad-service').startASR(mainWindow)
    }
  }
}

/**
 * 创建 AudioIO 输入实例
 * @param {Object} options - 可选的覆盖选项
 * @returns {Object} AudioIO 实例
 */
function createAudioInput(options = {}) {
  return new portAudio.AudioIO({
    inOptions: {
      channelCount: 1,
      closeOnError: true,
      deviceId: -1,
      sampleFormat: portAudio.SampleFormatFloat32,
      sampleRate: options.sampleRate || KWS_CONFIG.SAMPLE_RATE,
      ...options,
    },
  })
}

module.exports = {
  createWavBuffer,
  mergeSpeechSegments,
  createAudioDataCallback,
  createAudioInput
}
