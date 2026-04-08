// 常量配置
const path = require('path')

// 文件路径
const PATHS = {
  RAW_KEYWORDS: './models/kws/keywords_raw.txt',
  KEYWORDS: './models/kws/keywords.txt',
  EN_PHONE: './models/kws/en.phone',
}

// VAD 配置参数
const VAD_CONFIG = {
  MIN_SPEECH_DURATION: 0.25,    // 最小语音持续时间 250ms
  MIN_SILENCE_DURATION: 2,    // 静音超过 2s 认为一句话结束
  MAX_SPEECH_DURATION: 25,      // 最大语音持续时间 25 秒
  WINDOW_SIZE: 512,             // VAD 窗口大小
  SAMPLE_RATE: 16000,
  BUFFER_SIZE_SECONDS: 60,      // 缓冲区大小（秒）
  SILENCE_TIMEOUT: 10000,        // 静音超时时间，超时无新语音则退出 ASR，退回到 kws 模式
}

// KWS 配置
const KWS_CONFIG = {
  SAMPLE_RATE: 16000,
  FEATURE_DIM: 80,
  NUM_THREADS: 2,
  PROVIDER: 'cpu',
  DEBUG: 1,
}

// ASR API 配置
const ASR_CONFIG = {
  KEY: process.env.ZHIPU_API_KEY || 'your-api-key',
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
  MODEL: 'glm-asr-2512',
}

// Chat API 配置
const CHAT_CONFIG = {
  KEY: process.env.ZHIPU_API_KEY || 'your-api-key',
  URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  MODEL: 'glm-5',
  MAX_HISTORY: 5,  // 保留最近5轮对话
}

// TTS API 配置
const TTS_CONFIG = {
  KEY: process.env.ZHIPU_API_KEY || 'your-api-key',
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/speech',
  MODEL: 'glm-tts',
  VOICE: 'tongtong',       // 默认音色
  RESPONSE_FORMAT: 'pcm',  // 输出格式，配合 speaker 使用
  SAMPLE_RATE: 24000,      // 采样率
  SPEED: 1.0,              // 语速 [0.5, 2.0]
}

// 本地 TTS 配置（sherpa-onnx）
const LOCAL_TTS_CONFIG = {
  SAMPLE_RATE: 16000,  // vocoder-16khz 输出采样率
}

// 本地 ASR 配置（sherpa-onnx OfflineRecognizer）
const LOCAL_ASR_CONFIG = {
  SAMPLE_RATE: 16000,
  FEATURE_DIM: 80,
  // 模型路径
  CONV_FRONTEND: './models/qwenAsr/conv_frontend.onnx',
  ENCODER: './models/qwenAsr/encoder.onnx',
  DECODER: './models/qwenAsr/decoder.onnx',
  TOKENIZER: './models/qwenAsr/tokenizer',
}

module.exports = {
  PATHS,
  VAD_CONFIG,
  KWS_CONFIG,
  ASR_CONFIG,
  CHAT_CONFIG,
  TTS_CONFIG,
  LOCAL_TTS_CONFIG,
  LOCAL_ASR_CONFIG,  // 新增
}
