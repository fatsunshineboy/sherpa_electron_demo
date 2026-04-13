/**
 * @file window-manager.js
 * @description Electron 窗口管理模块 - 负责创建和管理应用主窗口
 */

const { BrowserWindow } = require('electron/main')
const path = require('node:path')

/**
 * 窗口管理器对象
 * @namespace windowManager
 */
const windowManager = {
  /** @type {BrowserWindow|null} 主窗口实例 */
  mainWindow: null,

  /**
   * 创建并初始化主窗口
   * @returns {BrowserWindow} 创建的窗口实例
   */
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

  /**
   * 获取主窗口实例
   * @returns {BrowserWindow|null} 主窗口实例，未创建时返回 null
   */
  getMainWindow() {
    return this.mainWindow
  },

  /**
   * 向所有打开的窗口发送 IPC 消息
   * @param {string} channel - IPC 通道名称
   * @param {...any} args - 要传递的参数
   */
  broadcast(channel, ...args) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(channel, ...args)
    })
  },
}

module.exports = windowManager
