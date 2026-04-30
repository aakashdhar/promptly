import { useCallback } from 'react'

export default function useTextInput({
  STATES,
  transitionRef,
  isIterated,
  originalTranscript,
  setThinkTranscript,
  modeRef,
  polishToneRef,
  handleGenerateResultRef,
}) {
  const handleTypingSubmit = useCallback(async (typedText) => {
    isIterated.current = false
    originalTranscript.current = typedText
    setThinkTranscript(typedText)
    transitionRef.current(STATES.THINKING)

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const mode = modeRef.current
    const genResult = await window.electronAPI.generatePrompt(typedText, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
    handleGenerateResultRef.current(genResult, typedText)
  }, [])

  const handleRegenerate = useCallback(async () => {
    transitionRef.current(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const mode = modeRef.current
    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
    handleGenerateResultRef.current(genResult, originalTranscript.current)
  }, [])

  return { handleTypingSubmit, handleRegenerate }
}
