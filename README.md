# 语音唤醒与识别 Electron 应用

<p align="center">
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.13.1-green" alt="Node"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-41.0.3-purple" alt="Electron"></a>
</p>

> 🎙️ 基于 Sherpa ONNX + 智谱 AI + Qwen ASR 的跨平台语音交互系统

[English README](./README.en.md) | 中文

---

## 简介

本项目是一个结合**离线关键词唤醒**（KWS）、**在线/本地语音识别**（ASR）、**大模型对话**（Chat）和**在线/本地语音合成**（TTS）的 Electron 桌面应用。

系统核心流程：
1. **离线唤醒** - 使用 Sherpa ONNX 在本地实时检测预定义的中文/英文关键词
2. **语音活动检测** - 唤醒后自动切换到 VAD 模式，检测用户语音段
3. **语音识别** - 支持本地 Qwen ASR 模型或智谱 AI API 进行高精度语音识别
4. **智能对话** - 调用智谱 GLM 大模型进行多轮对话
5. **语音回复** - 支持本地 TTS 或智谱 AI API 将回复转换为语音播放

**关键词检测在本地完成**，只有唤醒后的语音内容才会发送到云端（API 模式下）进行识别。

---

## 功能特性

| 功能 | 说明 |
|-----|------|
| 🎯 **离线关键词唤醒** | 完全本地执行的关键词检测，保护隐私，支持任意中英文关键词 |
| 🔊 **智能语音检测** | Silero VAD 自动分割语音段，支持 25 秒最长语音限制 |
| ☁️ **在线语音识别** | 智谱 AI 流式识别，支持中英文混合，带标点 |
| 🏠 **本地语音识别** | Qwen ASR 本地模型，无需网络，保护隐私 |
| 🧠 **大模型对话** | 智谱 GLM-5 多轮对话，保留最近 5 轮上下文 |
| 🔊 **在线语音合成** | 智谱 AI TTS，多种音色选择 |
| 🏠 **本地语音合成** | Sherpa ONNX Matcha TTS 本地合成 |
| 🔑 **关键词热更新** | 支持动态添加/修改关键词，无需重新编译 |
| 🖥️ **跨平台** | Windows / macOS / Linux |

### 双模式切换

#### ASR 模式
- **本地模式** (`local`) - 使用 Qwen ASR 模型进行本地识别
- **API 模式** (`api`) - 使用智谱 AI API 进行云端识别

#### TTS 模式
- **本地模式** (`local`) - 使用 Sherpa ONNX Matcha TTS 本地合成
- **API 模式** (`api`) - 使用智谱 AI API 进行云端合成

---

## 技术架构

### 核心技术栈

