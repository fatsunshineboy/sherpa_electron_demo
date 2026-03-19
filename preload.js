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
  onKeywordsUpdated: (callback) => ipcRenderer.on('keywords-updated', (event, value) => callback(value))
})
