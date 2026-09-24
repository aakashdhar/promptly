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
  opIdRef,
  contextRef,
}) {
  const handleTypingSubmit = useCallback(async (typedText) => {
    isIterated.current = false
    // Typed input has no captured app or selection.
    if (contextRef) contextRef.current = null
    originalTranscript.current = typedText
    setThinkTranscript(typedText)
    transitionRef.current(STATES.THINKING)
    const opId = ++opIdRef.current

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const mode = modeRef.current
    const genResult = await window.electronAPI.generatePrompt(typedText, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
    handleGenerateResultRef.current(genResult, typedText, opId)
  }, [])

  const handleRegenerate = useCallback(async () => {
    transitionRef.current(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)
    const opId = ++opIdRef.current

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const mode = modeRef.current
    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode, {
      ...(mode === 'polish' && { tone: polishToneRef.current }),
      ...(contextRef?.current && { context: contextRef.current }),
    })
    handleGenerateResultRef.current(genResult, originalTranscript.current, opId)
  }, [])

  return { handleTypingSubmit, handleRegenerate }
}
