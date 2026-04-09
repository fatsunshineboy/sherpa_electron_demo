// IPC 处理器
const { ipcMain } = require('electron/main')
const { state,resetKwsState } = require('../utils/state-manager')
const kwsService = require('../services/kws-service')
const vadService = require('../services/vad-service')
const ttsService = require('../services/tts-service')
const windowManager = require('./window-manager')
const { getConfig } = require('../config/constants')

// 获取配置（包含绝对路径）
const { KWS_CONFIG } = getConfig()

const {
  generateKeywords,
  loadRawKeywords,
  saveRawKeywords,
  convertKeyword,
  loadEnPhone,
} = require('../../keywords-manager')

// 注册 IPC 处理器
function registerIPCHandlers(mainWindow) {
  // 处理开始录音请求
  ipcMain.on('start-recording', () => {
    kwsService.startRecording(mainWindow)
  })

  // 处理停止录音请求
  ipcMain.on('stop-recording', () => {
    kwsService.stopRecording(mainWindow)
  })

  // 处理 TTS 播放请求（播放按钮）
  ipcMain.on('play-tts', async (event, text) => {
    await vadService.playTTS(mainWindow, text)
  })

  // ========== TTS 模式切换 ==========

  // 获取当前 TTS 模式
  ipcMain.handle('get-tts-mode', () => {
    return ttsService.getMode()
  })

  // 切换 TTS 模式
  ipcMain.handle('toggle-tts-mode', () => {
    const newMode = ttsService.toggleMode()
    // 通知所有窗口模式已变更
    windowManager.broadcast('tts-mode-changed', { mode: newMode })
    return newMode
  })

  // ========== ASR 模式切换 ==========

  // 获取当前 ASR 模式
  ipcMain.handle('get-asr-mode', () => {
    const asrService = require('../services/asr-service')
    return asrService.getMode()
  })

  // 切换 ASR 模式
  ipcMain.handle('toggle-asr-mode', () => {
    const asrService = require('../services/asr-service')
    const newMode = asrService.toggleMode()
    // 通知所有窗口模式已变更
    windowManager.broadcast('asr-mode-changed', { mode: newMode })
    return newMode
  })

  // 设置 ASR 模式
  ipcMain.handle('set-asr-mode', (event, mode) => {
    const asrService = require('../services/asr-service')
    const newMode = asrService.setMode(mode)
    windowManager.broadcast('asr-mode-changed', { mode: newMode })
    return newMode
  })

  // ========== 关键词管理 IPC 处理 ==========

  // 获取原始关键词列表
  ipcMain.handle('get-keywords', () => {
    return loadRawKeywords(KWS_CONFIG.RAW_KEYWORDS)
  })

  // 保存原始关键词列表
  ipcMain.handle('save-keywords', (event, keywords) => {
    try {
      const content = keywords.join('\n') + '\n'
      saveRawKeywords(KWS_CONFIG.RAW_KEYWORDS, content)
      return { success: true }
    } catch (err) {
      throw new Error(err.message)
    }
  })

  // 预览关键词转换（不保存文件）
  ipcMain.handle('preview-keywords', (event, keywords) => {
    try {
      const enPhoneDict = loadEnPhone(KWS_CONFIG.EN_PHONE)
      const result = keywords.map(keyword => {
        const phones = convertKeyword(keyword, enPhoneDict)
        return {
          original: keyword,
          phones: phones,
        }
      })
      return result
    } catch (err) {
      throw new Error(err.message)
    }
  })

  // 生成 keywords.txt 文件
  ipcMain.handle('generate-keywords-file', async () => {
    try {
      const count = generateKeywords(
        KWS_CONFIG.RAW_KEYWORDS,
        KWS_CONFIG.KEYWORDS,
        KWS_CONFIG.EN_PHONE
      )

      // 如果正在录音，停止并清理资源
      if (state.isRecording) {
        kwsService.stopRecording(mainWindow)
      }

      // 清理 KWS 实例，强制下次录音时重新创建
      resetKwsState()

      // 通知所有窗口关键词已更新
      windowManager.broadcast('keywords-updated', { count })

      return { success: true, count }
    } catch (err) {
      throw new Error(err.message)
    }
  })
}

module.exports = {
  registerIPCHandlers,
}
