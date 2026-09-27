import { useCallback } from 'react'
import { runStep } from '../utils/claudeStep.js'

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

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const mode = modeRef.current
    // Typing in Dictation mode means you want a prompt: there's nothing to transcribe.
    if (mode === 'dictate' && typedDictationRef?.current) { opIdRef.current++; typedDictationRef.current(typedText); return }
    const genResult = await runStep(opIdRef, () => window.electronAPI.generatePrompt(typedText, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined))
    if (genResult) handleGenerateResultRef.current(genResult, typedText)
  }, [])

  const handleRegenerate = useCallback(async () => {
    transitionRef.current(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)

    if (!window.electronAPI) {
      transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    // Regenerate the result on screen in the mode it was made in (a prompt made from a
    // dictation, or reopened from history, may differ from the mode selected now).
    const mode = resultModeRef?.current || modeRef.current
    const genResult = await runStep(opIdRef, () => window.electronAPI.generatePrompt(originalTranscript.current, mode, {
      ...(mode === 'polish' && { tone: polishToneRef.current }),
      ...(contextRef?.current && { context: contextRef.current }),
    }))
    if (genResult) handleGenerateResultRef.current(genResult, originalTranscript.current, undefined, mode)
  }, [])

  return { handleTypingSubmit, handleRegenerate }
}
