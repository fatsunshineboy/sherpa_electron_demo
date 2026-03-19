const recordBtn = document.getElementById('record-btn')
const statusDiv = document.getElementById('status')
const logContainer = document.getElementById('log-container')

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
    // 停止录音
    window.electronAPI.stopRecording()
    isRecording = false
    recordBtn.textContent = '开始录音'
    recordBtn.className = 'stopped'
    statusDiv.textContent = '已停止录音'
  }
})
