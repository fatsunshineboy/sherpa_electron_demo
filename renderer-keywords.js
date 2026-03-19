const keywordInput = document.getElementById('keyword-input')
const previewBtn = document.getElementById('preview-btn')
const saveBtn = document.getElementById('save-btn')
const previewSection = document.getElementById('preview-section')
const previewTbody = document.getElementById('preview-tbody')
const keywordCount = document.getElementById('keyword-count')
const statusBar = document.getElementById('status-bar')

let currentKeywords = []

// 页面加载时获取现有关键词
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const keywords = await window.electronAPI.getKeywords()
    keywordInput.value = keywords.join('\n')
    updateKeywordCount()
  } catch (err) {
    showStatus('加载关键词失败: ' + err.message, 'error')
  }
})

// 更新关键词计数
function updateKeywordCount() {
  const lines = keywordInput.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
  keywordCount.textContent = `共 ${lines.length} 个关键词`
}

// 显示状态消息
function showStatus(message, type) {
  statusBar.textContent = message
  statusBar.className = 'status-bar ' + type
  setTimeout(() => {
    statusBar.className = 'status-bar'
  }, 3000)
}

// 解析关键词
function parseKeywords(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

// 预览转换
previewBtn.addEventListener('click', async () => {
  const keywords = parseKeywords(keywordInput.value)

  if (keywords.length === 0) {
    showStatus('请输入至少一个关键词', 'error')
    return
  }

  currentKeywords = keywords
  updateKeywordCount()

  // 显示加载状态
  previewBtn.textContent = '转换中...'
  previewBtn.disabled = true

  try {
    // 请求主进程进行转换预览
    const preview = await window.electronAPI.previewKeywords(keywords)

    // 显示预览表格
    previewTbody.innerHTML = ''
    preview.forEach(item => {
      const row = document.createElement('tr')
      row.innerHTML = `
        <td>${escapeHtml(item.original)}</td>
        <td>${escapeHtml(item.phones)}</td>
      `
      previewTbody.appendChild(row)
    })
    previewSection.style.display = 'block'

    showStatus('转换预览成功', 'success')
  } catch (err) {
    showStatus('预览转换失败: ' + err.message, 'error')
  } finally {
    previewBtn.textContent = '预览转换'
    previewBtn.disabled = false
  }
})

// 保存并生成
saveBtn.addEventListener('click', async () => {
  const keywords = parseKeywords(keywordInput.value)

  if (keywords.length === 0) {
    showStatus('请输入至少一个关键词', 'error')
    return
  }

  // 显示加载状态
  saveBtn.textContent = '保存中...'
  saveBtn.disabled = true

  try {
    // 保存原始关键词
    await window.electronAPI.saveKeywords(keywords)

    // 生成 keywords.txt
    await window.electronAPI.generateKeywordsFile()

    showStatus('保存成功！请重启录音以使用新关键词', 'success')
    previewSection.style.display = 'none'
  } catch (err) {
    showStatus('保存失败: ' + err.message, 'error')
  } finally {
    saveBtn.textContent = '保存并生成'
    saveBtn.disabled = false
  }
})

// 输入时更新计数
keywordInput.addEventListener('input', updateKeywordCount)

// HTML转义辅助函数
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