| 技术 | 用途 |
|-----|------|
| **Sherpa ONNX** | 本地 KWS 唤醒、VAD 检测、本地 TTS 合成 |
| **Qwen ASR** | 本地语音识别模型 |
| **Electron** | 桌面应用框架 |
| **智谱 AI** | 在线 ASR 识别、GLM 对话、TTS 合成 |
| **naudiodon2** | 音频采集（PortAudio Node.js 绑定） |

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                            │
│  ┌─────────────┐                                            │
│  │ Audio Input │──────────────────────────────────────┐     │
│  └─────────────┘                                      │     │
│       ▼                                               ▼     │
│  ┌─────────────────┐                          ┌─────────────┐│
│  │ Sherpa KWS      │ 唤醒                     │ IPC Manager ││
│  │ (离线关键词检测) │─────────────────────────▶│             ││
│  └─────────────────┘                          └─────────────┘│
│       ▼                                               │
│  ┌─────────────────┐                                  │
│  │ Sherpa VAD      │ 语音段                          │
│  │ (语音活动检测)   │─────────────────────────────────┤
│  └─────────────────┘                                  │
│       ▼                                               ▼
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ASR 识别 (本地 Qwen / 智谱 API)                        ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Chat 对话 (智谱 GLM-5)                                  ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  TTS 合成 (本地 Matcha / 智谱 API)                       ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────┐                                      │     │
│  │ Audio Output│◀─────────────────────────────────────┘     │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron 渲染进程 (Web UI)                  │
│  - 录音状态显示                                              │
│  - 唤醒记录展示                                              │
│  - 实时识别结果                                              │
│  - 对话历史                                                  │
│  - ASR/TTS模式切换                                           │
│  - 关键词管理界面                                            │
└─────────────────────────────────────────────────────────────┘
```

### 状态机流程

```
┌──────────────┐    检测到关键词    ┌──────────────┐    检测到语音    ┌──────────────┐
│   KWS 模式   │ ────────────────▶ │   VAD 模式   │ ─────────────▶ │   ASR 模式   │
│ KWS Listening│                   │ VAD Detecting│                 │  Recognizing │
└──────────────┘                   └──────────────┘                 └──────────────┘
       ▲                                                                      │
       │                         识别完成                                     │
       │                                                                      ▼
       │                    ┌──────────────┐                          ┌──────────────┐
       │                    │   Chat 模式  │ ◀──────────────────────── │  TTS 播放    │
       │                    │  Processing  │                          │   Playing    │
       │                    └──────────────┘                          └──────────────┘
       │                           │
       │                      对话完成
       └───────────────────────────┘
```

---

## 快速开始

### 1. 环境要求

- Node.js >= 22.13.1
- npm >= 10.9.2
- Windows / macOS / Linux

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 API 密钥

```bash
# Windows PowerShell
$env:ZHIPU_API_KEY="your-api-key-here"

# Linux/macOS
export ZHIPU_API_KEY="your-api-key-here"
```

或编辑 `src/config/constants.js` 中的以下配置：
- `ASR_CONFIG.KEY` - ASR API 密钥
- `CHAT_CONFIG.KEY` - Chat API 密钥
- `TTS_CONFIG.KEY` - TTS API 密钥

### 4. 准备模型文件

确保以下模型文件存在于 `models/` 目录：

```
models/
├── kws/                    # 关键词唤醒模型
│   ├── encoder.onnx
│   ├── decoder.onnx
│   ├── joiner.onnx
│   ├── tokens.txt
│   ├── en.phone            # 英文音素词典
│   └── keywords_raw.txt    # 原始关键词（可编辑）
├── vad/                    # VAD 模型
│   └── silero_vad.onnx
├── qwenAsr/               # 本地 ASR 模型
│   ├── conv_frontend.onnx
│   ├── encoder.onnx
│   ├── decoder.onnx
│   └── tokenizer
└── tts/                    # 本地 TTS 模型
    ├── model-steps-3.onnx
    ├── vocos-16khz-univ.onnx
    ├── lexicon.txt
    ├── tokens.txt
    ├── phone-zh.fst
    ├── date-zh.fst
    ├── number-zh.fst
    └── espeak-ng-data/
