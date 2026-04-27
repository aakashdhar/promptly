import { useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'

export default function useIteration({
  STATES,
  transitionRef,
  resizeWindow,
  isExpandedRef,
  generatedPromptRef,
  modeRef,
  isIterated,
  originalTranscript,
  setThinkTranscript,
  setGeneratedPrompt,
  startTimer,
  stopTimer,
}) {
  const iterRecorderRef = useRef(null)
  const iterChunksRef = useRef([])
  const iterIsProcessingRef = useRef(false)
  const iterationBase = useRef(null)

  const handleIterate = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recorder = new MediaRecorder(stream)
      iterRecorderRef.current = recorder
      iterChunksRef.current = []
      recorder.ondataavailable = (e) => iterChunksRef.current.push(e.data)
      iterationBase.current = { transcript: originalTranscript.current, prompt: generatedPromptRef.current, mode: modeRef.current }
      isIterated.current = false
      recorder.start()
      stopTimer()
      startTimer()
      transitionRef.current(STATES.ITERATING)
    } catch {
      transitionRef.current(STATES.ERROR, { message: 'Microphone access denied' })
    }
  }, [])

  const stopIterating = useCallback(async () => {
    const recorder = iterRecorderRef.current
    if (!recorder || iterIsProcessingRef.current) return
    iterIsProcessingRef.current = true
    stopTimer()
    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())

    recorder.onstop = async () => {
      const blob = new Blob(iterChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      iterIsProcessingRef.current = false

      if (!window.electronAPI) {
        transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
        return
      }
      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      if (!transcribeResult.success) {
        transitionRef.current(STATES.ERROR, { message: transcribeResult.error })
        return
      }
      const iterText = transcribeResult.transcript.trim()
      if (!iterText) {
        transitionRef.current(STATES.PROMPT_READY)
        return
      }
      setThinkTranscript(iterText)
      transitionRef.current(STATES.THINKING)
      if (!isExpandedRef.current) resizeWindow(320)

      const iterationSystemPrompt = `You are an expert Claude prompt engineer. You have a previously generated prompt and the user has spoken a refinement.

Your job is to produce an improved version of the original prompt that incorporates the user's new input precisely.

Rules:
1. Output ONLY the improved prompt. No preamble. No explanation.
2. Preserve everything from the original prompt that the user did not ask to change.
3. Apply the user's new input as precisely as possible.
4. Keep the same structure and section labels as the original prompt.
5. If the new input contradicts the original, the new input wins.
6. Do not add new sections unless the new input clearly calls for them.

Original prompt:
${iterationBase.current.prompt}

User's new input:
"${iterText}"

Mode: ${iterationBase.current.mode}`

      const genResult = await window.electronAPI.generateRaw(iterationSystemPrompt)
      if (!genResult.success) {
        transitionRef.current(STATES.ERROR, { message: genResult.error || 'Claude error' })
        return
      }
      isIterated.current = true
      originalTranscript.current = iterText
      setGeneratedPrompt(genResult.prompt)
      saveToHistory({ transcript: iterText, prompt: genResult.prompt, mode: modeRef.current, isIteration: true, basedOn: iterationBase.current.prompt.slice(0, 100) })
      transitionRef.current(STATES.PROMPT_READY)
    }
  }, [])

  function dismissIterating() {
    const recorder = iterRecorderRef.current
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop())
      iterRecorderRef.current = null
    }
    iterChunksRef.current = []
    iterIsProcessingRef.current = false
    stopTimer()
    transitionRef.current(STATES.PROMPT_READY)
  }

  return { iterationBase, handleIterate, stopIterating, dismissIterating }
}
