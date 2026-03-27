// ASR 服务
const FormData = require('form-data')
const fetch = require('node-fetch')
const { ASR_CONFIG } = require('../config/constants')
const { state } = require('../utils/state-manager')
const { createWavBuffer } = require('../audio/audio-utils')
const windowManager = require('../core/window-manager')

// 存储每个 segment 的识别结果
const segmentResults = {}

// 处理语音段并发送给 API
async function processSpeechSegment(mainWindow, samples, isForced) {
  console.log("asr api is called, isForced:", isForced)

  if (!samples || samples.length === 0) return

  // 转换为 WAV 格式
  const wavBuffer = createWavBuffer(samples, 16000)

  // 递增 segmentId
  state.incrementSegmentId()
  const currentSegmentId = state.segmentId

  // 初始化该 segment 的结果
  segmentResults[currentSegmentId] = ''

  mainWindow.webContents.send('asr-processing')

  try {
    await callASRAPIStreaming(wavBuffer, mainWindow, currentSegmentId)

    // ASR 完成后，判断是否触发 Chat
    // isForced = false 表示正常结束（VAD 检测到语音结束）
    // isForced = true 表示被截断（超过最大时长）
    if (!isForced) {
      const recognizedText = state.asrResult.trim()
      if (recognizedText) {
        // 检查是否正在处理对话
        if (state.isChatProcessing) {
          console.log('Chat is processing, queuing new speech segment:', recognizedText)
          state.pendingUserText = recognizedText
          // 通知前端有排队等待的消息
          mainWindow.webContents.send('chat-queued', { text: recognizedText })
        } else {
          console.log('Speech segment completed normally, triggering Chat')
          // 通知 vad-service 处理对话
          const vadService = require('./vad-service')
          vadService.handleConversation(mainWindow, recognizedText)
        }
        // 清空识别结果，准备下一段
        state.asrResult = ''
        clearASRResult()
      }
    } else {
      console.log('Speech segment was forced (truncated), waiting for more speech')
      // 被截断时只累积文本，不触发 Chat，等待用户继续说
    }
  } catch (err) {
    console.error('ASR error:', err)
    mainWindow.webContents.send('asr-error', { error: err.message })
  }
}

// 流式调用 ASR API
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

  // 流式读取响应
  return new Promise((resolve, reject) => {
    const decoder = new TextDecoder()
    let buffer = ''

    response.body.on('data', (chunk) => {
      buffer += decoder.decode(chunk, { stream: true })

      // 按行分割处理 SSE 格式
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

              // 存储该 segment 的最新结果（流式返回的是当前 segment 的完整结果）
              segmentResults[segmentId] = text

              // 更新全局状态中的完整识别结果
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
  // 按 segmentId 顺序合并结果
  const sortedIds = Object.keys(segmentResults).sort((a, b) => a - b)
  for (const id of sortedIds) {
    fullText += segmentResults[id]
  }
  state.asrResult = fullText
}

// 清空识别结果（开始新的识别时调用）
function clearASRResult() {
  Object.keys(segmentResults).forEach(key => delete segmentResults[key])
}

// 非流式调用 ASR API（备用）
async function callASRAPI(audioData) {
  const formData = new FormData()
  formData.append('model', ASR_CONFIG.MODEL)
  formData.append('stream', 'false')

  formData.append('file', audioData, {
    filename: 'recording.wav',
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

  const data = await response.json()
  return data.text || data.result || JSON.stringify(data)
}

module.exports = {
  processSpeechSegment,
  callASRAPIStreaming,
  callASRAPI,
  clearASRResult,
}