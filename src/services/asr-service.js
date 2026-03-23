// ASR 服务
const FormData = require('form-data')
const fetch = require('node-fetch')
const { API_CONFIG } = require('../config/constants')
const { state } = require('../utils/state-manager')
const { createWavBuffer } = require('../audio/audio-utils')
const windowManager = require('../core/window-manager')

// 处理语音段并发送给 API
async function processSpeechSegment(mainWindow, samples, isForced) {
  console.log("asr api is called");
  
  if (!samples || samples.length === 0) return

  // 转换为 WAV 格式
  const wavBuffer = createWavBuffer(samples, 16000)

  // 递增 segmentId
  state.incrementSegmentId()
  const currentSegmentId = state.segmentId

  mainWindow.webContents.send('asr-processing')

  try {
    await callASRAPIStreaming(wavBuffer, mainWindow, currentSegmentId)
  } catch (err) {
    console.error('ASR error:', err)
    mainWindow.webContents.send('asr-error', { error: err.message })
  }
}

// 流式调用 ASR API
async function callASRAPIStreaming(audioData, mainWindow, segmentId, isFinal = false) {
  const formData = new FormData()
  formData.append('model', API_CONFIG.MODEL)
  formData.append('stream', 'true')

  formData.append('file', audioData, {
    filename: 'segment.wav',
    contentType: 'audio/wav',
  })

  const response = await fetch(API_CONFIG.URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_CONFIG.KEY}`,
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
              mainWindow.webContents.send('asr-stream', {
                text: parsed.text || parsed.delta,
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

// 非流式调用 ASR API（备用）
async function callASRAPI(audioData) {
  const formData = new FormData()
  formData.append('model', API_CONFIG.MODEL)
  formData.append('stream', 'false')

  formData.append('file', audioData, {
    filename: 'recording.wav',
    contentType: 'audio/wav',
  })

  const response = await fetch(API_CONFIG.URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_CONFIG.KEY}`,
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
}
