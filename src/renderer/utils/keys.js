// Key names for the system Promptly runs on, from main/keys.js via get-platform.
// Starts as the Mac set (identical to main's), so nothing changes on a Mac if the call fails.
export const keys = { os: 'darwin', mod: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧', enter: '↵' }

// Called once before the first render (main.jsx).
export async function loadKeys() {
  try {
    const platformKeys = await window.electronAPI?.getPlatform?.()
    if (platformKeys) Object.assign(keys, platformKeys)
  } catch { /* keep the Mac set */ }
  return keys
}

// combo(keys.mod, 'T') → '⌘T' on a Mac, 'Ctrl+T' on Windows (same rule as main's formatCombo).
export function combo(...parts) {
  if (keys.os === 'win32') return parts.filter((p, i) => parts.indexOf(p) === i).join('+')
  return parts.map((p, i) => (i > 0 && p.length > 1 ? ` ${p}` : p)).join('')
}

// Two shortcuts that aren't simply Cmd on a Mac and Ctrl on Windows, with the labels that name them.
// Generate: ⌘↵ / Ctrl+Enter. Hide history: ⌃⌘S on a Mac; Ctrl+Shift+S on Windows, where ⌃ and ⌘
// are the same key (and Ctrl+S alone reads as Save).
export function isGenerateKey(e) {
  return e.key === 'Enter' && (keys.os === 'win32' ? e.ctrlKey : e.metaKey)
}

export const historyToggleKeys = () => (keys.os === 'win32' ? [keys.ctrl, keys.shift, 'S'] : [keys.ctrl, keys.mod, 'S'])

export function isHistoryToggleKey(e) {
  if (e.key.toLowerCase() !== 's') return false
  return keys.os === 'win32' ? e.ctrlKey && e.shiftKey && !e.altKey : e.ctrlKey && e.metaKey
}
