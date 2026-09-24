import { useState, useRef, useCallback, useEffect } from 'react'
import { recordingToWav } from '../utils/audio.js'
import { detectSpokenMode } from '../utils/spokenMode.js'

export default function useRecording({
  STATES,
  transitionRef,
  modeRef,
  polishToneRef,
  setThinkTranscript,
  setThinkingAccentColor,
  setThinkingLabel,
  onGenerateResult,
  opIdRef,
  isIterated,
  originalTranscript,
  isExpandedRef,
  setTranscriptionError,
  contextRef,
  setMode,
}) {
  const [recSecs, setRecSecs] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isProcessingRef = useRef(false)
  const isPausedRef = useRef(false)
  const recTimerRef = useRef(null)
  const levelMeterRef = useRef(null)
  const stopRequestedRef = useRef(false)

  // Sends the microphone level ~16x a second, for the floating pill's waveform.
  function startLevelMeter(stream) {
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
        window.electronAPI?.sendAudioLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 5))
      }, 60)
      levelMeterRef.current = { ctx, timer }
    } catch { /* the waveform is decoration; recording works without it */ }
  }
  function stopLevelMeter() {
    const meter = levelMeterRef.current
    if (!meter) return
    clearInterval(meter.timer)
    meter.ctx.close().catch(() => {})
    levelMeterRef.current = null
  }

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
    // Context (app + selection) for this recording arrives from main just after it starts.
    if (contextRef) contextRef.current = null
    stopRequestedRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.start()
      transitionRef.current(STATES.RECORDING)
      startTimer()
      startLevelMeter(stream)
      // Hold-to-talk released before the microphone was ready: stop right away.
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false
        stopRecordingRef.current()
      }
    } catch {
      transitionRef.current(STATES.ERROR, { message: 'Microphone access denied' })
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || isProcessingRef.current) return
    isProcessingRef.current = true

    stopTimer()
    stopLevelMeter()
    isPausedRef.current = false
    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())

    recorder.onstop = async () => {
      isIterated.current = false
      setTranscriptionError?.(null)
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await recordingToWav(blob)

      setThinkTranscript('')
      if (modeRef.current === 'email') {
        setThinkingAccentColor?.('rgba(20,184,166,0.85)')
        setThinkingLabel?.('Drafting your email...')
      }
      transitionRef.current(STATES.THINKING)
      isProcessingRef.current = false
      const opId = ++opIdRef.current

      if (!window.electronAPI) {
        transitionRef.current(STATES.ERROR, { message: 'Electron API not available' })
        return
      }

      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      // The user aborted (or started something else) while Whisper was running.
      if (opId !== opIdRef.current) return
      if (!transcribeResult.success) {
        if (isExpandedRef?.current) {
          setTranscriptionError?.({
            error: transcribeResult.error || 'Unknown transcription error',
            timedOut: !!transcribeResult.timedOut,
            canRetry: true,
          })
          transitionRef.current(STATES.TRANSCRIPTION_ERROR)
        } else {
          transitionRef.current(STATES.ERROR, { message: "Couldn't transcribe that" })
        }
        return
      }

      let text = transcribeResult.transcript.trim()
      if (!text) {
        transitionRef.current(STATES.IDLE)
        return
      }
      // "Code mode, …" / "Email mode: …" switches mode for this and later recordings.
      const spoken = detectSpokenMode(text)
      if (spoken) {
        modeRef.current = spoken.mode
        setMode?.(spoken.mode)
        text = spoken.text
      }

      originalTranscript.current = text
      setThinkTranscript(text)

      const mode = modeRef.current
      const genResult = await window.electronAPI.generatePrompt(text, mode, {
        ...(mode === 'polish' && { tone: polishToneRef.current }),
        ...(contextRef?.current && { context: contextRef.current }),
      })
      onGenerateResult.current(genResult, text, opId)
    }
  }, [])

  // Stop now, or as soon as recording has actually started (hold-to-talk released early).
  const requestStop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) stopRecordingRef.current()
    else stopRequestedRef.current = true
  }, [])

  const handleDismiss = useCallback(() => {
    stopLevelMeter()
    stopRequestedRef.current = false
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
    requestStop,
  }
}
