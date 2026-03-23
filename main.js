const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('fs')
const FormData = require('form-data')
const fetch = require('node-fetch')
const { generateKeywords, loadRawKeywords, saveRawKeywords, convertKeyword, loadEnPhone } = require('./keywords-manager')

// 文件路径
const RAW_KEYWORDS_FILE = './keywords_raw.txt'
const KEYWORDS_FILE = './models/keywords.txt'
const EN_PHONE_FILE = './models/en.phone'

// KWS 相关变量
let kws = null
let stream = null
let ai = null
let keywordCounts = {}
let isRecording = false

// ASR 相关变量
let asrMode = false
let asrResult = ''
let segmentId = 0  // 当前segment标识，用于区分不同识别段
const API_KEY = process.env.ZHIPU_API_KEY || 'your-api-key'

// VAD 相关变量
let vad = null
let vadBuffer = null  // CircularBuffer for VAD
let isSpeechActive = false  // 是否正在说话
let speechStartTime = null  // 语音开始时间
const MIN_SPEECH_DURATION = 0.25  // 最小语音持续时间250ms
const MIN_SILENCE_DURATION = 0.5  // 静音超过500ms认为语音结束
const MAX_SPEECH_DURATION = 25  // 最大语音持续时间25秒（接口限制30秒，留5秒余量）
const VAD_WINDOW_SIZE = 512  // VAD窗口大小

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  })

  win.loadFile('index.html')

  // 打开开发者工具
  win.webContents.openDevTools();
  return win
}



function createVad() {
  const sherpa_onnx = require('sherpa-onnx-node')

  const config = {
    sileroVad: {
      model: './models/silero_vad.onnx',
      threshold: 0.5,
      minSpeechDuration: MIN_SPEECH_DURATION,   // 最小语音持续时间250ms
      minSilenceDuration: MIN_SILENCE_DURATION,   // 静音超过500ms认为语音结束
      windowSize: VAD_WINDOW_SIZE,
    },
    sampleRate: 16000,
    debug: false,
    numThreads: 1,
  }

  // 创建足够大的缓冲区（60秒）
  const vadInstance = new sherpa_onnx.Vad(config, 60)

  // 创建循环缓冲区用于存储音频
  const bufferSizeInSeconds = 60
  const circularBuffer = new sherpa_onnx.CircularBuffer(bufferSizeInSeconds * config.sampleRate)

  return { vad: vadInstance, buffer: circularBuffer, config }
}

function createKeywordSpotter() {
  const sherpa_onnx = require('sherpa-onnx-node')

  const config = {
    'featConfig': {
      'sampleRate': 16000,
      'featureDim': 80,
    },
    'modelConfig': {
      'transducer': {
        'encoder': './models/encoder.onnx',
        'decoder': './models/decoder.onnx',
        'joiner': './models/joiner.onnx',
      },
      'tokens': './models/tokens.txt',
      'numThreads': 2,
      'provider': 'cpu',
      'debug': 1,
    },
    'keywordsFile': './models/keywords.txt',
  }

  return new sherpa_onnx.KeywordSpotter(config)
}

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

function startRecording(mainWindow) {
  if (isRecording) return

  const portAudio = require('naudiodon2')
  const sherpa_onnx = require('sherpa-onnx-node')

  kws = createKeywordSpotter()
  stream = kws.createStream()
  keywordCounts = {}
  isRecording = true

  ai = new portAudio.AudioIO({
    inOptions: {
      channelCount: 1,
      closeOnError: true,
      deviceId: -1,
      sampleFormat: portAudio.SampleFormatFloat32,
      sampleRate: kws.config.featConfig.sampleRate
    }
  })

  ai.on('data', data => {
    if (!isRecording) return

    const samples = new Float32Array(data.buffer)
    stream.acceptWaveform({
      sampleRate: kws.config.featConfig.sampleRate,
      samples: samples
    })

    // ASR 模式：使用VAD检测语音开始和结束
    if (asrMode) {
      processASRWithVAD(samples, mainWindow)
      return
    }

    // KWS 模式：检测唤醒词
    while (kws.isReady(stream)) {
      kws.decode(stream)
    }

    const keyword = kws.getResult(stream).keyword
    if (keyword !== '') {
      // 更新计数
      if (!keywordCounts[keyword]) {
        keywordCounts[keyword] = 0
      }
      keywordCounts[keyword]++

      // 发送关键词检测到的事件（用于显示唤醒记录）
      mainWindow.webContents.send('keyword-detected', {
        keyword: keyword,
        count: keywordCounts[keyword],
        allCounts: keywordCounts
      })

      // 切换到 ASR 模式
      startASR(mainWindow, keyword)
    }
  })

  ai.start()
}

