// 常量配置
const path = require('path')

// 文件路径
const PATHS = {
  RAW_KEYWORDS: './keywords_raw.txt',
  KEYWORDS: './models/keywords.txt',
  EN_PHONE: './models/en.phone',
}

// VAD 配置参数
const VAD_CONFIG = {
  MIN_SPEECH_DURATION: 0.25,    // 最小语音持续时间 250ms
  MIN_SILENCE_DURATION: 2,    // 静音超过 1s 认为语音结束
  MAX_SPEECH_DURATION: 5,      // 最大语音持续时间 25 秒
  WINDOW_SIZE: 512,             // VAD 窗口大小
  SAMPLE_RATE: 16000,
  BUFFER_SIZE_SECONDS: 60,      // 缓冲区大小（秒）
  SILENCE_TIMEOUT: 10000,        // 静音超时时间，超时无新语音则退出 ASR
}

// KWS 配置
const KWS_CONFIG = {
  SAMPLE_RATE: 16000,
  FEATURE_DIM: 80,
  NUM_THREADS: 2,
  PROVIDER: 'cpu',
  DEBUG: 1,
}

// API 配置
const API_CONFIG = {
  KEY: process.env.ZHIPU_API_KEY || 'your-api-key',
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
  MODEL: 'glm-asr-2512',
}

module.exports = {
  PATHS,
  VAD_CONFIG,
  KWS_CONFIG,
  API_CONFIG,
}
