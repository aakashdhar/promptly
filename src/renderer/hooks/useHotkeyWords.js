import { useState, useEffect } from 'react'

const FALLBACK = { short: '⌥ Space', action: 'Press ⌥ Space' }

// How the talk shortcut is named in hints ("Double-tap ⌃ and talk"). It follows Settings and
// changes when Accessibility is allowed (a key that needs the helper falls back to ⌥ Space).
export default function useHotkeyWords() {
  const [words, setWords] = useState(FALLBACK)
  useEffect(() => {
    if (!window.electronAPI?.getPreferences) return
    const refresh = () => window.electronAPI.getPreferences().then((p) => { if (p?.hotkeyWords) setWords(p.hotkeyWords) }).catch(() => {})
    refresh()
    window.addEventListener('focus', refresh)
    const unsub = window.electronAPI.onAccessibilityChanged?.(refresh)
    return () => { window.removeEventListener('focus', refresh); unsub?.() }
  }, [])
  return words
}
