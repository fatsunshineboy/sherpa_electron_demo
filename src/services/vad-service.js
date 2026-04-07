// VAD 服务
const sherpa_onnx = require('sherpa-onnx-node')
const { state, resetVadState, resetAsrState, resetKwsState } = require('../utils/state-manager')
const { VAD_CONFIG, KWS_CONFIG, PATHS } = require('../config/constants')
const chatService = require('./chat-service')
const ttsService = require('./tts-service')
const audioPlayer = require('../audio/audio-player')
const asrService = require('./asr-service')

// 静音计时器相关状态
let silenceTimerRemaining = VAD_CONFIG.SILENCE_TIMEOUT // 剩余时间（毫秒）
let silenceTimerStartTime = null // 计时器开始时间
let silenceTimerInterval = null // 倒计时更新定时器

// 启动静音计时器：SILENCE_TIMEOUT 秒内没有新语音则退出 ASR 回到 KWS 模式
function startSilenceTimer(mainWindow) {
  // 清除现有的计时器
  if (silenceTimerInterval) {
    clearInterval(silenceTimerInterval)
    silenceTimerInterval = null
  }
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer)
    state.silenceTimer = null
  }

  // 重置剩余时间
  silenceTimerRemaining = VAD_CONFIG.SILENCE_TIMEOUT
  silenceTimerStartTime = Date.now()

  // 启动实际退出计时器
  state.silenceTimer = setTimeout(() => {
    console.log('Silence too long, exiting ASR')
    finishASR(mainWindow)
  }, silenceTimerRemaining)

  // 启动倒计时更新（每 100ms 更新一次前端显示）
  silenceTimerInterval = setInterval(() => {
    const elapsed = Date.now() - silenceTimerStartTime
    const remaining = Math.max(0, silenceTimerRemaining - elapsed)
    mainWindow.webContents.send('silence-timer-update', {
      remaining: remaining,
      total: silenceTimerRemaining,
    })
  }, 100)
}

// 暂停静音计时器（Chat+TTS 期间调用）
function pauseSilenceTimer(mainWindow) {
  if (silenceTimerInterval) {
    clearInterval(silenceTimerInterval)
    silenceTimerInterval = null
  }
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer)
    state.silenceTimer = null
  }

  // 计算剩余时间
  const elapsed = Date.now() - silenceTimerStartTime
  silenceTimerRemaining = Math.max(0, silenceTimerRemaining - elapsed)

  // 通知前端暂停状态
  mainWindow.webContents.send('silence-timer-paused', {
    remaining: silenceTimerRemaining,
  })
}

// 创建 VAD 实例
function createVad() {
  const config = {
    sileroVad: {
      model: './models/vad/silero_vad.onnx',
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

  // 清空 ASR 识别结果
  asrService.clearASRResult()

  // 初始化 VAD
  const vadInstance = createVad()
  state.vad = vadInstance.vad
  state.vadBuffer = vadInstance.buffer
  state.isSpeechActive = false
  state.speechStartTime = null

  // 启动静音定时器：如果进入 ASR 模式后 SILENCE_TIMEOUT 秒内没有检测到任何语音，则退出 ASR
  startSilenceTimer(mainWindow)

  mainWindow.webContents.send('asr-started', { keyword: state.keywordCounts })

  // 发送状态更新：ASR 模式
  mainWindow.webContents.send('state-changed', {
    isRecording: true,
    asrMode: true,
  })
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
      // 语音开始，清除定时器（用户已经开始说话，不需要静音超时）
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer)
        state.silenceTimer = null
      }
      if (silenceTimerInterval) {
        clearInterval(silenceTimerInterval)
        silenceTimerInterval = null
      }
      // 语音开始
      state.isSpeechActive = true
      state.speechStartTime = Date.now()
      mainWindow.webContents.send('asr-status', {
        status: 'listening',
        message: '正在聆听...',
      })
      // 清空倒计时显示
      mainWindow.webContents.send('silence-timer-clear')
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
            // isForced = true，表示被截断，不触发 Chat
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

      const duration = segment.samples.length / vad.config.sampleRate
      console.log(`VAD: Speech segment ended, duration: ${duration}s`)

      // isForced = false，表示正常结束，会触发 Chat
      asrService.processSpeechSegment(mainWindow, segment.samples, false)

      // 语音段完成后，重启静音计时器
      startSilenceTimer(mainWindow)
    }
  }
}

