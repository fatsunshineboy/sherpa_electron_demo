# Voice Wake-up and Recognition Electron App

<p align="center">
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.13.1-green" alt="Node"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-41.0.3-purple" alt="Electron"></a>
</p>

> 🎙️ Cross-platform voice interaction system powered by Sherpa ONNX + Qwen ASR + Zhipu AI

[中文文档](./README.md) | English

---

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [References](#references)

---

## Introduction

This project is an Electron desktop application combining **offline keyword wake-up** (KWS), **online/local automatic speech recognition** (ASR), **large language model chat** (Chat), and **online/local text-to-speech synthesis** (TTS).

System workflow:
1. **Offline Wake-up** - Sherpa ONNX detects predefined Chinese/English keywords locally in real-time
2. **Voice Activity Detection** - Automatically switches to VAD mode to detect user speech segments
3. **Speech Recognition** - Supports local Qwen ASR model or Zhipu AI API for high-accuracy recognition
4. **Intelligent Chat** - Calls Zhipu GLM large language model for multi-turn conversation
5. **Voice Response** - Supports local TTS or Zhipu AI API to convert responses to speech

**Keyword detection is completed locally**, only speech content after wake-up is sent to the cloud (in API mode) for recognition.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Offline KWS** | Fully local keyword detection for privacy, supports any Chinese/English keywords |
| 🔊 **Smart VAD** | Silero VAD automatically segments speech, supports 25s max duration |
| ☁️ **Online ASR** | Zhipu AI streaming recognition, Chinese/English support with punctuation |
| 🏠 **Local ASR** | Qwen ASR local model, no network required, privacy protection |
| 🧠 **LLM Chat** | Zhipu GLM-5 multi-turn chat, retains last 5 conversation rounds |
| 🔊 **Online TTS** | Zhipu AI TTS, multiple voice options |
| 🏠 **Local TTS** | Sherpa ONNX Matcha TTS local synthesis |
| 🔑 **Hot-reload Keywords** | Dynamic add/modify keywords without recompilation |
| 🖥️ **Cross-platform** | Windows / macOS / Linux |

### Dual Mode Switching

#### ASR Mode
- **Local** (`local`) - Uses Qwen ASR model for local recognition
- **API** (`api`) - Uses Zhipu AI API for cloud recognition

#### TTS Mode
- **Local** (`local`) - Uses Sherpa ONNX Matcha TTS for local synthesis
- **API** (`api`) - Uses Zhipu AI API for cloud synthesis

---

## Architecture

### Core Technology Stack

| Technology | Purpose |
|------------|---------|
| **Sherpa ONNX** | Local KWS wake-up, VAD detection, Local TTS synthesis |
| **Qwen ASR** | Local speech recognition model |
| **Electron** | Desktop application framework |
| **Zhipu AI** | Online ASR, GLM Chat, TTS synthesis |
| **naudiodon2** | Audio capture (PortAudio Node.js binding) |

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌─────────────┐                                            │
│  │ Audio Input │──────────────────────────────────────┐     │
│  └─────────────┘                                      │     │
│       ▼                                               ▼     │
│  ┌─────────────────┐                          ┌─────────────┐│
│  │ Sherpa KWS      │ Wake-up                  │ IPC Manager ││
│  │ (Offline KWS)   │─────────────────────────▶│             ││
│  └─────────────────┘                          └─────────────┘│
│       ▼                                               │
│  ┌─────────────────┐                                  │
│  │ Sherpa VAD      │ Speech Segment                  │
│  │ (VAD Detect)    │─────────────────────────────────┤
│  └─────────────────┘                                  │
│       ▼                                               ▼
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ASR Recognition (Local Qwen / Zhipu API)               ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Chat Conversation (Zhipu GLM-5)                        ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  TTS Synthesis (Local Matcha / Zhipu API)               ││
│  └─────────────────────────────────────────────────────────┘│
│       ▼                                               │
│  ┌─────────────┐                                      │     │
│  │ Audio Output│◀─────────────────────────────────────┘     │
│  └─────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron Renderer (Web UI)                 │
│  - Recording status display                                  │
│  - Wake-up record display                                    │
│  - Real-time recognition results                             │
│  - Conversation history                                      │
│  - ASR/TTS mode switching                                    │
│  - Keyword management interface                              │
└─────────────────────────────────────────────────────────────┘
```

### State Machine Flow

```
┌──────────────┐    Keyword Detected   ┌──────────────┐    Speech Detected   ┌──────────────┐
│   KWS Mode   │ ────────────────────▶ │   VAD Mode   │ ──────────────────▶ │   ASR Mode   │
│ KWS Listening│                       │ VAD Detecting│                     │  Recognizing │
└──────────────┘                       └──────────────┘                     └──────────────┘
       ▲                                                                              │
       │                         Recognition Complete                                 │
       │                                                                              ▼
       │                    ┌──────────────┐                                  ┌──────────────┐
       │                    │   Chat Mode  │ ◀────────────────────────────── │  TTS Play    │
       │                    │  Processing  │                                  │   Playing    │
       │                    └──────────────┘                                  └──────────────┘
       │                           │
       │                      Chat Complete
       └───────────────────────────┘
```

---

## Quick Start

### 1. Requirements

- Node.js >= 22.13.1
- npm >= 10.9.2
- Windows / macOS / Linux

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure API Key

```bash
# Windows PowerShell
$env:ZHIPU_API_KEY="your-api-key-here"

# Linux/macOS
export ZHIPU_API_KEY="your-api-key-here"
```

Or edit the following configurations in `src/config/constants.js`:
- `ASR_CONFIG.KEY` - ASR API Key
- `CHAT_CONFIG.KEY` - Chat API Key
- `TTS_CONFIG.KEY` - TTS API Key

### 4. Prepare Model Files

Ensure the following model files exist in the `models/` directory:

```
models/
├── kws/                    # Keyword Wake-up Models
│   ├── encoder.onnx
│   ├── decoder.onnx
│   ├── joiner.onnx
│   ├── tokens.txt
│   ├── en.phone            # English phone dictionary
│   └── keywords_raw.txt    # Raw keywords (editable)
├── vad/                    # VAD Model
│   └── silero_vad.onnx
├── qwenAsr/               # Local ASR Model
│   ├── conv_frontend.onnx
│   ├── encoder.onnx
│   ├── decoder.onnx
│   └── tokenizer
└── tts/                    # Local TTS Model
    ├── model-steps-3.onnx
    ├── vocos-16khz-univ.onnx
    ├── lexicon.txt
    ├── tokens.txt
    ├── phone-zh.fst
    ├── date-zh.fst
    ├── number-zh.fst
    └── espeak-ng-data/
```

### 5. Start Application

```bash
npm start
```

---

## Usage

### Main Window Features

- **Start/Stop Recording** - Control voice interaction flow
- **Wake-up Records** - Display detected keywords and counts
- **Real-time Recognition** - Streaming ASR results display
- **Conversation History** - Save complete conversation records
- **Recognition History** - Save ASR recognition results
- **ASR/TTS Mode Switch** - Switch between local and API modes

### Keyword Management

1. Open keyword management interface (`keywords.html`)
2. Enter new keywords (Chinese or English)
3. Click "Preview" to see phone conversion results
4. Click "Save and Generate" to update configuration
5. Restart application for new keywords to take effect

#### Supported Keyword Formats

| Type | Example |
|------|---------|
| Chinese | 小智小智、你好、小爱同学 |
| English | Hi_Siri、Hey_Google |
| Mixed | Hello_小智 |
| Multi-word | 打开音乐、播放歌曲 |

> **Note**: English keywords use underscore `_` to separate words

### Complete Interaction Flow

1. **Click "Start Recording"** - Enter KWS listening mode
2. **Say wake-up keyword** - e.g., "Xiao Zhi Xiao Zhi"
3. **Wait for prompt** - Enter VAD listening mode
4. **Say command** - e.g., "How's the weather today"
5. **Wait for recognition** - ASR recognizes speech
6. **Get response** - Chat LLM processes and replies
7. **Listen to reply** - TTS plays AI response
8. **Continue conversation** - Automatically returns to VAD mode for continued conversation
9. **Silence timeout** - Automatically returns to KWS mode after 10s of silence

---

## Project Structure

```
sherpa_electron_test/
├── main.js                      # Electron entry point
├── preload.js                   # Preload script
├── renderer.js                  # Main renderer process
├── keywords-manager.js          # Keyword management core logic
├── index.html                   # Main UI
├── keywords.html                # Keyword management UI
├── renderer-keywords.js         # Keyword management renderer logic
├── package.json                 # Project configuration
├── keywords_raw.txt             # Raw keyword list
├── README.md                    # Chinese documentation
├── README.en.md                 # English documentation
├── models/                      # Model files directory
│   ├── kws/                     # Keyword wake-up models
│   │   ├── encoder.onnx
│   │   ├── decoder.onnx
│   │   ├── joiner.onnx
│   │   ├── tokens.txt
│   │   ├── en.phone
│   │   └── keywords_raw.txt
│   ├── vad/                     # VAD model
│   │   └── silero_vad.onnx
│   ├── qwenAsr/                 # Local ASR model
│   │   ├── conv_frontend.onnx
│   │   ├── encoder.onnx
│   │   ├── decoder.onnx
│   │   └── tokenizer
│   └── tts/                     # Local TTS model
│       ├── model-steps-3.onnx
│       ├── vocos-16khz-univ.onnx
│       ├── lexicon.txt
│       ├── tokens.txt
│       ├── phone-zh.fst
│       ├── date-zh.fst
│       ├── number-zh.fst
│       └── espeak-ng-data/
├── src/                         # Source code
│   ├── audio/                   # Audio processing
│   │   ├── audio-utils.js       # Audio format conversion, merging
│   │   └── audio-player.js      # Audio player
│   ├── config/                  # Configuration
│   │   └── constants.js         # Constants (ASR/Chat/TTS API)
│   ├── core/                    # Core modules
│   │   ├── ipc-handlers.js      # IPC handlers (main-renderer communication)
│   │   └── window-manager.js    # Window manager
│   ├── services/                # Service modules
│   │   ├── kws-service.js       # Keyword wake-up service
│   │   ├── vad-service.js       # VAD service (with chat flow)
│   │   ├── asr-service.js       # ASR service (local/API dual mode)
│   │   ├── chat-service.js      # LLM chat service
│   │   └── tts-service.js       # TTS service (local/API dual mode)
│   └── utils/                   # Utility modules
│       └── state-manager.js     # State manager
├── styles/                      # Stylesheets
│   ├── main.css                 # Main UI styles
│   └── keywords.css             # Keyword management UI styles
└── node_modules/                # Node.js dependencies
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ZHIPU_API_KEY` | Zhipu AI API Key | `your-api-key` |

### Core Configuration (`src/config/constants.js`)

#### VAD Configuration
```javascript
VAD_CONFIG = {
  MIN_SPEECH_DURATION: 0.25,    // Min speech duration (seconds)
  MIN_SILENCE_DURATION: 2,      // Silence threshold (seconds)
  MAX_SPEECH_DURATION: 25,      // Max speech duration (seconds)
  SILENCE_TIMEOUT: 10000,       // Silence timeout (milliseconds)
}
```

#### ASR Configuration
```javascript
ASR_CONFIG = {
  MODEL: 'glm-asr-2512',        // Zhipu ASR model
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
}

LOCAL_ASR_CONFIG = {
  // Local Qwen ASR model paths
  CONV_FRONTEND: './models/qwenAsr/conv_frontend.onnx',
  ENCODER: './models/qwenAsr/encoder.onnx',
  DECODER: './models/qwenAsr/decoder.onnx',
  TOKENIZER: './models/qwenAsr/tokenizer',
}
```

#### Chat Configuration
```javascript
CHAT_CONFIG = {
  MODEL: 'glm-5',               // Zhipu Chat model
  URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  MAX_HISTORY: 5,               // Retained conversation rounds
}
```

#### TTS Configuration
```javascript
TTS_CONFIG = {
  MODEL: 'glm-tts',             // Zhipu TTS model
  VOICE: 'tongtong',            // Default voice
  URL: 'https://open.bigmodel.cn/api/paas/v4/audio/speech',
}

LOCAL_TTS_CONFIG = {
  SAMPLE_RATE: 16000,           // Local TTS output sample rate
}
```

---

## Technical Advantages

### Privacy Protection
- ✅ **Local KWS** - Sensitive keyword matching completed entirely locally
- ✅ **Selective Cloud Recognition** - Only speech after wake-up sent to cloud (API mode)
- ✅ **Local Mode** - Supports ASR and TTS running entirely locally, no network required
- ✅ **No Persistent Storage** - Audio data not persistently stored locally

### Performance Optimization
- 🚀 **Multi-thread Inference** - Sherpa ONNX uses 2 CPU threads
- 🚀 **Memory Efficient** - Circular buffer manages audio data
- 🚀 **Real-time Response** - Millisecond-level keyword detection and recognition latency
- 🚀 **Model Pre-warming** - Pre-loads local models on app startup, avoids first-use latency

### User Experience
- ✨ **Seamless Transition** - KWS → VAD → ASR → Chat → TTS smooth flow
- ✨ **Streaming Recognition** - Real-time recognition results display
- ✨ **Smart Timeout** - Automatically returns to listening mode after 10s silence
- ✨ **Multi-turn Chat** - Retains context, supports continuous conversation
- ✨ **Mode Switching** - One-click switch between local/API modes

---

## Dependencies

### Core Dependencies

| Dependency | Version | Description |
|------------|---------|-------------|
| `sherpa-onnx-node` | ^1.12.35 | Sherpa-ONNX Node.js binding |
| `sherpa-onnx-win-x64` | ^1.12.35 | Windows x64 Sherpa binaries |
| `naudiodon2` | ^2.5.0 | PortAudio Node.js binding for audio input |
| `speaker` | ^0.5.5 | Audio playback |
| `electron` | ^41.0.3 | Electron framework |
| `node-fetch` | ^2.7.0 | HTTP client |
| `form-data` | ^4.0.5 | Form data processing |
| `pinyin` | ^4.0.0 | Chinese pinyin conversion |

### Development Dependencies

| Dependency | Version | Description |
|------------|---------|-------------|
| `@electron/rebuild` | ^4.0.3 | Electron native module rebuild tool |

---

## References

### Sherpa ONNX
- **GitHub**: https://github.com/k2-fsa/sherpa-onnx
- **Documentation**: https://k2-fsa.github.io/sherpa/onnx/
- **KWS Docs**: https://k2-fsa.github.io/sherpa/onnx/kws/index.html
- **VAD Docs**: https://k2-fsa.github.io/sherpa/onnx/vad/index.html
- **Pre-trained Models**: https://github.com/k2-fsa/sherpa-onnx/releases
- **kws model**:https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2
- **vad model**:https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx
- **asr model**:https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2
- **acoustic model**:https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/matcha-icefall-zh-en.tar.bz2
- **vocoder model**:https://github.com/k2-fsa/sherpa-onnx/releases/download/vocoder-models/vocos-16khz-univ.onnx

### Electron
- **Documentation**: https://www.electronjs.org/docs

### Zhipu AI
- **API Docs**: https://open.bigmodel.cn/dev/api
- **ASR Service**: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512
- **Chat Service**: https://docs.bigmodel.cn/cn/guide/models/llm/glm-5
- **TTS Service**: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts