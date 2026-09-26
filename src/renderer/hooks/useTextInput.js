import { useCallback } from 'react'

export default function useTextInput({
  STATES,
  transitionRef,
  isIterated,
  originalTranscript,
  setThinkTranscript,
  modeRef,
  resultModeRef,
  polishToneRef,
  handleGenerateResultRef,
  opIdRef,
  contextRef,
  typedDictationRef,
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
    // Typing in Dictation mode means you want a prompt: there's nothing to transcribe.
    if (mode === 'dictate' && typedDictationRef?.current) { typedDictationRef.current(typedText); return }
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

    // Regenerate the result on screen in the mode it was made in (a prompt made from a
    // dictation, or reopened from history, may differ from the mode selected now).
    const mode = resultModeRef?.current || modeRef.current
    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode, {
      ...(mode === 'polish' && { tone: polishToneRef.current }),
      ...(contextRef?.current && { context: contextRef.current }),
    })
    handleGenerateResultRef.current(genResult, originalTranscript.current, opId, mode)
  }, [])

  return { handleTypingSubmit, handleRegenerate }
}
