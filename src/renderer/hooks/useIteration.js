import { useRef, useCallback } from 'react'
import { recordingToWav, MIC_CONSTRAINTS, withTimeout } from '../utils/audio.js'

export default function useIteration({
  STATES,
  transitionRef,
  isExpandedRef,
  generatedPromptRef,
  modeRef,
  resultModeRef,
  isIterated,
  originalTranscript,
  setThinkTranscript,
  startTimer,
  stopTimer,
  getIterationBase,
  onRevised,
  contextRef,
  opIdRef,
}) {
  const iterRecorderRef = useRef(null)
  const iterChunksRef = useRef([])
  const iterIsProcessingRef = useRef(false)
  const iterationBase = useRef(null)
  // The callbacks below are made once; these always point at App's latest functions.
  const getIterationBaseRef = useRef(getIterationBase)
  getIterationBaseRef.current = getIterationBase
  const onRevisedRef = useRef(onRevised)
  onRevisedRef.current = onRevised

  const handleIterate = useCallback(async () => {
    let stream = null
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
      const recorder = new MediaRecorder(stream)
      iterRecorderRef.current = recorder
      iterChunksRef.current = []
      recorder.ondataavailable = (e) => iterChunksRef.current.push(e.data)
      // The microphone went away mid-refinement: finish with what was said.
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (iterRecorderRef.current === recorder) stopIteratingRef.current?.()
      }))
      // What's being refined: the prompt or polished text on screen, or the email draft. App
      // knows which (getIterationBase); the default is the prompt on screen.
      iterationBase.current = getIterationBaseRef.current?.() || { transcript: originalTranscript.current, prompt: generatedPromptRef.current, mode: resultModeRef?.current || modeRef.current, returnState: STATES.PROMPT_READY }
      isIterated.current = false
      recorder.start()
      stopTimer()
      startTimer()
      transitionRef.current(STATES.ITERATING)
    } catch {
      // Granted but couldn't record: release the microphone.
      stream?.getTracks().forEach((t) => t.stop())
      transitionRef.current(STATES.ERROR, { message: stream ? "Couldn't start recording" : 'Microphone access denied' })
    }
  }, [])

  const stopIterating = useCallback(async () => {
    const recorder = iterRecorderRef.current
    if (!recorder || iterIsProcessingRef.current) return
    iterIsProcessingRef.current = true
    stopTimer()
    const finish = async () => {
      // Once only: a later stop press or the microphone ending must not run it again.
      if (iterRecorderRef.current !== recorder) return
      iterRecorderRef.current = null
      // Tagged like every other operation: a dismiss or abort bumps opIdRef, and whatever this
      // refinement returns after that is ignored instead of replacing the screen.
      const opId = opIdRef ? ++opIdRef.current : 0
      const current = () => !opIdRef || opId === opIdRef.current
      try {
        await refine(current)
      } catch (err) {
        window.electronAPI?.log?.('error', `Refinement could not be finished: ${err?.message || err}`)
        if (current()) transitionRef.current(STATES.ERROR, { message: "Couldn't process that refinement" })
      } finally {
        iterIsProcessingRef.current = false
      }
    }
    const refine = async (current) => {
      const blob = new Blob(iterChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await withTimeout(recordingToWav(blob), 20000, 'Preparing the recording took too long')
      iterIsProcessingRef.current = false
      if (!current()) return

      if (!window.electronAPI) {
        transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
        return
      }
      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      if (!current()) return
      if (!transcribeResult?.success) {
        transitionRef.current(STATES.ERROR, { message: transcribeResult?.error || "Couldn't transcribe that" })
        return
      }
      const iterText = String(transcribeResult.transcript || '').trim()
      const base = iterationBase.current
      if (!iterText) {
        transitionRef.current(base.returnState || STATES.PROMPT_READY)
        return
      }
      setThinkTranscript(iterText)
      transitionRef.current(STATES.THINKING)

      // main/prompts/revise*.txt: the result on screen plus the spoken change, in the same shape.
      const genResult = await window.electronAPI.generatePrompt(iterText, base.mode, {
        revise: { previous: base.prompt, email: base.email || null, transcript: base.transcript },
        ...(base.tone && { tone: base.tone }),
        ...(contextRef?.current && { context: contextRef.current }),
      })
      if (!current() || genResult?.cancelled) return
      if (!genResult?.success) {
        transitionRef.current(STATES.ERROR, { message: genResult?.error || 'Claude error' })
        return
      }
      isIterated.current = true
      onRevisedRef.current(genResult, iterText, base)
    }
    // Already stopped on its own (the microphone went away): finish now; otherwise on stop.
    if (recorder.state === 'inactive') finish()
    else { recorder.onstop = finish; recorder.stop() }
    recorder.stream.getTracks().forEach((t) => t.stop())
  }, [])
  const stopIteratingRef = useRef(null)
  stopIteratingRef.current = stopIterating

  const dismissIterating = useCallback(() => {
    // Whatever a finished refinement is still waiting for (transcription, Claude) is now stale.
    if (opIdRef) opIdRef.current++
    const recorder = iterRecorderRef.current
    if (recorder) {
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
      iterRecorderRef.current = null
    }
    iterChunksRef.current = []
    iterIsProcessingRef.current = false
    stopTimer()
    transitionRef.current(iterationBase.current?.returnState || STATES.PROMPT_READY)
  }, [])

  return { iterationBase, handleIterate, stopIterating, dismissIterating }
}
