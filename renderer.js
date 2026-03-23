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

// ASR 流式状态
let asrContent = ''
let currentSegmentId = null
let segmentResults = {}

// 处理关键词检测事件
window.electronAPI.onKeywordDetected((data) => {
  totalDetections++

  // 移除空状态提示
  const emptyState = logContainer.querySelector('.log-empty')
  if (emptyState) {
    emptyState.remove()
  }

  // 创建日志项
  const logItem = document.createElement('div')
  logItem.className = 'log-item'
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  logItem.innerHTML = `
    <span class="log-badge">${data.count}</span>
    <span class="log-time">${time}</span>
    <span class="log-text">检测到 "${data.keyword}"</span>
  `

  // 插入到顶部
  logContainer.insertBefore(logItem, logContainer.firstChild)

  // 更新状态
  statusDiv.textContent = `已检测到 ${totalDetections} 次唤醒`
})

// 处理 ASR 开始事件
window.electronAPI.onASRStarted((data) => {
  asrBox.classList.add('active')
  asrBox.classList.remove('processing')
  asrContent = ''
  currentSegmentId = null
  segmentResults = {}
  asrText.textContent = ''
  asrStatus.textContent = `已唤醒，请说话...`
})

// 处理 ASR 处理中事件
window.electronAPI.onASRProcessing(() => {
  asrBox.classList.add('processing')
  asrStatus.textContent = '正在识别最后一段...'
})

// 处理 ASR 流式数据事件
window.electronAPI.onASRStream((data) => {
  // 如果是新的 segment，保留之前 segment 的结果
  if (data.segmentId !== currentSegmentId) {
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

  // 更新当前 segment 的最新结果
  segmentResults[data.segmentId] = data.text

  // 重新构建完整文本
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

// 处理 ASR 状态更新事件
window.electronAPI.onASRStatus && window.electronAPI.onASRStatus((data) => {
  if (data.status === 'listening') {
    asrStatus.textContent = data.message || '正在聆听...'
  }
})

// 处理 ASR 停止事件
window.electronAPI.onASRStopped && window.electronAPI.onASRStopped(() => {
  asrBox.classList.remove('active', 'processing')
  asrStatus.textContent = '识别已停止'
  asrContent = ''
  currentSegmentId = null
  segmentResults = {}
})

// 处理 ASR 完成事件
window.electronAPI.onASRDone(() => {
  asrBox.classList.remove('active', 'processing')
  asrStatus.textContent = '识别结束，返回唤醒模式'
  if (asrContent && asrContent.trim()) {
    saveToHistory(asrContent)
  }
  asrContent = ''
  currentSegmentId = null
  segmentResults = {}
})

// 保存识别结果到历史记录
function saveToHistory(text) {
  // 移除空状态提示
  const emptyState = historyContainer.querySelector('.history-empty')
  if (emptyState) {
    emptyState.remove()
  }

  const historyItem = document.createElement('div')
  historyItem.className = 'history-item'
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  historyItem.innerHTML = `
    <span class="history-time">${time}</span>
    <div class="history-text">${escapeHtml(text)}</div>
  `
  historyContainer.insertBefore(historyItem, historyContainer.firstChild)
}

// HTML 转义辅助函数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 处理 ASR 错误事件
window.electronAPI.onASRError((data) => {
  asrText.textContent = '识别失败'
  asrStatus.textContent = `错误: ${data.error}`
  asrContent = ''
  currentSegmentId = null
  segmentResults = {}
})

// 处理关键词更新事件
window.electronAPI.onKeywordsUpdated((data) => {
  keywordsUpdated = true
  if (isRecording) {
    window.electronAPI.stopRecording()
    isRecording = false
    recordBtn.textContent = '开始录音'
    recordBtn.className = 'record-btn stopped'
    statusDiv.textContent = '关键词已更新，请重新开始录音以生效'
  }
  totalDetections = 0
  logContainer.innerHTML = '<div class="log-empty">暂无唤醒记录</div>'
})

// 处理按钮点击
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    window.electronAPI.startRecording()
    isRecording = true
    keywordsUpdated = false
    recordBtn.textContent = '停止录音'
    recordBtn.className = 'record-btn recording'
    statusDiv.textContent = '正在录音，请说出关键词...'
  } else {
    if (asrContent && asrContent.trim()) {
      saveToHistory(asrContent)
    }
    window.electronAPI.stopRecording()
    isRecording = false
    recordBtn.textContent = '开始录音'
    recordBtn.className = 'record-btn stopped'
    statusDiv.textContent = '已停止录音'
    asrBox.classList.remove('active', 'processing')
  }
})
