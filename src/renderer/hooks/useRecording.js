import { useState, useRef, useCallback, useEffect } from 'react'

export default function useRecording({
  STATES,
  transitionRef,
  modeRef,
  polishToneRef,
  setThinkTranscript,
  onGenerateResult,
  isIterated,
  originalTranscript,
  isExpandedRef,
  setTranscriptionError,
}) {
  const [recSecs, setRecSecs] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isProcessingRef = useRef(false)
  const isPausedRef = useRef(false)
  const recTimerRef = useRef(null)

  function startTimer() {
    recTimerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000)
  }
  function pauseTimer() {
    clearInterval(recTimerRef.current)
    recTimerRef.current = null
  }
  function stopTimer() {
    clearInterval(recTimerRef.current)
    recTimerRef.current = null
    setRecSecs(0)
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.start()
      transitionRef.current(STATES.RECORDING)
      startTimer()
    } catch {
      transitionRef.current(STATES.ERROR, { message: 'Microphone access denied' })
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || isProcessingRef.current) return
    isProcessingRef.current = true

    stopTimer()
    isPausedRef.current = false
    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())

    recorder.onstop = async () => {
      isIterated.current = false
      setTranscriptionError?.(null)
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()

      setThinkTranscript('')
      transitionRef.current(STATES.THINKING)
      isProcessingRef.current = false

      if (!window.electronAPI) {
        transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
        return
      }

      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      if (!transcribeResult.success) {
        if (isExpandedRef?.current) {
          setTranscriptionError?.({
            error: transcribeResult.error || 'Unknown transcription error',
            timedOut: !!transcribeResult.timedOut,
            canRetry: true,
          })
          transitionRef.current(STATES.TRANSCRIPTION_ERROR)
        } else {
          transitionRef.current(STATES.ERROR, { message: 'Transcription failed — expand to retry' })
        }
        return
      }

      const text = transcribeResult.transcript.trim()
      if (!text) {
        transitionRef.current(STATES.IDLE)
        return
      }

      originalTranscript.current = text
      setThinkTranscript(text)

      const mode = modeRef.current
      const genResult = await window.electronAPI.generatePrompt(
        text,
        mode,
        mode === 'polish' ? { tone: polishToneRef.current } : undefined
      )
      onGenerateResult.current(genResult, text)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current = null
    }
    audioChunksRef.current = []
    isProcessingRef.current = false
    isPausedRef.current = false
    stopTimer()
    transitionRef.current(STATES.IDLE)
  }, [])

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      pauseTimer()
      recorder.pause()
      isPausedRef.current = true
      transitionRef.current(STATES.PAUSED)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'paused') {
      recorder.resume()
      isPausedRef.current = false
      startTimer()
      transitionRef.current(STATES.RECORDING)
    }
  }, [])

  const startRecordingRef = useRef(startRecording)
  const stopRecordingRef = useRef(stopRecording)
  const pauseRecordingRef = useRef(pauseRecording)
  const resumeRecordingRef = useRef(resumeRecording)
  useEffect(() => { startRecordingRef.current = startRecording }, [startRecording])
  useEffect(() => { stopRecordingRef.current = stopRecording }, [stopRecording])
  useEffect(() => { pauseRecordingRef.current = pauseRecording }, [pauseRecording])
  useEffect(() => { resumeRecordingRef.current = resumeRecording }, [resumeRecording])

  return {
    recSecs,
    startRecording,
    stopRecording,
    handleDismiss,
    pauseRecording,
    resumeRecording,
    startRecordingRef,
    stopRecordingRef,
    pauseRecordingRef,
    resumeRecordingRef,
    startTimer,
    stopTimer,
  }
}
