const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  onKeywordDetected: (callback) => ipcRenderer.on('keyword-detected', (event, value) => callback(value)),
  // 关键词管理 API
  getKeywords: () => ipcRenderer.invoke('get-keywords'),
  saveKeywords: (keywords) => ipcRenderer.invoke('save-keywords', keywords),
  previewKeywords: (keywords) => ipcRenderer.invoke('preview-keywords', keywords),
  generateKeywordsFile: () => ipcRenderer.invoke('generate-keywords-file'),
  onKeywordsUpdated: (callback) => ipcRenderer.on('keywords-updated', (event, value) => callback(value)),
  // ASR 相关 API
  onASRStarted: (callback) => ipcRenderer.on('asr-started', (event, value) => callback(value)),
  onASRProcessing: (callback) => ipcRenderer.on('asr-processing', (event, value) => callback(value)),
  onASRResult: (callback) => ipcRenderer.on('asr-result', (event, value) => callback(value)),
  onASRError: (callback) => ipcRenderer.on('asr-error', (event, value) => callback(value)),
  onASRStream: (callback) => ipcRenderer.on('asr-stream', (event, value) => callback(value)),
  onASRDone: (callback) => ipcRenderer.on('asr-done', (event, value) => callback(value)),
  onASRFinalResult: (callback) => ipcRenderer.on('asr-final-result', (event, value) => callback(value)),
  onASRStopped: (callback) => ipcRenderer.on('asr-stopped', (event, value) => callback(value)),
  onASRStatus: (callback) => ipcRenderer.on('asr-status', (event, value) => callback(value)),
  // 对话相关 API
  onChatStarted: (callback) => ipcRenderer.on('chat-started', (event, value) => callback(value)),
  onChatResult: (callback) => ipcRenderer.on('chat-result', (event, value) => callback(value)),
  onChatQueued: (callback) => ipcRenderer.on('chat-queued', (event, value) => callback(value)),
  onTTSStarted: (callback) => ipcRenderer.on('tts-started', (event, value) => callback(value)),
  onTTSPlaying: (callback) => ipcRenderer.on('tts-playing', (event, value) => callback(value)),
  onTTSDone: (callback) => ipcRenderer.on('tts-done', (event, value) => callback(value)),
  onChatError: (callback) => ipcRenderer.on('chat-error', (event, value) => callback(value)),
  // TTS 播放按钮 API
  playTTS: (text) => ipcRenderer.send('play-tts', text),
  onTTSPlayStarted: (callback) => ipcRenderer.on('tts-play-started', (event, value) => callback(value)),
  onTTSPlayDone: (callback) => ipcRenderer.on('tts-play-done', (event, value) => callback(value)),
  // 全局状态监听
  onStateChanged: (callback) => ipcRenderer.on('state-changed', (event, value) => callback(value)),
})
