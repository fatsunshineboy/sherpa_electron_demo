// 路径工具 - 动态获取资源路径
const pathUtils = require('../utils/path-utils')

// KWS 配置（路径在 getConfig 中动态解析）
const KWS_CONFIG = {
  SAMPLE_RATE: 16000,
  FEATURE_DIM: 80,
  NUM_THREADS: 2,
  PROVIDER: 'cpu',
  DEBUG: 1,
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
  MAX_HISTORY: 5,  // 保留最近 5 轮对话
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
}

/**
 * 获取包含绝对路径的完整配置
 * 必须在应用启动后调用（确保 pathUtils 已初始化）
 */
function getConfig() {
  return {
    KWS_CONFIG: {
      ...KWS_CONFIG,
      ENCODER: pathUtils.getModelPath('./kws/encoder.onnx'),
      DECODER: pathUtils.getModelPath('./kws/decoder.onnx'),
      JOINER: pathUtils.getModelPath('./kws/joiner.onnx'),
      TOKENS: pathUtils.getModelPath('./kws/tokens.txt'),
      RAW_KEYWORDS: pathUtils.getModelPath('./kws/keywords_raw.txt'),
      KEYWORDS: pathUtils.getModelPath('./kws/keywords.txt'),
      EN_PHONE: pathUtils.getModelPath('./kws/en.phone'),
    },
    VAD_CONFIG: {
      ...VAD_CONFIG,
      MODEL_PATH: pathUtils.getModelPath('./vad/silero_vad.onnx'),
    },
    ASR_CONFIG,
    CHAT_CONFIG,
    TTS_CONFIG,
    LOCAL_TTS_CONFIG: {
      ...LOCAL_TTS_CONFIG,
      ACOUSTICMODEL: pathUtils.getModelPath('./tts/model-steps-3.onnx'),
      VOCODER: pathUtils.getModelPath('./tts/vocos-16khz-univ.onnx'),
      LEXICON: pathUtils.getModelPath('./tts/lexicon.txt'),
      TOKENS: pathUtils.getModelPath('./tts/tokens.txt'),
      DATADIR: pathUtils.getModelPath('./tts/espeak-ng-data'),
      RULEFSTS: pathUtils.getModelPath('./tts/phone-zh.fst') + ',' +
                pathUtils.getModelPath('./tts/date-zh.fst') + ',' +
                pathUtils.getModelPath('./tts/number-zh.fst'),
    },
    LOCAL_ASR_CONFIG: {
      ...LOCAL_ASR_CONFIG,
      CONV_FRONTEND: pathUtils.getModelPath('./qwenAsr/conv_frontend.onnx'),
      ENCODER: pathUtils.getModelPath('./qwenAsr/encoder.onnx'),
      DECODER: pathUtils.getModelPath('./qwenAsr/decoder.onnx'),
      TOKENIZER: pathUtils.getModelPath('./qwenAsr/tokenizer'),
    },
  }
}

module.exports = {
  getConfig,
}