function startASR(mainWindow, keyword) {
  asrMode = true
  asrResult = ''
  segmentId = 0  // 重置segment计数

  // 初始化VAD
  const vadInstance = createVad()
  vad = vadInstance.vad
  vadBuffer = vadInstance.buffer
  isSpeechActive = false
  speechStartTime = null

  mainWindow.webContents.send('asr-started', { keyword })
}

// 使用VAD处理ASR音频
function processASRWithVAD(samples, mainWindow) {
  if (!vad || !vadBuffer) return

  const windowSize = vad.config.sileroVad.windowSize

  // 将样本推入循环缓冲区
  vadBuffer.push(new Float32Array(samples))

  // 处理缓冲区中的音频
  while (vadBuffer.size() > windowSize) {
    const windowSamples = vadBuffer.get(vadBuffer.head(), windowSize)
    vadBuffer.pop(windowSize)

    // 将音频送入VAD
    vad.acceptWaveform(windowSamples)

    // 检查是否检测到语音
    const detected = vad.isDetected()

    if (detected && !isSpeechActive) {
      // 语音开始
      isSpeechActive = true
      speechStartTime = Date.now()
      mainWindow.webContents.send('asr-status', { status: 'listening', message: '正在聆听...' })
    }

    // 检查是否超过最大持续时间
    if (isSpeechActive && speechStartTime) {
      const currentDuration = (Date.now() - speechStartTime) / 1000
      if (currentDuration >= MAX_SPEECH_DURATION) {
        // 强制截断：清空VAD缓冲区获取当前积累的所有语音
        console.log(`Speech duration ${currentDuration}s exceeds limit, forcing send`)

        // 从VAD中获取当前积累的语音段
        const segments = []
        while (!vad.isEmpty()) {
          segments.push(vad.front())
          vad.pop()
        }

        if (segments.length > 0) {
          // 合并所有段
          const totalSamples = segments.reduce((sum, seg) => sum + seg.samples.length, 0)
          const mergedSamples = new Float32Array(totalSamples)
          let offset = 0
          for (const seg of segments) {
            mergedSamples.set(seg.samples, offset)
            offset += seg.samples.length
          }
          processSpeechSegment(mainWindow, mergedSamples, true)
        }

        isSpeechActive = false
        speechStartTime = null
        continue
      }
    }

    // 检查是否有完成的语音段（语音结束）
    while (!vad.isEmpty()) {
      const segment = vad.front()
      vad.pop()

      // 语音结束
      isSpeechActive = false
      speechStartTime = null

      const duration = segment.samples.length / vad.config.sampleRate
      console.log(`VAD: Speech segment ended, duration: ${duration}s`)

      // 发送这段语音进行识别
      processSpeechSegment(mainWindow, segment.samples, false)
    }
  }
}

// 处理语音段并发送给API
async function processSpeechSegment(mainWindow, samples, isForced) {
  if (!samples || samples.length === 0) return

  // 转换为 WAV 格式
  const wavBuffer = createWavBuffer(samples, 16000)

  // 递增segmentId
  const currentSegmentId = ++segmentId

  mainWindow.webContents.send('asr-processing')

  try {
    await callASRAPIStreaming(wavBuffer, mainWindow, currentSegmentId)
  } catch (err) {
    console.error('ASR error:', err)
    mainWindow.webContents.send('asr-error', { error: err.message })
  }
}

