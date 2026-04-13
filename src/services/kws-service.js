/**
 * @file kws-service.js
 * @description KWS（Keyword Spotting）服务 - 关键词唤醒服务
 * @module services/kws-service
 */

const sherpa_onnx = require('sherpa-onnx-node')
const { getConfig } = require('../config/constants')
const { state, resetAllState } = require('../utils/state-manager')
const vadService = require('./vad-service')
const asrService = require('./asr-service')
const { createAudioDataCallback, createAudioInput } = require('../audio/audio-utils')

// 获取配置（包含绝对路径）
const { KWS_CONFIG } = getConfig()

/**
 * 创建关键词检测器实例
 * @function createKeywordSpotter
 * @returns {Object} sherpa-onnx KeywordSpotter 实例
 */
function createKeywordSpotter() {
  const config = {
    featConfig: {
      sampleRate: KWS_CONFIG.SAMPLE_RATE,
      featureDim: KWS_CONFIG.FEATURE_DIM,
    },
    modelConfig: {
      transducer: {
        encoder: KWS_CONFIG.ENCODER,
        decoder: KWS_CONFIG.DECODER,
        joiner: KWS_CONFIG.JOINER,
      },
      tokens: KWS_CONFIG.TOKENS,
      numThreads: KWS_CONFIG.NUM_THREADS,
      provider: KWS_CONFIG.PROVIDER,
      debug: KWS_CONFIG.DEBUG,
    },
    keywordsFile: KWS_CONFIG.KEYWORDS,
  }

  return new sherpa_onnx.KeywordSpotter(config)
}

/**
 * 开始录音 - 初始化 KWS 实例并启动音频输入
 * @function startRecording
 * @param {BrowserWindow} mainWindow - Electron 主窗口实例
 */
function startRecording(mainWindow) {
  if (state.isRecording) return

  const kwsInstance = createKeywordSpotter()
  const stream = kwsInstance.createStream()

  state.kws = kwsInstance
  state.stream = stream
  state.keywordCounts = {}
  state.isRecording = true

  state.ai = createAudioInput()

  state.ai.on('data', createAudioDataCallback(mainWindow))

  state.ai.start()

  // 发送状态更新：KWS 模式
  mainWindow.webContents.send('state-changed', {
    isRecording: true,
    asrMode: false,
  })
}

/**
 * 停止录音 - 重置所有状态并释放资源
 * @function stopRecording
 * @param {BrowserWindow} mainWindow - Electron 主窗口实例
 */
function stopRecording(mainWindow) {
  // 如果正在 ASR 模式，先通知前端
  if (state.asrMode && mainWindow) {
    mainWindow.webContents.send('asr-stopped')
  }

  // 重置所有状态（包含资源释放）
  resetAllState()

  // 发送状态更新：已停止
  if (mainWindow) {
    mainWindow.webContents.send('state-changed', {
      isRecording: false,
      asrMode: false,
    })
  }
}

/**
 * 在 KWS 模式下重新开始录音（退出 ASR 后调用）
 * @function restartRecordingInKWSMode
 * @param {BrowserWindow} mainWindow - Electron 主窗口实例
 */
function restartRecordingInKWSMode(mainWindow) {
  console.log('Restarting recording...')

  // 保存关键词计数
  const savedKeywordCounts = { ...state.keywordCounts }

  // 清理所有音频资源
  state.asrMode = false

  resetAllState()

  // 重新开始录音
  state.isRecording = true
  state.keywordCounts = savedKeywordCounts

  const kwsInstance = createKeywordSpotter()
  const stream = kwsInstance.createStream()
  state.kws = kwsInstance
  state.stream = stream

  state.ai = createAudioInput()

  state.ai.on('data', createAudioDataCallback(mainWindow))

  state.ai.start()

  // 清空识别结果
  state.asrResult = ''
  asrService.clearASRResult()

  // 发送状态更新
  mainWindow.webContents.send('asr-done')
  mainWindow.webContents.send('state-changed', {
    isRecording: true,
    asrMode: false,
  })

  console.log('Recording restarted, ready for wake word')
}

module.exports = {
  createKeywordSpotter,
  startRecording,
  stopRecording,
  restartRecordingInKWSMode,
}
