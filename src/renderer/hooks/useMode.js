import { useState, useEffect } from 'react'
import { MODES, DEFAULT_MODE, resolveModeKey } from '../utils/modes.js'

const MODE_LABELS = Object.fromEntries(MODES.map((m) => [m.key, m.label]))

export default function useMode() {
  // A mode saved by an older version may have been merged into another (Balanced → Prompt) or
  // no longer exist at all (e.g. "do" from 2.6.0): use its replacement, or the default.
  const [mode, setModeState] = useState(() => {
    const stored = resolveModeKey(localStorage.getItem('mode'))
    return stored && MODE_LABELS[stored] ? stored : DEFAULT_MODE
  })

  // The floating pill shows the current mode; main keeps a copy of its label.
  useEffect(() => { window.electronAPI?.reportMode?.(MODE_LABELS[mode] || MODE_LABELS[DEFAULT_MODE]) }, [mode])

  function setMode(m) {
    localStorage.setItem('mode', m)
    setModeState(m)
  }

  const modeLabel = MODE_LABELS[mode] || MODE_LABELS[DEFAULT_MODE]
  return { mode, setMode, modeLabel }
}