async function finishASR(mainWindow) {
  // 如果已经不在ASR模式，直接返回（避免重复调用）
  if (!asrMode) return

  asrMode = false

  // 处理VAD中剩余的语音段
  if (vad) {
    const segments = []
    while (!vad.isEmpty()) {
      segments.push(vad.front())
      vad.pop()
    }

    if (segments.length > 0) {
      // 合并所有段
      const totalSamples = segments.reduce((sum, seg) => sum + seg.samples.length, 0)
      const mergedSamples = new Float32Array(totalSamples)
      let offset = 0
      for (const seg of segments) {
        mergedSamples.set(seg.samples, offset)
        offset += seg.samples.length
      }
      await processSpeechSegment(mainWindow, mergedSamples, true)
    }

    // 释放VAD资源
    try { vad.free() } catch(e) {}
    vad = null
  }

  vadBuffer = null
  isSpeechActive = false
  speechStartTime = null

  mainWindow.webContents.send('asr-done')
}

async function callASRAPIStreaming(audioData, mainWindow, segmentId, isFinal = false) {
  const formData = new FormData()
  formData.append('model', 'glm-asr-2512')
  formData.append('stream', 'true')

  // 使用 Buffer 而不是 Blob
  formData.append('file', audioData, {
    filename: 'segment.wav',
    contentType: 'audio/wav'
  })

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  // 流式读取响应 - 使用 Node.js stream
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
                segmentId: segmentId,  // 传递segmentId给前端
                isFinal: isFinal
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

// 保留旧函数作为备用（非流式）
async function callASRAPI(audioData) {
  const formData = new FormData()
  formData.append('model', 'glm-asr-2512')
  formData.append('stream', 'false')

  // 使用 Buffer 而不是 Blob
  formData.append('file', audioData, {
    filename: 'recording.wav',
    contentType: 'audio/wav'
  })

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  return data.text || data.result || JSON.stringify(data)
}

function stopRecording(mainWindow) {
  // 如果正在ASR模式，先通知前端停止
  if (asrMode && mainWindow) {
    mainWindow.webContents.send('asr-stopped')
  }

  isRecording = false
  asrMode = false

  // 释放VAD资源
  if (vad) {
    try { vad.free() } catch(e) {}
    vad = null
  }
  vadBuffer = null
  isSpeechActive = false
  speechStartTime = null

  if (ai) {
    ai.quit()
    ai = null
  }
  if (stream) {
    try {
      stream.free()
    } catch(e) {}
    stream = null
  }
  if (kws) {
    try {
      kws.free()
    } catch(e) {}
    kws = null
  }
}

app.whenReady().then(() => {
  const mainWindow = createWindow()

  // 处理开始录音请求
  ipcMain.on('start-recording', () => {
    startRecording(mainWindow)
  })

  // 处理停止录音请求
  ipcMain.on('stop-recording', () => {
    stopRecording(mainWindow)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopRecording(null)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ========== 关键词管理 IPC 处理 ==========

// 获取原始关键词列表
ipcMain.handle('get-keywords', () => {
  return loadRawKeywords(RAW_KEYWORDS_FILE)
})

// 保存原始关键词列表
ipcMain.handle('save-keywords', (event, keywords) => {
  try {
    const content = keywords.join('\n') + '\n'
    saveRawKeywords(RAW_KEYWORDS_FILE, content)
    return { success: true }
  } catch (err) {
    throw new Error(err.message)
  }
})

// 预览关键词转换（不保存文件）
ipcMain.handle('preview-keywords', (event, keywords) => {
  try {
    const enPhoneDict = loadEnPhone(EN_PHONE_FILE)
    const result = keywords.map(keyword => {
      const phones = convertKeyword(keyword, enPhoneDict)
      return {
        original: keyword,
        phones: phones
      }
    })
    return result
  } catch (err) {
    throw new Error(err.message)
  }
})

// 生成 keywords.txt 文件
ipcMain.handle('generate-keywords-file', async (event) => {
  try {
    const count = generateKeywords(RAW_KEYWORDS_FILE, KEYWORDS_FILE, EN_PHONE_FILE)

    // 如果正在录音，停止并清理资源
    if (isRecording) {
      stopRecording()
    }

    // 清理 KWS 实例，强制下次录音时重新创建
    if (kws) {
      try { kws.free() } catch(e) {}
      kws = null
    }
    if (stream) {
      try { stream.free() } catch(e) {}
      stream = null
    }

    // 通知所有窗口关键词已更新
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('keywords-updated', { count })
    })

    return { success: true, count }
  } catch (err) {
    throw new Error(err.message)
  }
})
