import { useCallback, useEffect } from 'react'
import { runStep } from '../utils/claudeStep.js'

export default function useOperationHandlers({
  STATES,
  stateRef,
  transitionRef,
  modeRef,
  polishToneRef,
  handleGenerateResultRef,
  originalTranscript,
  setThinkTranscript,
  opIdRef,
  handleDismiss,
  dismissIterating,
  handleImageStartOver,
  handleVideoStartOver,
  handleWorkflowStartOver,
  handleHarnessStartOver,
  setEmailOutput,
  setTranscriptionSlow,
  setGenerationSlow,
  contextRef,
}) {

  function handleAbort() {
    const s = stateRef.current
    if (s === STATES.IDLE || s === STATES.HISTORY || s === STATES.SETTINGS ||
        s === STATES.SHORTCUTS || s === STATES.ERROR) return
    if (s === STATES.RECORDING || s === STATES.PAUSED) { handleDismiss(); return }
    if (s === STATES.THINKING) {
      // Invalidate whatever is in flight and stop the Claude/Whisper process behind it.
      opIdRef.current++
      window.electronAPI?.cancelOperations?.()
      transitionRef.current(STATES.IDLE)
      return
    }
    if (s === STATES.ITERATING) { dismissIterating(); return }
    if (s === STATES.IMAGE_BUILDER || s === STATES.IMAGE_BUILDER_DONE) { handleImageStartOver(); return }
    if (s === STATES.VIDEO_BUILDER || s === STATES.VIDEO_BUILDER_DONE) { handleVideoStartOver(); return }
    if (s === STATES.WORKFLOW_BUILDER || s === STATES.WORKFLOW_BUILDER_DONE) { handleWorkflowStartOver(); return }
    if (s === STATES.HARNESS_BUILDER || s === STATES.HARNESS_BUILDER_DONE) { handleHarnessStartOver(); return }
    if (s === STATES.EMAIL_READY) { setEmailOutput(null); transitionRef.current(STATES.IDLE); return }
    transitionRef.current(STATES.IDLE)
  }

  const handleRetryTranscription = useCallback(async () => {
    if (!window.electronAPI) return
    const result = await runStep(opIdRef, () => window.electronAPI.retryTranscription())
    if (!result) return
    if (!result.success) { transitionRef.current(STATES.IDLE); return }
    const text = result.transcript?.trim()
    if (!text) { transitionRef.current(STATES.IDLE); return }

    originalTranscript.current = text
    setThinkTranscript(text)
    setTranscriptionSlow(false)
    transitionRef.current(STATES.THINKING)

    const genResult = await runStep(opIdRef, () => window.electronAPI.generatePrompt(text, modeRef.current, {
      ...(modeRef.current === 'polish' && { tone: polishToneRef.current }),
      ...(contextRef?.current && { context: contextRef.current }),
    }))
    if (genResult) handleGenerateResultRef.current(genResult, text)
  }, [])

  const handleRetryGeneration = useCallback(async () => {
    if (!window.electronAPI) return
    setThinkTranscript(originalTranscript.current)
    setGenerationSlow(false)
    transitionRef.current(STATES.THINKING)
    const result = await runStep(opIdRef, () => window.electronAPI.retryGeneration())
    if (result) handleGenerateResultRef.current(result, originalTranscript.current)
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onTranscriptionSlowWarning) return
    const unsub = window.electronAPI.onTranscriptionSlowWarning(() => setTranscriptionSlow(true))
    return () => unsub?.()
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onGenerationSlowWarning) return
    const unsub = window.electronAPI.onGenerationSlowWarning(() => setGenerationSlow(true))
    return () => unsub?.()
  }, [])

  return {
    handleAbort,
    handleRetryTranscription,
    handleRetryGeneration,
  }
}
