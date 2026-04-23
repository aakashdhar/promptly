import { useState, useRef, useEffect, useCallback } from 'react'
import usePolishTone from './useTone.js'
import { saveToHistory } from '../utils/history.js'

export function parsePolishOutput(raw) {
  const polishedMatch = raw.match(/POLISHED:\n([\s\S]*?)(?:\n\nCHANGES:|$)/)
  const changesMatch = raw.match(/CHANGES:\n([\s\S]*)$/)
  return {
    polished: polishedMatch ? polishedMatch[1].trim() : raw.trim(),
    changes: changesMatch
      ? changesMatch[1].trim().split('\n').filter(l => l.trim())
      : []
  }
}

export default function usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES }) {
  const [polishResult, setPolishResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const { tone: polishTone, setTone: setPolishToneValue } = usePolishTone()
  const polishToneRef = useRef(polishTone)

  useEffect(() => { polishToneRef.current = polishTone }, [polishTone])

  const handlePolishToneChange = useCallback(async (newTone) => {
    setPolishToneValue(newTone)
    transitionRef.current(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)
    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, 'polish', { tone: newTone })
    if (!genResult.success) {
      transitionRef.current(STATES.ERROR, { message: genResult.error || 'Claude error' })
      return
    }
    const parsed = parsePolishOutput(genResult.prompt)
    setPolishResult(parsed)
    setGeneratedPrompt(parsed.polished)
    saveToHistory({ transcript: originalTranscript.current, prompt: parsed.polished, mode: 'polish', polishChanges: parsed.changes })
    transitionRef.current(STATES.PROMPT_READY)
  }, [])

  return { polishResult, setPolishResult, copied, setCopied, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange }
}
