// 静音计时器模块
// 管理 ASR 模式下的静音超时和倒计时显示

const { VAD_CONFIG } = require('../config/constants')

// ========== 内部状态 ==========
let silenceTimerRemaining = VAD_CONFIG.SILENCE_TIMEOUT
let silenceTimerStartTime = null
let silenceTimerInterval = null
let onTimeoutCallback = null

// ========== 内部函数 ==========

// 启动倒计时更新定时器（每 100ms 通知前端）
function startUpdateTimer(mainWindow) {
  clearUpdateTimer()
  silenceTimerStartTime = Date.now()
  silenceTimerInterval = setInterval(() => {
    const elapsed = Date.now() - silenceTimerStartTime
    const remaining = Math.max(0, silenceTimerRemaining - elapsed)
    mainWindow.webContents.send('silence-timer-update', {
      remaining: remaining,
      total: VAD_CONFIG.SILENCE_TIMEOUT,
    })
  }, 100)
}

// 清除倒计时更新定时器
function clearUpdateTimer() {
  if (silenceTimerInterval) {
    clearInterval(silenceTimerInterval)
    silenceTimerInterval = null
  }
}

// ========== 核心 API ==========

/**
 * 启动静音计时器
 * SILENCE_TIMEOUT 秒内没有新语音则退出 ASR 回到 KWS 模式
 * @param {BrowserWindow} mainWindow
 * @param {Function} onTimeout - 超时回调函数
 */
function start(mainWindow, onTimeout) {
  // 清除现有的计时器
  if (silenceTimerInterval) {
    clearUpdateTimer()
  }

  // 清除现有的退出计时器
  if (global.silenceExitTimer) {
    clearTimeout(global.silenceExitTimer)
    global.silenceExitTimer = null
  }

  // 重置剩余时间
  silenceTimerRemaining = VAD_CONFIG.SILENCE_TIMEOUT

  // 保存超时回调
  onTimeoutCallback = onTimeout

  // 启动实际退出计时器
  global.silenceExitTimer = setTimeout(() => {
    console.log('Silence too long, exiting ASR')
    if (onTimeoutCallback) {
      onTimeoutCallback()
    }
  }, silenceTimerRemaining)

  // 启动倒计时更新（每 100ms 更新一次前端显示）
  startUpdateTimer(mainWindow)
}

/**
 * 暂停静音计时器（Chat+TTS 期间调用）
 * @param {BrowserWindow} mainWindow
 */
function pause(mainWindow) {
  // 清除更新定时器
  clearUpdateTimer()

  // 清除退出计时器
  if (global.silenceExitTimer) {
    clearTimeout(global.silenceExitTimer)
    global.silenceExitTimer = null
  }

  // 计算剩余时间
  const elapsed = Date.now() - silenceTimerStartTime
  silenceTimerRemaining = Math.max(0, silenceTimerRemaining - elapsed)

  // 通知前端暂停状态
  mainWindow.webContents.send('silence-timer-paused', {
    remaining: silenceTimerRemaining,
  })
}

/**
 * 清除计时器（不通知前端）
 */
function clear() {
  // 清除退出计时器
  if (global.silenceExitTimer) {
    clearTimeout(global.silenceExitTimer)
    global.silenceExitTimer = null
  }

  // 清除更新定时器
  clearUpdateTimer()
}

/**
 * 重置剩余时间为默认值
 */
function reset() {
  silenceTimerRemaining = VAD_CONFIG.SILENCE_TIMEOUT
  silenceTimerStartTime = null
}

/**
 * 获取当前剩余时间
 * @returns {number} 剩余毫秒数
 */
function getRemainingTime() {
  if (silenceTimerStartTime) {
    const elapsed = Date.now() - silenceTimerStartTime
    return Math.max(0, silenceTimerRemaining - elapsed)
  }
  return silenceTimerRemaining
}

/**
 * 设置超时回调
 * @param {Function} callback
 */
function setTimeoutCallback(callback) {
  onTimeoutCallback = callback
}

/**
 * 清除前端倒计时显示
 * @param {BrowserWindow} mainWindow
 */
function clearDisplay(mainWindow) {
  mainWindow.webContents.send('silence-timer-clear')
}

module.exports = {
  start,
  pause,
  clear,
  reset,
  getRemainingTime,
  setTimeoutCallback,
  clearDisplay,
}
