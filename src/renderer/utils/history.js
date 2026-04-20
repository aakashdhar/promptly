const HISTORY_KEY = 'promptly_history'
const MAX_ENTRIES = 100

export function saveToHistory({ transcript, prompt, mode, isIteration = false, basedOn = null }) {
  const history = getHistory()
  const words = transcript.split(' ')
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  const entry = { id: Date.now(), title, transcript, prompt, mode, timestamp: new Date().toISOString() }
  if (isIteration) entry.isIteration = true
  if (basedOn) entry.basedOn = basedOn
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}

export function deleteHistoryItem(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(h => h.id !== id)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function searchHistory(query) {
  if (!query.trim()) return getHistory()
  const q = query.toLowerCase()
  return getHistory().filter(h =>
    h.transcript.toLowerCase().includes(q) ||
    h.prompt.toLowerCase().includes(q) ||
    h.mode.toLowerCase().includes(q)
  )
}

export function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
