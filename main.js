// 主入口文件
const { app, BrowserWindow } = require('electron/main')
const windowManager = require('./src/core/window-manager')
const { registerIPCHandlers } = require('./src/core/ipc-handlers')
const kwsService = require('./src/services/kws-service')

// 应用就绪
app.whenReady().then(() => {
  const mainWindow = windowManager.createWindow()

  // 注册 IPC 处理器
  registerIPCHandlers(mainWindow)

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
