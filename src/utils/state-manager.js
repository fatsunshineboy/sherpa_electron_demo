// 音频状态
const audioState = {
  ai: null,
  isRecording: false,
  skipAudioInput: false,  // 是否跳过音频输入（对话期间）
}

// KWS 相关状态
const kwsState = {
  kws: null,
  stream: null,
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
  get isRecording() { return audioState.isRecording },
  set isRecording(value) { audioState.isRecording = value },
  get ai() { return audioState.ai },
  set ai(value) { audioState.ai = value },
  get skipAudioInput() { return audioState.skipAudioInput },
  set skipAudioInput(value) { audioState.skipAudioInput = value },

  // KWS 状态
  get kws() { return kwsState.kws },
  set kws(value) { kwsState.kws = value },
  get stream() { return kwsState.stream },
  set stream(value) { kwsState.stream = value },
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

// 重置音频状态
function resetAudioState() {
  if (audioState.ai) {
    try { audioState.ai.stop() } catch(e) {}
    audioState.ai = null
  }
  audioState.isRecording = false
  audioState.skipAudioInput = false
}


// 重置 KWS 状态（包含资源释放）
function resetKwsState() {
  if (kwsState.stream) {
    try { kwsState.stream.free() } catch(e) {}
    kwsState.stream = null
  }
  if (kwsState.kws) {
    try { kwsState.kws.free() } catch(e) {}
    kwsState.kws = null
  }
  kwsState.keywordCounts = {}
}

// 重置 ASR 状态
function resetAsrState() {
  asrState.asrMode = false
  asrState.asrResult = ''
  asrState.segmentId = 0
}

// 重置 VAD 状态（包含资源释放）
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

// 重置所有状态（停止录音时使用，包含资源释放）
function resetAllState() {
  resetAudioState()
  resetKwsState()
  resetVadState()
  resetAsrState()
  resetChatState()
}

module.exports = {
  state,
  resetKwsState,
  resetAsrState,
  resetVadState,
  resetAllState,
}
