// VAD 服务
const sherpa_onnx = require('sherpa-onnx-node')
const { VAD_CONFIG, PATHS } = require('../config/constants')
const { state, resetVadState } = require('../utils/state-manager')
const chatService = require('./chat-service')
const ttsService = require('./tts-service')
const audioPlayer = require('../audio/audio-player')

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

  // 清空 ASR 识别结果
  const asrService = require('./asr-service')
  asrService.clearASRResult()

  // 初始化 VAD
  const vadInstance = createVad()
  state.vad = vadInstance.vad
  state.vadBuffer = vadInstance.buffer
  state.isSpeechActive = false
  state.speechStartTime = null
  // 注意：不在此处设置定时器，而是在语音段结束时设置

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

      // 启动静音定时器，如果 VAD_CONFIG.SILENCE_TIMEOUT 秒内没有新语音则退出 ASR
      if (state.silenceTimer) {
        clearTimeout(state.silenceTimer)
      }
      state.silenceTimer = setTimeout(() => {
        console.log(`Silence too long, exiting ASR`)
        finishASR(mainWindow, asrService)
      }, VAD_CONFIG.SILENCE_TIMEOUT)

      const duration = segment.samples.length / vad.config.sampleRate
      console.log(`VAD: Speech segment ended, duration: ${duration}s`)

      // isForced = false，表示正常结束，会触发 Chat
      asrService.processSpeechSegment(mainWindow, segment.samples, false)
    }
  }
}

// 完成 ASR，退出 ASR 模式，返回 KWS 模式
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

  // 重新创建 KWS 实例（模拟停止再开始的逻辑）
  // if (state.kws) {
  //   // 释放旧的 KWS 实例和 stream
  //   if (state.stream) {
  //     try { state.stream.free() } catch(e) {}
  //   }
  //   try { state.kws.free() } catch(e) {}

  //   // 重新创建 KWS 实例
  //   const kwsService = require('./kws-service')
  //   const newKws = kwsService.createKeywordSpotter()
  //   state.kws = newKws
  //   state.stream = newKws.createStream()
  //   console.log('KWS instance recreated after ASR')
  // }

  
  // 清空识别结果
  state.asrResult = ''
  asrService.clearASRResult()

  // 发送 ASR 完成事件（退出 ASR 模式）
  mainWindow.webContents.send('asr-done')

  // 发送状态更新：返回 KWS 模式
  mainWindow.webContents.send('state-changed', {
    isRecording: true,
    asrMode: false,
  })

  console.log('ASR mode exited, returning to KWS mode')
}

// 处理对话流程（由 asr-service 调用，异步执行，不阻塞 ASR）
function handleConversation(mainWindow, userText) {
  // 异步执行，不阻塞 ASR 继续监听
  processConversation(mainWindow, userText).catch(error => {
    console.error('Conversation error:', error)
    mainWindow.webContents.send('chat-error', { error: error.message })
  })
}

// 处理对话流程：Chat -> TTS -> 播放（异步执行，ASR 模式继续）
async function processConversation(mainWindow, userText) {
  try {
    state.isChatProcessing = true
    state.lastUserMessage = userText

    // 1. 发送对话开始事件
    mainWindow.webContents.send('chat-started', { userText })

    // 2. 调用大模型
    console.log('Calling Chat API with:', userText)
    const aiReply = await chatService.chatWithLLM(userText, state.conversationHistory)
    state.lastAIReply = aiReply

    // 更新对话历史
    state.conversationHistory = chatService.updateConversationHistory(
      state.conversationHistory,
      userText,
      aiReply
    )

    // 3. 发送模型回复事件
    mainWindow.webContents.send('chat-result', {
      userText,
      reply: aiReply
    })

    // 4. 调用 TTS
    mainWindow.webContents.send('tts-started')
    console.log('Calling TTS API for:', aiReply.substring(0, 50) + '...')

    const audioBuffer = await ttsService.synthesize(aiReply)

    // 5. 播放音频
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

    // 检查是否有排队等待的用户输入
    if (state.pendingUserText) {
      const pendingText = state.pendingUserText
      state.pendingUserText = null
      console.log('Processing queued speech segment:', pendingText)
      // 延迟一小段时间再处理，让前端有时间更新状态
      setTimeout(() => {
        handleConversation(mainWindow, pendingText)
      }, 300)
    }
  }
  // 注意：不发送 asr-done，ASR 模式继续，直到 SILENCE_TIMEOUT 触发 finishASR
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