// 完成 ASR，退出 ASR 模式（静音超时时调用）
async function finishASR(mainWindow) {
  if (!state.asrMode) return

  // 清除定时器
  if (state.silenceTimer) {
    clearTimeout(state.silenceTimer)
    state.silenceTimer = null
  }
  if (silenceTimerInterval) {
    clearInterval(silenceTimerInterval)
    silenceTimerInterval = null
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
        // 剩余语音段，isForced = true（属于清理，不触发 Chat）
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

  // 重新开始录音（包括重建 KWS 实例和音频输入设备）
  const kwsService = require('./kws-service')
  kwsService.restartRecording(mainWindow)

  console.log('ASR mode exited')
}

// 处理对话流程（由 asr-service 调用，异步执行，不阻塞 ASR）
function handleConversation(mainWindow, userText) {
  // 异步执行，不阻塞 ASR 继续监听
  processConversation(mainWindow, userText).catch(error => {
    console.error('Conversation error:', error)
    mainWindow.webContents.send('chat-error', { error: error.message })
  })
}

// 处理对话流程：Chat -> TTS -> 播放 -> 继续 VAD 模式等待用户输入
async function processConversation(mainWindow, userText) {
  try {
    state.isChatProcessing = true
    state.lastUserMessage = userText

    // 1. 停止音频输入，跳过所有数据
    state.skipAudioInput = true

    // 暂停静音计时器（Chat+TTS 期间不计时）
    pauseSilenceTimer(mainWindow)

    // 2. 发送对话开始事件
    mainWindow.webContents.send('chat-started', { userText })

    // 3. 调用大模型
    console.log('Calling Chat API with:', userText)
    const aiReply = await chatService.chatWithLLM(userText, state.conversationHistory)
    state.lastAIReply = aiReply

    // 更新对话历史
    state.conversationHistory = chatService.updateConversationHistory(
      state.conversationHistory,
      userText,
      aiReply
    )

    // 4. 发送模型回复事件
    mainWindow.webContents.send('chat-result', {
      userText,
      reply: aiReply
    })

    // 5. 调用 TTS
    mainWindow.webContents.send('tts-started')
    console.log('Calling TTS API for:', aiReply.substring(0, 50) + '...')

    const audioBuffer = await ttsService.synthesize(aiReply)

    // 6. 播放音频
    state.isTTSPlaying = true
    mainWindow.webContents.send('tts-playing')

    await audioPlayer.play(audioBuffer)

    state.isTTSPlaying = false
    mainWindow.webContents.send('tts-done')

    console.log('Conversation flow completed')

  } catch (error) {
    console.error('Conversation error:', error)
    mainWindow.webContents.send('chat-error', { error: error.message })
  } finally {
    state.isChatProcessing = false
    state.skipAudioInput = false

    // 清空 VAD 状态，确保可以检测新的语音
    state.isSpeechActive = false
    state.speechStartTime = null

    // 重新创建 VAD 实例（VAD 内部状态已 stale，必须重新创建）
    if (state.vad) {
      try { state.vad.free() } catch(e) {}
      state.vad = null
    }
    if (state.vadBuffer) {
      state.vadBuffer = null
    }
    const vadInstance = createVad()
    state.vad = vadInstance.vad
    state.vadBuffer = vadInstance.buffer

    // 清空识别结果，准备新的识别
    state.asrResult = ''
    asrService.clearASRResult()

    // 通知前端清空 ASR 显示
    mainWindow.webContents.send('asr-clear')

    // 7. 对话完成后，完全重启录音流程（重新创建 AudioIO 和 VAD），继续 VAD 模式
    console.log('Chat+TTS completed, restarting recording in ASR mode')
    restartRecordingInASRMode(mainWindow)
  }
}

// 在 ASR 模式下重新开始录音（Chat+TTS 完成后调用）
function restartRecordingInASRMode(mainWindow) {
  // 保存 ASR 相关状态
  const savedAsrMode = state.asrMode
  const savedSegmentId = state.segmentId
  const savedKeywordCounts = { ...state.keywordCounts }

  console.log('restartRecordingInASRMode: stopping and recreating audio devices...')

  // 停止并清理 VAD
  if (state.vad) {
    try { state.vad.free() } catch(e) {}
    state.vad = null
  }
  state.vadBuffer = null
  state.isSpeechActive = false
  state.speechStartTime = null

  // 停止并清理 KWS
  if (state.stream) {
    try { state.stream.free() } catch(e) {}
    state.stream = null
  }
  if (state.kws) {
    try { state.kws.free() } catch(e) {}
    state.kws = null
  }

  // 停止并清理 AudioIO
  if (state.ai) {
    try { state.ai.quit() } catch(e) {}
    state.ai = null
  }

  // 重置状态
  resetVadState()
  resetAsrState()
  resetKwsState()

  // 恢复 ASR 模式
  state.asrMode = true
  state.segmentId = savedSegmentId
  state.keywordCounts = savedKeywordCounts
  state.isRecording = true

  console.log('restartRecordingInASRMode: creating new AudioIO and VAD...')

  // 重新创建 KWS 实例
  const kwsService = require('./kws-service')
  const kwsInstance = kwsService.createKeywordSpotter()
  const stream = kwsInstance.createStream()
  state.kws = kwsInstance
  state.stream = stream

  // 重新创建 VAD 实例
  const vadInstance = createVad()
  state.vad = vadInstance.vad
  state.vadBuffer = vadInstance.buffer

  // 重新创建 AudioIO
  const portAudio = require('naudiodon2')
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
    if (state.skipAudioInput) return

    const samples = new Float32Array(data.buffer)

    if (state.asrMode) {
      processASRWithVAD(samples, mainWindow, asrService)
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

      vadService.startASR(mainWindow)
    }
  })

  ai.start()

  // 启动静音计时器
  startSilenceTimer(mainWindow)

  console.log('restartRecordingInASRMode: completed, ASR mode active')
}

// 播放指定文本的 TTS（用于播放按钮）
async function playTTS(mainWindow, text) {
  try {
    mainWindow.webContents.send('tts-play-started')

    const audioBuffer = await ttsService.synthesize(text)
    await audioPlayer.play(audioBuffer)

    mainWindow.webContents.send('tts-play-done')
  } catch (error) {
    console.error('TTS play error:', error)
    mainWindow.webContents.send('chat-error', { error: error.message })
  }
}

module.exports = {
  createVad,
  startASR,
  processASRWithVAD,
  finishASR,
  handleConversation,
  processConversation,
  playTTS,
}