```

### 5. 启动应用

```bash
npm start
```

---

## 使用说明

### 主界面功能

- **开始/停止录音** - 控制语音交互流程
- **唤醒记录** - 显示检测到的关键词及计数
- **实时识别** - 流式显示 ASR 识别结果
- **对话历史** - 保存完整的对话记录
- **识别历史** - 保存 ASR 识别结果
- **ASR/TTS 模式切换** - 在本地和 API 模式间切换

### 关键词管理

1. 打开关键词管理界面（`keywords.html`）
2. 输入新关键词（中文或英文）
3. 点击"预览"查看音素转换效果
4. 点击"保存并生成"更新配置
5. 重启应用使新关键词生效

#### 支持的关键词格式

| 类型 | 示例 |
|-----|------|
| 中文 | 小智小智、你好、小爱同学 |
| 英文 | Hi_Siri、Hey_Google |
| 中英文混合 | Hello_小智 |
| 多词组合 | 打开音乐、播放歌曲 |

> **注意**: 英文关键词使用下划线 `_` 分隔单词

### 完整交互流程

1. **点击"开始录音"** - 进入 KWS 监听模式
2. **说出唤醒词** - 如"小智小智"
3. **等待提示音** - 进入 VAD 聆听模式
4. **说出指令** - 如"今天天气怎么样"
5. **等待识别** - ASR 识别语音
6. **获取回复** - Chat 大模型处理并回复
7. **听取回复** - TTS 播放 AI 回复
8. **继续对话** - 自动返回 VAD 模式，可继续对话
9. **静音超时** - 10 秒无语音自动返回 KWS 模式

---

## 项目结构

```
sherpa_electron_test/
├── main.js                      # Electron 主入口
├── preload.js                   # 预加载脚本
├── renderer.js                  # 主界面渲染进程
├── keywords-manager.js          # 关键词管理核心逻辑
├── index.html                   # 主界面
├── keywords.html                # 关键词管理界面
├── renderer-keywords.js         # 关键词管理界面逻辑
├── package.json                 # 项目配置
├── keywords_raw.txt             # 原始关键词列表
├── README.md                    # 中文技术文档
├── README.en.md                 # 英文技术文档
├── models/                      # 模型文件目录
│   ├── kws/                     # 关键词唤醒模型
│   │   ├── encoder.onnx
│   │   ├── decoder.onnx
│   │   ├── joiner.onnx
│   │   ├── tokens.txt
│   │   ├── en.phone
│   │   └── keywords_raw.txt
│   ├── vad/                     # VAD 模型
│   │   └── silero_vad.onnx
│   ├── qwenAsr/                 # 本地 ASR 模型
│   │   ├── conv_frontend.onnx
│   │   ├── encoder.onnx
│   │   ├── decoder.onnx
│   │   └── tokenizer
│   └── tts/                     # 本地 TTS 模型
│       ├── model-steps-3.onnx
│       ├── vocos-16khz-univ.onnx
│       ├── lexicon.txt
│       ├── tokens.txt
│       ├── phone-zh.fst
│       ├── date-zh.fst
│       ├── number-zh.fst
│       └── espeak-ng-data/
├── src/                         # 源代码
│   ├── audio/                   # 音频处理
│   │   ├── audio-utils.js       # 音频格式转换、合并
│   │   └── audio-player.js      # 音频播放器
│   ├── config/                  # 配置文件
│   │   └── constants.js         # 常量配置（ASR/Chat/TTS API）
│   ├── core/                    # 核心模块
│   │   ├── ipc-handlers.js      # IPC 处理器（主 - 渲染通信）
│   │   └── window-manager.js    # 窗口管理器
│   ├── services/                # 服务模块
│   │   ├── kws-service.js       # 关键词唤醒服务
│   │   ├── vad-service.js       # 语音活动检测服务（含对话流程）
│   │   ├── asr-service.js       # 语音识别服务（本地/API 双模式）
│   │   ├── chat-service.js      # 大模型对话服务
│   │   └── tts-service.js       # 语音合成服务（本地/API 双模式）
│   └── utils/                   # 工具模块
│       └── state-manager.js     # 状态管理器
├── styles/                      # 样式文件
│   ├── main.css                 # 主界面样式
│   └── keywords.css             # 关键词管理界面样式
└── node_modules/                # Node.js 依赖
```

---

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|-----|------|-------|
| `ZHIPU_API_KEY` | 智谱 AI API 密钥 | `your-api-key` |

### 核心配置项 (`src/config/constants.js`)

#### VAD 配置
```javascript
VAD_CONFIG = {
  MIN_SPEECH_DURATION: 0.25,    // 最小语音持续时间 (秒)
  MIN_SILENCE_DURATION: 2,      // 静音判定阈值 (秒)
  MAX_SPEECH_DURATION: 25,      // 最大语音持续时间 (秒)
  SILENCE_TIMEOUT: 10000,       // 静音超时 (毫秒)
}
```

#### ASR 配置
```javascript
ASR_CONFIG = {
  MODEL: 'glm-asr-2512',        // 智谱 ASR 模型
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
}

