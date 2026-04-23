import { useState } from 'react'

const TONE_KEY = 'promptly_polish_tone'

export function getPolishTone() {
  return localStorage.getItem(TONE_KEY) || 'formal'
}

export function setPolishTone(tone) {
  localStorage.setItem(TONE_KEY, tone)
}

export default function usePolishTone() {
  const [tone, setToneState] = useState(() => getPolishTone())

  function setTone(t) {
    setPolishTone(t)
    setToneState(t)
  }

  return { tone, setTone }
}
