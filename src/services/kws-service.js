// KWS（关键词唤醒）服务
const sherpa_onnx = require('sherpa-onnx-node')
const portAudio = require('naudiodon2')
const { KWS_CONFIG, PATHS } = require('../config/constants')
const { state, resetAllState } = require('../utils/state-manager')
const vadService = require('./vad-service')
const asrService = require('./asr-service')

// 创建关键词检测器
function createKeywordSpotter() {
  const config = {
    featConfig: {
      sampleRate: KWS_CONFIG.SAMPLE_RATE,
      featureDim: KWS_CONFIG.FEATURE_DIM,
    },
    modelConfig: {
      transducer: {
        encoder: './models/encoder.onnx',
        decoder: './models/decoder.onnx',
        joiner: './models/joiner.onnx',
      },
      tokens: './models/tokens.txt',
      numThreads: KWS_CONFIG.NUM_THREADS,
      provider: KWS_CONFIG.PROVIDER,
      debug: KWS_CONFIG.DEBUG,
    },
    keywordsFile: PATHS.KEYWORDS,
  }

  return new sherpa_onnx.KeywordSpotter(config)
}

// 开始录音
function startRecording(mainWindow) {
  if (state.isRecording) return

  const kwsInstance = createKeywordSpotter()
  const stream = kwsInstance.createStream()

  state.kws = kwsInstance
  state.stream = stream
  state.keywordCounts = {}
  state.isRecording = true

  const ai = new portAudio.AudioIO({
    inOptions: {
      channelCount: 1,
      closeOnError: true,
      deviceId: -1,
      sampleFormat: portAudio.SampleFormatFloat32,
      sampleRate: KWS_CONFIG.SAMPLE_RATE,
    },
  })

  state.ai = ai

  ai.on('data', data => {
    if (!state.isRecording) return

    const samples = new Float32Array(data.buffer)

    // ASR 模式：使用 VAD 检测语音，不向 KWS stream 送入数据
    if (state.asrMode) {
      vadService.processASRWithVAD(samples, mainWindow, asrService)
      return
    }

    // KWS 模式：向 stream 送入数据并检测唤醒词
    stream.acceptWaveform({
      sampleRate: KWS_CONFIG.SAMPLE_RATE,
      samples: samples,
    })

    while (kwsInstance.isReady(stream)) {
      kwsInstance.decode(stream)
    }

    const keyword = kwsInstance.getResult(stream).keyword
    if (keyword !== '') {
      // 更新计数
      if (!state.keywordCounts[keyword]) {
        state.keywordCounts[keyword] = 0
      }
      state.keywordCounts[keyword]++

      // 发送关键词检测到的事件
      mainWindow.webContents.send('keyword-detected', {
        keyword: keyword,
        count: state.keywordCounts[keyword],
        allCounts: state.keywordCounts,
      })

      // 切换到 ASR 模式
      vadService.startASR(mainWindow)
    }
  })

  ai.start()
}

// 停止录音
function stopRecording(mainWindow) {
  // 如果正在 ASR 模式，先通知前端
  if (state.asrMode && mainWindow) {
    mainWindow.webContents.send('asr-stopped')
  }

  // 重置 VAD 状态
  if (state.vad) {
    try { state.vad.free() } catch(e) {}
    state.vad = null
  }
  state.vadBuffer = null
  state.isSpeechActive = false
  state.speechStartTime = null

  // 停止音频输入
  if (state.ai) {
    state.ai.quit()
    state.ai = null
  }

  // 释放 KWS 资源
  if (state.stream) {
    try { state.stream.free() } catch(e) {}
    state.stream = null
  }
  if (state.kws) {
    try { state.kws.free() } catch(e) {}
    state.kws = null
  }

  // 重置状态
  resetAllState()
}

// 仅清理 KWS 实例（用于关键词更新后）
function cleanupKWS() {
  if (state.kws) {
    try { state.kws.free() } catch(e) {}
    state.kws = null
  }
  if (state.stream) {
    try { state.stream.free() } catch(e) {}
    state.stream = null
  }
}

module.exports = {
  createKeywordSpotter,
  startRecording,
  stopRecording,
  cleanupKWS,
}
