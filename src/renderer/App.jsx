import { useState, useRef, useEffect, useCallback } from 'react'
import useMode from './hooks/useMode.js'
import useWindowResize from './hooks/useWindowResize.js'
import IdleState from './components/IdleState.jsx'
import RecordingState from './components/RecordingState.jsx'
import ThinkingState from './components/ThinkingState.jsx'
import PromptReadyState from './components/PromptReadyState.jsx'
import ErrorState from './components/ErrorState.jsx'
import './styles/tokens.css'
import './styles/bar.css'
import './styles/states.css'

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',
  ERROR: 'ERROR',
}

const STATE_HEIGHTS = {
  IDLE: 101,
  RECORDING: 89,
  THINKING: 320,
  PROMPT_READY: 540,
  ERROR: 101,
}

function saveToHistory(transcript, prompt, mode) {
  const history = JSON.parse(localStorage.getItem('promptly_history') || '[]')
  history.unshift({
    id: Date.now(),
    transcript,
    prompt,
    mode,
    timestamp: new Date().toISOString(),
  })
  if (history.length > 100) history.splice(100)
  localStorage.setItem('promptly_history', JSON.stringify(history))
}

export default function App() {
  const [currentState, setCurrentState] = useState(STATES.IDLE)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [thinkTranscript, setThinkTranscript] = useState('')

  const originalTranscript = useRef('')
  const stateRef = useRef(STATES.IDLE)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isProcessingRef = useRef(false)

  const { mode, setMode, modeLabel } = useMode()
  const { resizeWindow } = useWindowResize()

  // Keep stateRef in sync with currentState
  useEffect(() => {
    stateRef.current = currentState
  }, [currentState])

  function transition(newState, payload = {}) {
    stateRef.current = newState
    setCurrentState(newState)
    if (payload.message) setErrorMessage(payload.message)
    resizeWindow(STATE_HEIGHTS[newState])
    if (window.electronAPI) {
      window.electronAPI.setWindowButtonsVisible(newState !== STATES.RECORDING)
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.start()
      transition(STATES.RECORDING)
    } catch {
      transition(STATES.ERROR, { message: 'Microphone access denied' })
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || isProcessingRef.current) return
    isProcessingRef.current = true

    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const arrayBuffer = await blob.arrayBuffer()

      setThinkTranscript('')
      transition(STATES.THINKING)
      isProcessingRef.current = false

      if (!window.electronAPI) {
        transition(STATES.ERROR, { message: 'Electron API not available' })
        return
      }

      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      if (!transcribeResult.success) {
        transition(STATES.ERROR, { message: transcribeResult.error })
        return
      }

      const text = transcribeResult.transcript.trim()
      if (!text) {
        transition(STATES.IDLE)
        return
      }

      originalTranscript.current = text
      setThinkTranscript(text)
      resizeWindow(320)

      const genResult = await window.electronAPI.generatePrompt(text, mode)
      if (!genResult.success) {
        transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
        return
      }

      setGeneratedPrompt(genResult.prompt)
      saveToHistory(text, genResult.prompt, mode)
      transition(STATES.PROMPT_READY)
    }
  }, [mode])

  const handleDismiss = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current = null
    }
    audioChunksRef.current = []
    isProcessingRef.current = false
    transition(STATES.IDLE)
  }, [])

  const handleRegenerate = useCallback(async () => {
    transition(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)
    resizeWindow(320)

    if (!window.electronAPI) {
      transition(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode)
    if (!genResult.success) {
      transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
      return
    }

    setGeneratedPrompt(genResult.prompt)
    saveToHistory(originalTranscript.current, genResult.prompt, mode)
    transition(STATES.PROMPT_READY)
  }, [mode])

  // Stable refs for IPC handlers (avoid stale closures)
  const startRecordingRef = useRef(startRecording)
  const stopRecordingRef = useRef(stopRecording)
  useEffect(() => { startRecordingRef.current = startRecording }, [startRecording])
  useEffect(() => { stopRecordingRef.current = stopRecording }, [stopRecording])

  // IPC listeners — mounted once
  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.getTheme().then(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    })

    window.electronAPI.onThemeChanged(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    })

    window.electronAPI.onShortcutTriggered(() => {
      if (stateRef.current === STATES.IDLE) startRecordingRef.current()
      else if (stateRef.current === STATES.RECORDING) stopRecordingRef.current()
    })

    window.electronAPI.onModeSelected((key) => {
      setMode(key)
    })
  }, [])

  // Right-click context menu on bar (mode menu)
  function handleContextMenu(e) {
    e.preventDefault()
    if (currentState !== STATES.IDLE) return
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  return (
    <div className="bar" id="bar" onContextMenu={handleContextMenu}>
      {currentState === STATES.IDLE && (
        <IdleState mode={mode} modeLabel={modeLabel} onStart={startRecording} />
      )}
      {currentState === STATES.RECORDING && (
        <RecordingState onStop={stopRecording} onDismiss={handleDismiss} />
      )}
      {currentState === STATES.THINKING && (
        <ThinkingState transcript={thinkTranscript} />
      )}
      {currentState === STATES.PROMPT_READY && (
        <PromptReadyState
          originalTranscript={originalTranscript.current}
          generatedPrompt={generatedPrompt}
          setGeneratedPrompt={setGeneratedPrompt}
          onRegenerate={handleRegenerate}
          onReset={() => transition(STATES.IDLE)}
          mode={mode}
        />
      )}
      {currentState === STATES.ERROR && (
        <ErrorState message={errorMessage} onDismiss={() => transition(STATES.IDLE)} />
      )}
    </div>
  )
}
