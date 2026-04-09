// 主入口文件
const { app, BrowserWindow } = require('electron/main')
const windowManager = require('./src/core/window-manager')
const { registerIPCHandlers } = require('./src/core/ipc-handlers')
const kwsService = require('./src/services/kws-service')
const asrService = require('./src/services/asr-service')
const pathUtils = require('./src/utils/path-utils')

// 应用就绪
app.whenReady().then(() => {
  // 初始化路径工具（必须在最前面，确保其他模块能获取正确路径）
  pathUtils.initAppRoot()

  const mainWindow = windowManager.createWindow()

  // 注册 IPC 处理器
  registerIPCHandlers(mainWindow)

  // 预初始化本地 ASR 模型（避免录音时加载延迟，同时避免与 KWS 资源竞争）
  if (asrService.getMode() === 'local') {
    console.log('Pre-initializing local ASR model on app ready')
    asrService.initLocalRecognizer()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow()
    }
  })
})

// 所有窗口关闭时
app.on('window-all-closed', () => {
  // 清理资源
  kwsService.stopRecording(null)

  // 非 macOS 平台退出应用
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
