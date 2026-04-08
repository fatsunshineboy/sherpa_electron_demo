// 窗口管理
const { BrowserWindow } = require('electron/main')
const path = require('node:path')

const windowManager = {
  mainWindow: null,

  // 创建主窗口
  createWindow() {
    const win = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 700,
      minHeight: 500,
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
      titleBarStyle: 'default',
      show: false, // 先不显示，等加载完成后再显示
    })

    win.loadFile('index.html')

    // 加载完成后显示窗口并打开开发者工具
    win.once('ready-to-show', () => {
      win.show()
      // win.webContents.openDevTools()
    })

    this.mainWindow = win
    return win
  },

  // 获取主窗口
  getMainWindow() {
    return this.mainWindow
  },

  // 向所有窗口发送消息
  broadcast(channel, ...args) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(channel, ...args)
    })
  },
}

module.exports = windowManager
