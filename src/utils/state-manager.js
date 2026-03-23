// 全局状态管理
const { VAD_CONFIG } = require('../config/constants')

// 录音状态
const recordingState = {
  isRecording: false,
}

// KWS 相关状态
const kwsState = {
  kws: null,
  stream: null,
  ai: null,
  keywordCounts: {},
}

// ASR 相关状态
const asrState = {
  asrMode: false,
  asrResult: '',
  segmentId: 0,
}

// VAD 相关状态
const vadState = {
  vad: null,
  vadBuffer: null,
  isSpeechActive: false,
  speechStartTime: null,
  silenceTimer: null,
}

// 状态查询方法
const state = {
  // 录音状态
  get isRecording() { return recordingState.isRecording },
  set isRecording(value) { recordingState.isRecording = value },

  // KWS 状态
  get kws() { return kwsState.kws },
  set kws(value) { kwsState.kws = value },
  get stream() { return kwsState.stream },
  set stream(value) { kwsState.stream = value },
  get ai() { return kwsState.ai },
  set ai(value) { kwsState.ai = value },
  get keywordCounts() { return kwsState.keywordCounts },
  set keywordCounts(value) { kwsState.keywordCounts = value },

  // ASR 状态
  get asrMode() { return asrState.asrMode },
  set asrMode(value) { asrState.asrMode = value },
  get asrResult() { return asrState.asrResult },
  set asrResult(value) { asrState.asrResult = value },
  get segmentId() { return asrState.segmentId },
  set segmentId(value) { asrState.segmentId = value },
  incrementSegmentId() { asrState.segmentId++ },

  // VAD 状态
  get vad() { return vadState.vad },
  set vad(value) { vadState.vad = value },
  get vadBuffer() { return vadState.vadBuffer },
  set vadBuffer(value) { vadState.vadBuffer = value },
  get isSpeechActive() { return vadState.isSpeechActive },
  set isSpeechActive(value) { vadState.isSpeechActive = value },
  get speechStartTime() { return vadState.speechStartTime },
  set speechStartTime(value) { vadState.speechStartTime = value },
  get silenceTimer() { return vadState.silenceTimer },
  set silenceTimer(value) { vadState.silenceTimer = value },
}

// 重置 KWS 状态
function resetKwsState() {
  kwsState.kws = null
  kwsState.stream = null
  kwsState.ai = null
  kwsState.keywordCounts = {}
}

// 重置 ASR 状态
function resetAsrState() {
  asrState.asrMode = false
  asrState.asrResult = ''
  asrState.segmentId = 0
}

// 重置 VAD 状态
function resetVadState() {
  if (vadState.silenceTimer) {
    clearTimeout(vadState.silenceTimer)
    vadState.silenceTimer = null
  }
  if (vadState.vad) {
    try { vadState.vad.free() } catch(e) {}
    vadState.vad = null
  }
  vadState.vadBuffer = null
  vadState.isSpeechActive = false
  vadState.speechStartTime = null
}

// 重置所有状态（停止录音时使用）
function resetAllState() {
  recordingState.isRecording = false
  asrState.asrMode = false
  resetVadState()
}

module.exports = {
  state,
  resetKwsState,
  resetAsrState,
  resetVadState,
  resetAllState,
}
