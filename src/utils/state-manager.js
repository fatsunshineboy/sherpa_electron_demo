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

// 录音控制状态
const recordingControlState = {
  skipAudioInput: false,  // 是否跳过音频输入（对话期间）
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

// 对话相关状态
const chatState = {
  conversationHistory: [],   // 对话历史
  isChatProcessing: false,   // 是否正在处理对话
  isTTSPlaying: false,       // 是否正在播放 TTS 音频
  lastUserMessage: '',       // 最后一条用户消息
  lastAIReply: '',           // 最后一条 AI 回复
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

  // 录音控制
  get skipAudioInput() { return recordingControlState.skipAudioInput },
  set skipAudioInput(value) { recordingControlState.skipAudioInput = value },

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

  // 对话状态
  get conversationHistory() { return chatState.conversationHistory },
  set conversationHistory(value) { chatState.conversationHistory = value },
  get isChatProcessing() { return chatState.isChatProcessing },
  set isChatProcessing(value) { chatState.isChatProcessing = value },
  get isTTSPlaying() { return chatState.isTTSPlaying },
  set isTTSPlaying(value) { chatState.isTTSPlaying = value },
  get lastUserMessage() { return chatState.lastUserMessage },
  set lastUserMessage(value) { chatState.lastUserMessage = value },
  get lastAIReply() { return chatState.lastAIReply },
  set lastAIReply(value) { chatState.lastAIReply = value },
}

// 重置 KWS 状态
function resetKwsState() {
  kwsState.kws = null
  kwsState.stream = null
  kwsState.ai = null
  kwsState.keywordCounts = {}
}

// 重置录音控制状态
function resetRecordingControlState() {
  recordingControlState.skipAudioInput = false
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

// 重置对话状态
function resetChatState() {
  chatState.isChatProcessing = false
  chatState.isTTSPlaying = false
  chatState.lastUserMessage = ''
  chatState.lastAIReply = ''
  // 注意：不清空 conversationHistory，保留上下文
}

// 重置所有状态（停止录音时使用）
function resetAllState() {
  recordingState.isRecording = false
  asrState.asrMode = false
  resetKwsState()
  resetVadState()
  resetChatState()
  resetRecordingControlState()
}

module.exports = {
  state,
  resetKwsState,
  resetAsrState,
  resetVadState,
  resetAllState,
}
