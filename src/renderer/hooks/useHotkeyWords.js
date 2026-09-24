import { useState, useEffect } from 'react'

// Until main answers: the default shortcut, so the first paint never shows a different one.
const FALLBACK = { short: 'double-tap ⌃', action: 'Double-tap Control', needsAccess: false }

// How the talk shortcut is named in hints ("Double-tap Control and talk"). It follows Settings and
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
