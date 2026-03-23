// VAD 服务
const sherpa_onnx = require('sherpa-onnx-node')
const { VAD_CONFIG, PATHS } = require('../config/constants')
const { state, resetVadState } = require('../utils/state-manager')

// 创建 VAD 实例
function createVad() {
  const config = {
    sileroVad: {
      model: './models/silero_vad.onnx',
      threshold: 0.5,
      minSpeechDuration: VAD_CONFIG.MIN_SPEECH_DURATION,
      minSilenceDuration: VAD_CONFIG.MIN_SILENCE_DURATION,
      windowSize: VAD_CONFIG.WINDOW_SIZE,
    },
    sampleRate: VAD_CONFIG.SAMPLE_RATE,
    debug: false,
    numThreads: 1,
  }

  // 创建 VAD 实例
  const vadInstance = new sherpa_onnx.Vad(config, VAD_CONFIG.BUFFER_SIZE_SECONDS)

  // 创建循环缓冲区
  const circularBuffer = new sherpa_onnx.CircularBuffer(
    VAD_CONFIG.BUFFER_SIZE_SECONDS * config.sampleRate
  )

  return { vad: vadInstance, buffer: circularBuffer, config }
}

// 初始化 ASR 模式（切换到 VAD 检测）
function startASR(mainWindow) {
  state.asrMode = true
  state.asrResult = ''
  state.segmentId = 0

  // 初始化 VAD
  const vadInstance = createVad()
  state.vad = vadInstance.vad
  state.vadBuffer = vadInstance.buffer
  state.isSpeechActive = false
  state.speechStartTime = null
  // 注意：不在此处设置定时器，而是在语音段结束时设置

  mainWindow.webContents.send('asr-started', { keyword: state.keywordCounts })
}

// 处理 VAD 音频数据
function processASRWithVAD(samples, mainWindow, asrService) {
  const { vad, vadBuffer } = state
  if (!vad || !vadBuffer) return

  const windowSize = vad.config.sileroVad.windowSize

  // 将样本推入循环缓冲区
  vadBuffer.push(new Float32Array(samples))

  // 处理缓冲区中的音频
  while (vadBuffer.size() > windowSize) {
    const externalSamples = vadBuffer.get(vadBuffer.head(), windowSize,false)
    // 深度复制数据以避免 Electron 外部缓冲区限制
    const windowSamples = Float32Array.from(externalSamples)
    vadBuffer.pop(windowSize)

    // 将音频送入 VAD
    vad.acceptWaveform(windowSamples)

    // 检查是否检测到语音
    const detected = vad.isDetected()

    if (detected && !state.isSpeechActive) {
      // 语音开始，清除定时器
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer)
        state.silenceTimer = null
      }
      // 语音开始
      state.isSpeechActive = true
      state.speechStartTime = Date.now()
      mainWindow.webContents.send('asr-status', {
        status: 'listening',
        message: '正在聆听...',
      })
    }

    // 检查是否超过最大持续时间
    if (state.isSpeechActive && state.speechStartTime) {
      const currentDuration = (Date.now() - state.speechStartTime) / 1000
      if (currentDuration >= VAD_CONFIG.MAX_SPEECH_DURATION) {
        // 强制截断
        console.log(`Speech duration ${currentDuration}s exceeds limit, forcing send`)

        // 强制刷新 VAD，把当前积累的语音输出
        vad.flush()

        // 从 VAD 中获取当前积累的语音段
        const segments = []
        while (!vad.isEmpty()) {
          segments.push(vad.front(false))
          vad.pop()
        }

        if (segments.length > 0) {
          const { mergeSpeechSegments } = require('../audio/audio-utils')
          const mergedSamples = mergeSpeechSegments(segments)
          if (mergedSamples) {
            asrService.processSpeechSegment(mainWindow, mergedSamples, true)
          }
        }

        state.isSpeechActive = false
        state.speechStartTime = null
        continue
      }
    }

    // 检查是否有完成的语音段（语音结束）
    while (!vad.isEmpty()) {
      const segment = vad.front(false)
      vad.pop()

      // 语音段结束，更新状态
      state.isSpeechActive = false
      state.speechStartTime = null

      // 启动 2 秒静音定时器，如果 2 秒内没有新语音则退出 ASR
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer)
      }
      state.silenceTimer = setTimeout(() => {
        console.log(`Silence too long, exiting ASR`)
        finishASR(mainWindow, asrService)
      }, VAD_CONFIG.SILENCE_TIMEOUT)

      const duration = segment.samples.length / vad.config.sampleRate
      console.log(`VAD: Speech segment ended, duration: ${duration}s`)

      // 发送这段语音进行识别
      asrService.processSpeechSegment(mainWindow, segment.samples, false)
    }
  }
}

// 完成 ASR，处理剩余语音段
async function finishASR(mainWindow, asrService) {
  if (!state.asrMode) return

  // 清除定时器
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer)
    state.silenceTimer = null
  }

  state.asrMode = false

  // 处理 VAD 中剩余的语音段
  if (state.vad) {
    const segments = []
    while (!state.vad.isEmpty()) {
      segments.push(state.vad.front(false))
      state.vad.pop()
    }

    if (segments.length > 0) {
      const { mergeSpeechSegments } = require('../audio/audio-utils')
      const mergedSamples = mergeSpeechSegments(segments)
      if (mergedSamples) {
        await asrService.processSpeechSegment(mainWindow, mergedSamples, true)
      }
    }

    // 释放 VAD 资源
    try { state.vad.free() } catch(e) {}
    state.vad = null
  }

  state.vadBuffer = null
  state.isSpeechActive = false
  state.speechStartTime = null

  // 重置 KWS stream，清除 ASR 期间积累的音频数据
  if (state.kws) {
    if (state.stream) {
      try { state.stream.free() } catch(e) {}
    }
    state.stream = state.kws.createStream()
    console.log('KWS stream reset after ASR')
  }

  mainWindow.webContents.send('asr-done')
}

module.exports = {
  createVad,
  startASR,
  processASRWithVAD,
  finishASR,
}
