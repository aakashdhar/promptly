import { useState } from 'react'
import MODES from '../../../shared/modes.json'

const MODE_LABELS = Object.fromEntries(MODES.modes.map((m) => [m.key, m.label]))
const DEFAULT_MODE = MODES.defaultMode

export default function useMode() {
  const [mode, setModeState] = useState(() => localStorage.getItem('mode') || DEFAULT_MODE)

  function setMode(m) {
    localStorage.setItem('mode', m)
    setModeState(m)
  }

  const modeLabel = MODE_LABELS[mode] || MODE_LABELS[DEFAULT_MODE]
  return { mode, setMode, modeLabel }
}
