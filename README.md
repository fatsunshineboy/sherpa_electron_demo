# 基于 Sherpa 的语音唤醒与语音识别的 Electron 应用

## 项目概述

本项目是一个基于 **Sherpa ONNX**、**Electron** 和 **智谱AI API** 构建的语音交互系统。该系统结合了**离线关键词唤醒**（KWS）和**在线语音识别**（ASR）能力，提供完整的语音交互体验。

系统工作流程：
1. **离线唤醒**：使用Sherpa ONNX在本地实时检测预定义的中文/英文关键词
2. **语音活动检测**：唤醒后自动切换到VAD模式，检测用户语音段
3. **在线识别**：将检测到的语音段发送到智谱AI进行高精度语音识别
4. **流式输出**：支持实时流式识别结果展示

**关键词检测在本地完成**，只有唤醒后的语音内容才会发送到云端进行识别。



## 技术栈详解

### 1. Sherpa ONNX - 本地语音处理引擎

**Sherpa ONNX** 是由 [k2-fsa](https://github.com/k2-fsa) 团队开发的开源语音处理工具包，本项目利用其多个核心功能：

#### 关键词唤醒（KWS）
- **开放词汇系统**：无需重新训练即可添加任意中文/英文关键词
- **完全离线运行**：所有模型在本地执行，确保隐私和低延迟
- **跨平台支持**：Windows、macOS、Linux、Android、iOS等
- **多语言绑定**：C++、Python、JavaScript、Java等

#### 语音活动检测（VAD）
- **Silero VAD模型**：语音活动检测模型
- **实时处理**：毫秒级响应，准确分割语音段
- **可配置参数**：最小语音持续时间、静音阈值等

#### 核心特性
- **硬件加速**：支持CPU、GPU、NPU（Rockchip、Qualcomm、Ascend等）
- **开源免费**：Apache 2.0许可证

### 2. Electron - 跨平台桌面应用框架

**Electron** 提供成熟的桌面应用开发环境：

#### 安全架构
- **Context Isolation**：启用上下文隔离，防止渲染进程直接访问Node.js
- **Preload Scripts**：通过预加载脚本安全暴露必要API
- **Node Integration Disabled**：禁用渲染进程的Node.js集成

#### 开发优势
- **Web技术栈**：HTML/CSS/JavaScript开发者友好
- **跨平台兼容**：一套代码支持三大桌面平台
- **调试便利**：内置开发者工具

### 3. 智谱AI - 在线语音识别服务

**智谱AI GLM-ASR** 提供高精度的在线语音识别：

#### 服务特性
- **流式识别**：支持实时流式语音识别，降低延迟
- **高准确率**：基于大模型的语音识别，支持中英文混合
- **API友好**：RESTful API接口，易于集成

#### 配置参数
- **模型**：`glm-asr-2512`
- **采样率**：16kHz
- **格式**：WAV音频格式

### 4. 辅助组件

#### 音频处理
- **naudiodon2**：Node.js音频I/O库，用于实时音频采集

#### 中文处理
- **pinyin库**：中文转拼音，支持声调处理
- **自定义拼音拆分**：适配Sherpa模型的token要求
- **声调映射**：支持带声调的拼音转换

#### 英文处理
- **en.phone词典**：来自Sherpa官方的英文音素词典

- **字母级兜底**：处理未在词典中的英文单词

  

## 系统架构设计

### 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                           │
│  ┌─────────────┐     ┌──────────────────────────────────┐   │
│  │ Audio Input │────▶│ Sherpa KWS (离线关键词检测)      │    │
│  └─────────────┘     └──────────────────────────────────┘   │
│        ▲                           │                        │
│        │                           ▼                        │
│  ┌─────────────┐     ┌──────────────────────────────────┐   │
│  │ Keyword     │◀────│ IPC Messages                     │   │
│  │ Management  │     └──────────────────────────────────┘   │
│  └─────────────┘                                            │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Sherpa VAD (语音活动检测)                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Zhipu AI ASR (在线语音识别)                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Electron 渲染进程                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Web UI (HTML/CSS/JS)                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块说明

#### 1. 音频采集模块 (`src/audio/`)
- 使用 `naudiodon2` 库进行实时音频采集
- 配置16kHz采样率，单声道，32位浮点格式
- 将音频数据流式传递给不同处理模块

#### 2. 关键词唤醒引擎 (`src/services/kws-service.js`)
- 初始化Sherpa ONNX KeywordSpotter实例
- 创建音频流处理对象（`createStream()`）
- 实时解码并检测关键词匹配（`isReady()` + `decode()`）
- 返回检测结果（`getResult().keyword`）

#### 3. 语音活动检测模块 (`src/services/vad-service.js`)
- 使用Silero VAD模型检测语音段边界
- 实现循环缓冲区管理音频数据
- 处理最大语音持续时间限制（25秒）
- 静音超时自动退出ASR模式（10秒）

#### 4. 语音识别服务 (`src/services/asr-service.js`)
- 将Float32音频数据转换为WAV格式
- 流式调用智谱AI ASR API
- 处理SSE（Server-Sent Events）格式的流式响应
- 支持多语音段的连续识别

#### 5. 关键词管理模块 (`keywords-manager.js`)
- **中文处理流程**：
  1. 使用pinyin库将中文转换为带声调的拼音
  2. 按Sherpa token规则拆分拼音音节
  3. 验证token是否在有效集合中
  
- **英文处理流程**：
  1. 查询en.phone词典获取音素序列
  2. 如果词典中不存在，使用字母级兜底规则
  3. 生成标准音素格式

- **格式标准化**：
  - 最终格式：`音素序列 @关键词名称`
  - 示例：`x iǎo zh ì x iǎo zh ì @小智小智`

#### 6. 状态管理器 (`src/utils/state-manager.js`)
- 统一管理录音、KWS、ASR、VAD等状态
- 提供状态查询和重置方法
- 确保各模块间状态同步

#### 7. IPC通信层 (`src/core/ipc-handlers.js`)
- 安全的主进程-渲染进程通信
- 处理录音控制、关键词管理等请求
- 广播系统事件到所有窗口

### 数据流设计

1. **初始状态**：系统处于KWS监听模式，等待关键词

2. **关键词检测**：检测到关键词 → 切换到VAD模式

3. **语音检测**：VAD检测到语音段 → 发送到ASR服务

4. **语音识别**：ASR服务返回识别结果 → 更新UI

5. **静音处理**：10秒无语音 → 自动返回KWS模式

6. **手动控制**：用户可随时停止录音，返回初始状态

   

## 项目文件结构

```
sherpa_electron_test/
├── main.js                 # Electron主入口文件
├── preload.js              # 预加载脚本
├── renderer.js             # 主界面渲染进程逻辑
├── keywords-manager.js     # 关键词管理核心逻辑
├── index.html              # 主界面
├── keywords.html           # 关键词管理界面
├── renderer-keywords.js    # 关键词管理界面逻辑
├── package.json            # 项目依赖和脚本配置
├── .gitignore              # Git忽略文件
├── README.md               # 本技术文档
├── keywords_raw.txt        # 原始关键词列表（用户可编辑）
├── models/                 # 模型文件目录
│   ├── encoder.onnx        # KWS编码器模型
│   ├── decoder.onnx        # KWS解码器模型  
│   ├── joiner.onnx         # KWS融合器模型
│   ├── silero_vad.onnx     # VAD模型
│   ├── tokens.txt          # 词汇表（包含音素token定义）
│   ├── en.phone            # 英文音素词典
│   └── keywords.txt        # Sherpa格式的关键词文件（自动生成）
├── src/                    # 源代码目录
│   ├── audio/              # 音频处理工具
│   │   └── audio-utils.js  # 音频格式转换工具
│   ├── config/             # 配置文件
│   │   └── constants.js    # 常量配置
│   ├── core/               # 核心模块
│   │   ├── ipc-handlers.js # IPC处理器
│   │   └── window-manager.js # 窗口管理器
│   ├── services/           # 服务模块
│   │   ├── kws-service.js  # 关键词唤醒服务
│   │   ├── vad-service.js  # 语音活动检测服务
│   │   └── asr-service.js  # 语音识别服务
│   └── utils/              # 工具模块
│       └── state-manager.js # 状态管理器
├── styles/                 # 样式文件
│   ├── main.css            # 主界面样式
│   └── keywords.css        # 关键词管理界面样式
└── node_modules/           # Node.js依赖
```



## 使用说明

### 环境配置

1. **安装依赖**
```bash
npm install
```
关键依赖包：

- `sherpa-onnx-node`: Sherpa-ONNX Node.js绑定
- `sherpa-onnx-win-x64`: Windows x64平台的Sherpa-ONNX二进制文件
- `naudiodon2`: PortAudio的Node.js绑定，用于音频输入
- `electron`: Electron框架
- `pinyin`: 中文拼音转换库
- `node-fetch`: HTTP客户端
- `form-data`: 表单数据处理

2. **配置智谱AI API密钥**
```bash
# 设置环境变量
set ZHIPU_API_KEY=your-api-key-here

# 或者修改 src/config/constants.js 中的 API_CONFIG.KEY
```

3. **启动应用**
```bash
npm start
```

### 功能使用

#### 主界面功能
- **开始/停止录音**：控制整个语音交互流程
- **唤醒记录**：显示检测到的关键词及其计数
- **语音识别**：实时显示ASR识别结果
- **识别历史**：保存完整的识别记录

#### 关键词管理
1. **添加关键词**：在关键词管理界面输入中文或英文关键词
2. **预览转换**：点击"预览"查看关键词如何转换为音素序列
3. **保存生成**：点击"保存并生成"更新模型配置
4. **重启生效**：系统会自动停止当前录音并重新加载新关键词

### 支持的关键词格式
- **中文**：直接输入中文词语（如："小爱同学"、"你好"）
- **英文**：使用下划线分隔（如："Hi_Siri"、"Hey_Google"）
- **混合**：支持中英文混合（如："Hello_小智"）
- **多词**：支持多个词语组合（如："打开音乐"）

### 系统行为说明
- **唤醒后自动进入ASR模式**：检测到关键词后自动开始语音识别
- **智能语音段分割**：VAD自动检测语音开始和结束
- **静音超时返回**：10秒无语音自动返回关键词监听模式
- **最大语音限制**：单次语音最长25秒，超时自动截断
- **关键词热更新**：修改关键词后自动重新加载模型



## 技术优势

### 隐私保护
- **本地关键词检测**：敏感的关键词匹配完全在本地完成
- **选择性云端识别**：只有唤醒后的语音才发送到云端
- **无持久存储**：音频数据不在本地持久化存储

### 性能优化
- **多线程处理**：Sherpa ONNX使用2个CPU线程进行推理
```javascript
const KWS_CONFIG = {
  NUM_THREADS: 2,
  PROVIDER: 'cpu'
}
```
- **内存高效**：循环缓冲区管理音频数据，避免内存泄漏
- **实时响应**：毫秒级的关键词检测和语音识别延迟

### 用户体验
- **无缝切换**：KWS → VAD → ASR 的无缝流程
- **流式识别**：实时显示识别结果，提升交互感



## 参考资料

### Sherpa ONNX 官方资源
- **GitHub仓库**：https://github.com/k2-fsa/sherpa-onnx
- **官方文档**：https://k2-fsa.github.io/sherpa/onnx/
- **关键词唤醒文档**：https://k2-fsa.github.io/sherpa/onnx/kws/index.html
- **VAD文档**：https://k2-fsa.github.io/sherpa/onnx/vad/index.html
- **预训练模型**：https://github.com/k2-fsa/sherpa-onnx/releases

### Electron 官方资源
- **官方文档**：https://www.electronjs.org/docs

### 智谱AI API 文档
- **API文档**：https://open.bigmodel.cn/dev/api
- **ASR服务**：https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-asr-2512
