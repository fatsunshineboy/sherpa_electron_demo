// Electron 路径工具 - 区分开发/打包环境获取资源路径
const path = require('path')

let appRoot = null

function initAppRoot() {
  const { app } = require('electron')
  
  // ==============================================
  // 判断：开发 / 生产（打包）
  // ==============================================
  const isDevelopment = !app.isPackaged
  const isProduction = app.isPackaged

  console.log('【环境判断】', isDevelopment ? '开发环境' : '生产环境')
  console.log('app.isPackaged =', app.isPackaged)

  if (isDevelopment) {
    // 开发环境：直接指向项目根目录
    appRoot = path.resolve(__dirname, '..', '..')
    console.log('开发环境根目录：', appRoot)
  } else {
    // 打包环境：exe 所在目录/resources/app
    const exePath = app.getPath('exe')
    const exeDir = path.dirname(exePath)
    appRoot = path.join(exeDir, 'resources', 'app')
    console.log('生产环境根目录：', appRoot)
  }

  return appRoot
}

function getAppRoot() {
  if (!appRoot) {
    try {
      return initAppRoot()
    } catch (e) {
      appRoot = path.resolve(__dirname, '..')
    }
  }
  return appRoot
}

function getModelPath(subPath) {
  return path.join(getAppRoot(), 'models', subPath)
}

function getResourcePath(subPath) {
  return path.join(getAppRoot(), subPath)
}

function isPackaged() {
  const { app } = require('electron')
  return app.isPackaged
}

module.exports = {
  initAppRoot,
  getAppRoot,
  getModelPath,
  getResourcePath,
  isPackaged,
}