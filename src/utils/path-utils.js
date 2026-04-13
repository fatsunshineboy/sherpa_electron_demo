/**
 * @file path-utils.js
 * @description Electron 路径工具 - 区分开发/打包环境获取资源路径
 * @module utils/path-utils
 */

// Electron 路径工具 - 区分开发/打包环境获取资源路径
const path = require('path')

let appRoot = null

/**
 * 初始化应用根目录路径（根据开发/生产环境）
 * @function initAppRoot
 * @returns {string} 应用根目录的绝对路径
 */
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

/**
 * 获取应用根目录路径（自动初始化）
 * @function getAppRoot
 * @returns {string} 应用根目录的绝对路径
 */
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

/**
 * 获取模型文件的完整路径
 * @function getModelPath
 * @param {string} subPath - 相对于 models 目录的子路径
 * @returns {string} 模型文件的完整路径
 */
function getModelPath(subPath) {
  return path.join(getAppRoot(), 'models', subPath)
}

/**
 * 获取资源文件的完整路径
 * @function getResourcePath
 * @param {string} subPath - 相对于应用根目录的子路径
 * @returns {string} 资源文件的完整路径
 */
function getResourcePath(subPath) {
  return path.join(getAppRoot(), subPath)
}

/**
 * 检查应用是否处于打包状态
 * @function isPackaged
 * @returns {boolean} 是否为打包后的生产环境
 */
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