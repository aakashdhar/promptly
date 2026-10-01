const HISTORY_KEY = 'promptly_history'
const MAX_ENTRIES = 100

// Saving history must never break the flow that called it: a result Claude already wrote
// is on screen whether or not it fits in storage. When storage is full, the oldest
// entries (bookmarked ones last) are dropped until it fits.
function store(history) {
  let list = history
  for (;;) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
      return true
    } catch {
      if (list.length <= 1) return false
      const drop = Math.max(1, Math.ceil(list.length / 4))
      const plain = list.filter(h => !h.bookmarked)
      // Oldest are at the end; unbookmarked ones go first.
      const gone = new Set((plain.length >= drop ? plain : list).slice(-drop))
      list = list.filter(h => !gone.has(h))
    }
  }
}

export function saveToHistory({ transcript, prompt, mode, isIteration = false, basedOn = null, polishChanges = null }) {
  const history = getHistory()
  const words = String(transcript ?? '').split(' ')
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  const entry = { id: Date.now(), title, transcript, prompt, mode, timestamp: new Date().toISOString() }
  if (isIteration) entry.isIteration = true
  if (basedOn) entry.basedOn = basedOn
  if (polishChanges) entry.polishChanges = polishChanges
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  store(history)
  return entry.id
}

// Whatever is stored is trusted only as far as it's an array of entries with an id.
export function getHistory() {
  let parsed
  try { parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
  return Array.isArray(parsed) ? parsed.filter(h => h && typeof h === 'object' && h.id != null) : []
}

export function deleteHistoryItem(id) {
  store(getHistory().filter(h => h.id !== id))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function searchHistory(query) {
  if (!query.trim()) return getHistory()
  const q = query.toLowerCase()
  const has = (v) => String(v ?? '').toLowerCase().includes(q)
  return getHistory().filter(h => has(h.transcript) || has(h.prompt) || has(h.mode))
}

export function bookmarkHistoryItem(id) {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === id)
  if (idx === -1) return
  history[idx].bookmarked = !history[idx].bookmarked
  store(history)
  return history[idx].bookmarked
}

export function rateHistoryItem(id, rating, tag) {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === id)
  if (idx === -1) return
  history[idx].rating = rating
  history[idx].ratingTag = tag ?? null
  store(history)
}

export function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

// A prompt made from a dictation ("Make it a prompt") is saved right after the dictation, with
// the dictation's words as its transcript. Shown as one row: the prompt, marked as spoken.
export function pairDictations(entries) {
  const out = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const next = entries[i + 1]
    if (e.mode !== 'dictate' && next && next.mode === 'dictate' && next.prompt && next.prompt.trim() === (e.transcript || '').trim()) {
      out.push({ ...e, fromDictation: next.id })
      i++
    } else {
      out.push(e)
    }
  }
  return out
}

// Versions of a prompt rewritten for other AIs (the "For" picker), kept on the history entry that
// holds the prompt as Promptly wrote it, so reopening it doesn't ask Claude again.
export function getTargetVersions(prompt) {
  const entry = getHistory().find(h => h.prompt === prompt)
  const targets = entry && entry.targets
  return targets && typeof targets === 'object' && !Array.isArray(targets) ? targets : {}
}

export function saveTargetVersion(prompt, target, text) {
  const history = getHistory()
  const entry = history.find(h => h.prompt === prompt)
  if (!entry) return
  entry.targets = { ...(entry.targets || {}), [target]: text }
  store(history)
}