LOCAL_ASR_CONFIG = {
  // 本地 Qwen ASR 模型路径
  CONV_FRONTEND: './models/qwenAsr/conv_frontend.onnx',
  ENCODER: './models/qwenAsr/encoder.onnx',
  DECODER: './models/qwenAsr/decoder.onnx',
  TOKENIZER: './models/qwenAsr/tokenizer',
}
```

#### Chat 配置
```javascript
CHAT_CONFIG = {
  MODEL: 'glm-5',               // 智谱 Chat 模型
  URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  MAX_HISTORY: 5,               // 保留对话轮数
}
```

#### TTS 配置
```javascript
TTS_CONFIG = {
  MODEL: 'glm-tts',             // 智谱 TTS 模型
  VOICE: 'tongtong',            // 默认音色
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/speech',
}

LOCAL_TTS_CONFIG = {
  SAMPLE_RATE: 16000,           // 本地 TTS 输出采样率
}
```

---

## 技术优势

### 隐私保护
- ✅ **本地关键词检测** - 敏感的关键词匹配完全在本地完成
- ✅ **选择性云端识别** - 仅唤醒后的语音发送至云端（API 模式）
- ✅ **本地模式** - 支持 ASR 和 TTS 完全本地运行，无需网络
- ✅ **无持久存储** - 音频数据不在本地持久化存储

### 性能优化
- 🚀 **多线程推理** - Sherpa ONNX 使用 2 个 CPU 线程
- 🚀 **内存高效** - 循环缓冲区管理音频数据
- 🚀 **实时响应** - 毫秒级的关键词检测和识别延迟
- 🚀 **模型预热** - 应用启动时预加载本地模型，避免首次使用延迟

### 用户体验
- ✨ **无缝切换** - KWS → VAD → ASR → Chat → TTS 流畅过渡
- ✨ **流式识别** - 实时显示识别结果
- ✨ **智能超时** - 10 秒无语音自动返回监听模式
- ✨ **多轮对话** - 保留上下文，支持连续对话
- ✨ **模式切换** - 一键切换本地/API 模式

---

## 依赖说明

### 核心依赖

| 依赖 | 版本 | 说明 |
|-----|------|------|
| `sherpa-onnx-node` | ^1.12.35 | Sherpa-ONNX Node.js 绑定 |
| `sherpa-onnx-win-x64` | ^1.12.35 | Windows x64 Sherpa 二进制文件 |
| `naudiodon2` | ^2.5.0 | PortAudio Node.js 绑定，用于音频输入 |
| `speaker` | ^0.5.5 | 音频播放 |
| `electron` | ^41.0.3 | Electron 框架 |
| `node-fetch` | ^2.7.0 | HTTP 客户端 |
| `form-data` | ^4.0.5 | 表单数据处理 |
| `pinyin` | ^4.0.0 | 中文拼音转换 |

### 开发依赖

| 依赖 | 版本 | 说明 |
|-----|------|------|
| `@electron/rebuild` | ^4.0.3 | Electron 原生模块重建工具 |

---

## 参考资料

### Sherpa ONNX
- **GitHub**: https://github.com/k2-fsa/sherpa-onnx
- **官方文档**: https://k2-fsa.github.io/sherpa/onnx/
- **KWS 文档**: https://k2-fsa.github.io/sherpa/onnx/kws/index.html
- **VAD 文档**: https://k2-fsa.github.io/sherpa/onnx/vad/index.html
- **预训练模型**: https://github.com/k2-fsa/sherpa-onnx/releases

### Electron
- **官方文档**: https://www.electronjs.org/docs

### 智谱 AI
- **API 文档**: https://open.bigmodel.cn/dev/api
- **ASR 服务**: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512
- **Chat 服务**: https://docs.bigmodel.cn/cn/guide/models/llm/glm-5
- **TTS 服务**: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts