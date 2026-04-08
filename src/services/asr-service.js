// ASR 服务
const FormData = require('form-data')
const fetch = require('node-fetch')
const sherpa_onnx = require('sherpa-onnx-node')
const { ASR_CONFIG, LOCAL_ASR_CONFIG } = require('../config/constants')
const { state } = require('../utils/state-manager')
const { createWavBuffer } = require('../audio/audio-utils')
const windowManager = require('../core/window-manager')

// 存储每个 segment 的识别结果
const segmentResults = {}

// ========== ASR 模式管理 ==========

// ASR 模式：'local' 或 'api'
let asrMode = 'local'  // 默认使用本地模式

// 本地 ASR 识别器实例（单例）
let localRecognizer = null

// 获取当前模式
function getMode() {
  return asrMode
}

// 切换模式
function toggleMode() {
  asrMode = asrMode === 'api' ? 'local' : 'api'
  return asrMode
}

// 设置模式
function setMode(mode) {
  asrMode = mode
  return asrMode
}

// ========== 本地 ASR 初始化 ==========

function initLocalRecognizer() {
  if (localRecognizer) return localRecognizer

  const config = {
    'featConfig': {
      'sampleRate': LOCAL_ASR_CONFIG.SAMPLE_RATE,
      'featureDim': LOCAL_ASR_CONFIG.FEATURE_DIM,
    },
    'modelConfig': {
      'qwen3Asr': {
        'convFrontend': LOCAL_ASR_CONFIG.CONV_FRONTEND,
        'encoder': LOCAL_ASR_CONFIG.ENCODER,
        'decoder': LOCAL_ASR_CONFIG.DECODER,
        'tokenizer': LOCAL_ASR_CONFIG.TOKENIZER,
        'hotwords': '',
      },
      'tokens': '',
      'numThreads': 2,
      'provider': 'cpu',
      'debug': 1,
    }
  }

  localRecognizer = new sherpa_onnx.OfflineRecognizer(config)
  return localRecognizer
}

// ========== 语音处理主逻辑 ==========

// 处理语音段并发送给 API 或本地模型
async function processSpeechSegment(mainWindow, samples, isForced) {
  console.log("ASR processSpeechSegment called, mode:", asrMode, ", isForced:", isForced)

  if (!samples || samples.length === 0) return

  // 转换为 WAV 格式（仅 API 模式需要）
  const wavBuffer = createWavBuffer(samples, 16000)

  // 递增 segmentId
  state.incrementSegmentId()
  const currentSegmentId = state.segmentId

  // 初始化该 segment 的结果
  segmentResults[currentSegmentId] = ''

  mainWindow.webContents.send('asr-processing')

  try {
    if (asrMode === 'local') {
      // 本地模式：使用 sherpa-onnx OfflineRecognizer 识别（自带标点）
      await processSpeechSegmentLocal(mainWindow, samples, currentSegmentId, isForced)
    } else {
      // API 模式：使用远程 API
      await callASRAPIStreaming(wavBuffer, mainWindow, currentSegmentId)

      // ASR 完成后，判断是否触发 Chat
      if (!isForced) {
        const recognizedText = state.asrResult.trim()
        if (recognizedText) {
          if (state.isChatProcessing) {
            console.log('Chat is processing, queuing new speech segment:', recognizedText)
            state.pendingUserText = recognizedText
            mainWindow.webContents.send('chat-queued', { text: recognizedText })
          } else {
            console.log('Speech segment completed normally, triggering Chat')
            const vadService = require('./vad-service')
            vadService.handleConversation(mainWindow, recognizedText)
          }
          state.asrResult = ''
          clearASRResult()
        }
      } else {
        console.log('Speech segment was forced (truncated), waiting for more speech')
      }
    }
  } catch (err) {
    console.error('ASR error:', err)
    mainWindow.webContents.send('asr-error', { error: err.message })
  }
}

// 本地 ASR 处理（sherpa-onnx OfflineRecognizer）
async function processSpeechSegmentLocal(mainWindow, samples, segmentId, isForced) {
  const recognizer = initLocalRecognizer()
  const stream = recognizer.createStream()

  // 送入音频数据进行识别
  stream.acceptWaveform({
    sampleRate: LOCAL_ASR_CONFIG.SAMPLE_RATE,
    samples: samples
  })

  // 解码（OfflineRecognizer 直接 decode 一次即可）
  recognizer.decode(stream)

  // 获取识别结果
  const result = recognizer.getResult(stream)
  const text = result.text

  // 清理流资源
  try { stream.free() } catch(e) {}

  if (!text || text.trim() === '') {
    console.log('Local ASR: no text recognized')
    return
  }

  console.log('Local ASR result:', text)

  // 模型自带标点，直接发送最终结果
  segmentResults[segmentId] = text
  updateASRResult()

  mainWindow.webContents.send('asr-stream', {
    text: text,
    segmentId: segmentId,
    isFinal: true,
  })

  // 处理后续逻辑
  if (!isForced) {
    if (text.trim()) {
      if (state.isChatProcessing) {
        console.log('Chat is processing, queuing new speech segment:', text)
        state.pendingUserText = text
        mainWindow.webContents.send('chat-queued', { text: text })
      } else {
        console.log('Speech segment completed normally, triggering Chat')
        const vadService = require('./vad-service')
        vadService.handleConversation(mainWindow, text)
      }
      state.asrResult = ''
      clearASRResult()
    }
  } else {
    console.log('Speech segment was forced (truncated), waiting for more speech')
  }

  return text
}

// 流式调用 ASR API（保持不变）
async function callASRAPIStreaming(audioData, mainWindow, segmentId, isFinal = false) {
  const formData = new FormData()
  formData.append('model', ASR_CONFIG.MODEL)
  formData.append('stream', 'true')

  formData.append('file', audioData, {
    filename: 'segment.wav',
    contentType: 'audio/wav',
  })

  const response = await fetch(ASR_CONFIG.URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ASR_CONFIG.KEY}`,
      ...formData.getHeaders(),
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder()
    let buffer = ''

    response.body.on('data', (chunk) => {
      buffer += decoder.decode(chunk, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)

          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.text || parsed.delta) {
              const text = parsed.text || parsed.delta

              segmentResults[segmentId] = text
              updateASRResult()

              mainWindow.webContents.send('asr-stream', {
                text: text,
                segmentId: segmentId,
                isFinal: isFinal,
              })
            }
          } catch (e) {
            // 解析失败，忽略
          }
        }
      }
    })

    response.body.on('end', resolve)
    response.body.on('error', reject)
  })
}

// 更新完整的 ASR 识别结果
function updateASRResult() {
  let fullText = ''
  const sortedIds = Object.keys(segmentResults).sort((a, b) => a - b)
  for (const id of sortedIds) {
    fullText += segmentResults[id]
  }
  state.asrResult = fullText
}

// 清空识别结果
function clearASRResult() {
  Object.keys(segmentResults).forEach(key => delete segmentResults[key])
}

// ========== 资源清理 ==========

// 清理本地模型实例（在应用退出时调用）
function cleanup() {
  if (localRecognizer) {
    try { localRecognizer.free() } catch(e) {}
    localRecognizer = null
  }
}

module.exports = {
  processSpeechSegment,
  callASRAPIStreaming,
  clearASRResult,
  getMode,
  setMode,
  toggleMode,
  cleanup,
  initLocalRecognizer,
}
