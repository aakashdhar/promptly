import { useState, useRef, useCallback, useEffect } from 'react'
import { recordingToWav, MIC_CONSTRAINTS, withTimeout } from '../utils/audio.js'
import { detectSpokenMode } from '../utils/spokenMode.js'
import { setMicLevel } from '../utils/micLevel.js'

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
  setTranscriptionError,
  contextRef,
  setMode,
  onDiscardRef,
}) {
  const [recSecs, setRecSecs] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isProcessingRef = useRef(false)
  const isPausedRef = useRef(false)
  const recTimerRef = useRef(null)
  const levelMeterRef = useRef(null)
  const stopRequestedRef = useRef(false)
  const startingRef = useRef(false) // waiting for the microphone
  const startSeqRef = useRef(0) // bumped by a dismiss, so a start still waiting gives up

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
        const level = Math.min(1, Math.sqrt(sum / samples.length) * 5)
        setMicLevel(isPausedRef.current ? 0 : level)
        window.electronAPI?.sendAudioLevel?.(level)
      }, 60)
      levelMeterRef.current = { ctx, timer }
    } catch { /* the waveform is decoration; recording works without it */ }
  }
  function stopLevelMeter() {
    setMicLevel(0)
    const meter = levelMeterRef.current
    if (!meter) return
    clearInterval(meter.timer)
    meter.ctx.close().catch(() => {})
    levelMeterRef.current = null
  }

  function startTimer() {
    clearInterval(recTimerRef.current) // never two timers, or the clock runs double speed
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

  // Finishes a recording, whoever ended it: the stop button or hotkey, or the microphone itself
  // going away (AirPods disconnecting, the input switching), which stops the recorder on its own.
  // It runs once per recording, so nothing said is lost and the app can't be left "recording".
  const finishedRef = useRef(new WeakSet())
  const finishRecording = useCallback(async (recorder) => {
    if (finishedRef.current.has(recorder) || mediaRecorderRef.current !== recorder) return
    finishedRef.current.add(recorder)
    isProcessingRef.current = true
    stopTimer()
    stopLevelMeter()
    isPausedRef.current = false
    recorder.stream.getTracks().forEach((t) => t.stop())
    try {
      isIterated.current = false
      setTranscriptionError?.(null)
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await withTimeout(recordingToWav(blob), 20000, 'Preparing the recording took too long')
      // Dismissed while it was being prepared: throw it away rather than transcribe it.
      if (mediaRecorderRef.current !== recorder) return

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
      if (!transcribeResult?.success) {
        setTranscriptionError?.({
          error: transcribeResult?.error || 'Unknown transcription error',
          timedOut: !!transcribeResult?.timedOut,
          canRetry: true,
        })
        transitionRef.current(STATES.TRANSCRIPTION_ERROR)
        return
      }

      let text = String(transcribeResult.transcript || '').trim()
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
        ...((mode === 'polish' || String(mode).startsWith('project:')) && { tone: polishToneRef.current }),
        ...(contextRef?.current && { context: contextRef.current }),
      })
      onGenerateResult.current(genResult, text, opId)
    } catch (err) {
      // Never leave the app stuck: say what happened so the user can try again.
      window.electronAPI?.log?.('error', `Recording could not be finished: ${err?.message || err}`)
      isProcessingRef.current = false
      // Only if this recording is still what's on screen (not dismissed or superseded).
      if (mediaRecorderRef.current === recorder) transitionRef.current(STATES.ERROR, { message: "Couldn't process that recording" })
    }
  }, [])

  const startRecording = useCallback(async () => {
    // Already waiting for the microphone (start, stop, start in quick succession): one recorder
    // only, and the latest press wins, so it keeps recording.
    if (startingRef.current) { stopRequestedRef.current = false; return }
    startingRef.current = true
    // Context (app + selection) for this recording arrives from main just after it starts.
    if (contextRef) contextRef.current = null
    stopRequestedRef.current = false
    const seq = ++startSeqRef.current
    let stream = null
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    } catch {
      startingRef.current = false
      onDiscardRef?.current?.()
      if (seq === startSeqRef.current) transitionRef.current(STATES.ERROR, { message: 'Microphone access denied' })
      return
    }
    // Cancelled while the microphone was coming up.
    if (seq !== startSeqRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      startingRef.current = false
      return
    }
    try {
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      isProcessingRef.current = false
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.onstop = () => finishRecording(recorder)
      // The microphone went away mid-recording: keep what was said and finish.
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (mediaRecorderRef.current !== recorder || finishedRef.current.has(recorder)) return
        window.electronAPI?.log?.('warn', 'Microphone stopped mid-recording; finishing with what was recorded')
        if (recorder.state !== 'inactive') recorder.stop()
        else finishRecording(recorder)
      }))
      recorder.start()
      transitionRef.current(STATES.RECORDING)
      startTimer()
      startLevelMeter(stream)
      // Hold-to-talk released before the microphone was ready: stop right away.
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false
        stopRecordingRef.current()
      }
    } catch (err) {
      // The microphone was granted but recording couldn't start: release it.
      stream.getTracks().forEach((t) => t.stop())
      window.electronAPI?.log?.('error', `Recording could not start: ${err?.message || err}`)
      onDiscardRef?.current?.()
      transitionRef.current(STATES.ERROR, { message: "Couldn't start recording" })
    } finally {
      startingRef.current = false
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || isProcessingRef.current || finishedRef.current.has(recorder)) return
    isProcessingRef.current = true
    stopTimer()
    stopLevelMeter()
    isPausedRef.current = false
    // Already stopped on its own (the microphone went away): finish with what was recorded.
    if (recorder.state === 'inactive') finishRecording(recorder)
    else recorder.stop()
  }, [])

  // Stop now, or as soon as recording has actually started (hold-to-talk released early).
  const requestStop = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && (recorder.state === 'recording' || recorder.state === 'paused')) stopRecordingRef.current()
    // Stopped by itself but not finished yet: finish now instead of waiting forever.
    else if (recorder && !finishedRef.current.has(recorder)) finishRecording(recorder)
    else stopRequestedRef.current = true
  }, [])

  const handleDismiss = useCallback(() => {
    startSeqRef.current++
    onDiscardRef?.current?.()
    stopLevelMeter()
    stopRequestedRef.current = false
    const recorder = mediaRecorderRef.current
    if (recorder) {
      // Dismissed: stopping it must not transcribe it.
      mediaRecorderRef.current = null
      recorder.onstop = null
      if (recorder.state !== 'inactive') recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
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
