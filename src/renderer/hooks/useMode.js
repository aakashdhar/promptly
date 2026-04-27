import { useState } from 'react'

const MODE_LABELS = {
  balanced: 'Balanced',
  detailed: 'Detailed',
  concise: 'Concise',
  chain: 'Chain',
  code: 'Code',
  design: 'Design',
  refine: 'Refine',
  polish: 'Polish',
  image: 'Image',
}

export default function useMode() {
  const [mode, setModeState] = useState(() => localStorage.getItem('mode') || 'balanced')

  function setMode(m) {
    localStorage.setItem('mode', m)
    setModeState(m)
  }

  const modeLabel = MODE_LABELS[mode] || 'Balanced'
  return { mode, setMode, modeLabel }
}
