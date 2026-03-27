// Chat 服务 - 大模型对话
const fetch = require('node-fetch')
const { CHAT_CONFIG } = require('../config/constants')

/**
 * 调用大模型进行对话
 * @param {string} userMessage - 用户消息
 * @param {Array} conversationHistory - 对话历史 [{role: 'user'|'assistant', content: '...'}]
 * @returns {Promise<string>} - 模型回复
 */
async function chatWithLLM(userMessage, conversationHistory = []) {
  // 构建消息列表
  const messages = buildMessages(userMessage, conversationHistory)

  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CHAT_CONFIG.KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_CONFIG.MODEL,
      messages: messages,
      stream: false,
      temperature: 0.7,
    }),
  }

  try {
    const response = await fetch(CHAT_CONFIG.URL, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Chat API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // 提取回复内容
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content
    }

    throw new Error('No response from Chat API')
  } catch (error) {
    console.error('Chat service error:', error)
    throw error
  }
}

/**
 * 构建消息列表，包含历史上下文
 * @param {string} userMessage - 当前用户消息
 * @param {Array} history - 对话历史
 * @returns {Array} - 完整消息列表
 */
function buildMessages(userMessage, history) {
  const messages = [
    {
      role: 'system',
      content: '你是一个友好的语音助手。请用简洁、自然的语言回答用户的问题，回复内容适合语音播报，避免使用markdown格式、代码块等不适合语音阅读的内容。',
    },
  ]

  // 添加历史对话（限制数量）
  const recentHistory = history.slice(-CHAT_CONFIG.MAX_HISTORY * 2)
  messages.push(...recentHistory)

  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  })

  return messages
}

/**
 * 更新对话历史
 * @param {Array} history - 当前对话历史
 * @param {string} userMessage - 用户消息
 * @param {string} assistantMessage - 助手回复
 * @returns {Array} - 更新后的对话历史
 */
function updateConversationHistory(history, userMessage, assistantMessage) {
  const newHistory = [...history]

  newHistory.push({ role: 'user', content: userMessage })
  newHistory.push({ role: 'assistant', content: assistantMessage })

  // 限制历史长度，保留最近的对话
  const maxMessages = CHAT_CONFIG.MAX_HISTORY * 2
  if (newHistory.length > maxMessages) {
    return newHistory.slice(-maxMessages)
  }

  return newHistory
}

module.exports = {
  chatWithLLM,
  updateConversationHistory,
}