const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('fs')
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

  console.dir(ai)

  ai.on('data', data => {
    if (!isRecording) return

    const samples = new Float32Array(data.buffer)
    stream.acceptWaveform({
      sampleRate: kws.config.featConfig.sampleRate,
      samples: samples
    })

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

      // 发送到渲染进程
      mainWindow.webContents.send('keyword-detected', {
        keyword: keyword,
        count: keywordCounts[keyword],
        allCounts: keywordCounts
      })
    }
  })

  ai.start()
}

function stopRecording() {
  isRecording = false
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
    stopRecording()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopRecording()
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
