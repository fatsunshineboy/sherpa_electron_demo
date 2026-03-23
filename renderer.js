const recordBtn = document.getElementById('record-btn')
const statusDiv = document.getElementById('status')
const logContainer = document.getElementById('log-container')
const asrBox = document.getElementById('asr-box')
const asrText = document.getElementById('asr-text')
const asrStatus = document.getElementById('asr-status')
const historyContainer = document.getElementById('history-container')

let isRecording = false
let totalDetections = 0
let keywordsUpdated = false

// 处理关键词检测事件
window.electronAPI.onKeywordDetected((data) => {
  totalDetections++

  // 创建日志项
  const logItem = document.createElement('div')
  logItem.className = 'log-item'
  const time = new Date().toLocaleTimeString()
  logItem.textContent = `[${time}] 检测到关键词: "${data.keyword}" (累计: ${data.count} 次)`

  // 插入到顶部
  logContainer.insertBefore(logItem, logContainer.firstChild)

  // 更新状态
  statusDiv.textContent = `已检测到 ${totalDetections} 次唤醒`
})

// 处理 ASR 开始事件
window.electronAPI.onASRStarted((data) => {
  asrBox.className = 'asr-box active'
  asrBox.classList.remove('processing')
  asrContent = ''  // 清空缓存
  currentSegmentId = null  // 重置segment
  segmentResults = {}  // 清空segment结果
  asrText.textContent = ''
  asrStatus.textContent = `已唤醒: "${data.keyword}"，请说话...`
})

// 处理 ASR 处理中事件
window.electronAPI.onASRProcessing(() => {
  asrBox.classList.add('processing')
  asrStatus.textContent = '正在识别最后一段...'
})

// 处理 ASR 结果事件（非流式备用）
window.electronAPI.onASRResult((data) => {
  asrText.textContent = data.result
  asrStatus.textContent = '识别完成，返回唤醒模式'
})

// 处理 ASR 流式数据事件
let asrContent = ''
let currentSegmentId = null
let segmentResults = {}  // 存储每个segment的最新结果

window.electronAPI.onASRStream((data) => {
  // 如果是新的segment，保留之前segment的结果
  if (data.segmentId !== currentSegmentId) {
    // 将之前segment的结果固定到总文本中
    if (currentSegmentId !== null && segmentResults[currentSegmentId]) {
      asrContent = ''
      for (let i = 1; i < data.segmentId; i++) {
        if (segmentResults[i]) {
          asrContent += segmentResults[i]
        }
      }
    }
    currentSegmentId = data.segmentId
  }

  // 更新当前segment的最新结果
  segmentResults[data.segmentId] = data.text

  // 重新构建完整文本（所有已完成segment + 当前segment）
  let fullText = ''
  for (let i = 1; i <= data.segmentId; i++) {
    if (segmentResults[i]) {
      fullText += segmentResults[i]
    }
  }

  asrContent = fullText
  asrText.textContent = asrContent
  asrStatus.textContent = data.isFinal ? '识别完成' : '正在实时识别...'
})

// 处理 ASR 最终结果（非流式，用于静音结束时的最终识别）
window.electronAPI.onASRFinalResult && window.electronAPI.onASRFinalResult((data) => {
  // 最终识别结果直接显示，不追加到之前的流式结果
  asrText.textContent = data.result
  asrStatus.textContent = '识别完成'
  // 保存到历史记录
  saveToHistory(data.result)
})

// 处理 ASR 状态更新事件
window.electronAPI.onASRStatus && window.electronAPI.onASRStatus((data) => {
  if (data.status === 'listening') {
    asrStatus.textContent = data.message || '正在聆听...'
  }
})
window.electronAPI.onASRStopped && window.electronAPI.onASRStopped(() => {
  asrBox.className = 'asr-box'
  asrStatus.textContent = '识别已停止'
  asrContent = ''  // 清空缓存
  currentSegmentId = null
  segmentResults = {}
})

// 处理 ASR 完成事件
window.electronAPI.onASRDone(() => {
  asrStatus.textContent = '识别结束，返回唤醒模式'
  // 保存当前识别结果到历史记录
  if (asrContent && asrContent.trim()) {
    saveToHistory(asrContent)
  }
  asrContent = ''  // 重置缓存
  currentSegmentId = null
  segmentResults = {}
})

// 保存识别结果到历史记录
function saveToHistory(text) {
  const historyItem = document.createElement('div')
  historyItem.className = 'history-item'
  const time = new Date().toLocaleTimeString()
  historyItem.innerHTML = `<span class="history-time">[${time}]</span>${text}`
  historyContainer.insertBefore(historyItem, historyContainer.firstChild)
}

// 处理 ASR 错误事件
window.electronAPI.onASRError((data) => {
  asrText.textContent = '识别失败'
  asrStatus.textContent = `错误: ${data.error}`
  asrContent = ''  // 重置缓存
  currentSegmentId = null
  segmentResults = {}
})

// 处理关键词更新事件
window.electronAPI.onKeywordsUpdated((data) => {
  keywordsUpdated = true
  // 如果正在录音，需要停止并提示用户重新开始
  if (isRecording) {
    window.electronAPI.stopRecording()
    isRecording = false
    recordBtn.textContent = '开始录音'
    recordBtn.className = 'stopped'
    statusDiv.textContent = '关键词已更新，请重新开始录音以生效'
  }
  // 清空检测计数
  totalDetections = 0
  logContainer.innerHTML = ''
})

// 处理按钮点击
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    // 开始录音
    window.electronAPI.startRecording()
    isRecording = true
    keywordsUpdated = false
    recordBtn.textContent = '停止录音'
    recordBtn.className = 'recording'
    statusDiv.textContent = '正在录音，请说出关键词...'
  } else {
    // 停止录音前，保存当前识别结果到历史
    if (asrContent && asrContent.trim()) {
      saveToHistory(asrContent)
    }
    // 停止录音
    window.electronAPI.stopRecording()
    isRecording = false
    recordBtn.textContent = '开始录音'
    recordBtn.className = 'stopped'
    statusDiv.textContent = '已停止录音'
  }
})
