import { useState, useRef, useEffect, useCallback } from 'react'
import useMode from './hooks/useMode.js'
import useWindowResize from './hooks/useWindowResize.js'
import IdleState from './components/IdleState.jsx'
import ShortcutsPanel from './components/ShortcutsPanel.jsx'
import RecordingState from './components/RecordingState.jsx'
import ThinkingState from './components/ThinkingState.jsx'
import PromptReadyState from './components/PromptReadyState.jsx'
import ErrorState from './components/ErrorState.jsx'

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',
  ERROR: 'ERROR',
  SHORTCUTS: 'SHORTCUTS',
}

const STATE_HEIGHTS = {
  IDLE: 118,
  RECORDING: 89,
  THINKING: 320,
  PROMPT_READY: 560,
  ERROR: 101,
  SHORTCUTS: 380,
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
  const prevStateRef = useRef(STATES.IDLE)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const isProcessingRef = useRef(false)
  const generatedPromptRef = useRef('')

  const { mode, setMode, modeLabel } = useMode()
  const { resizeWindow } = useWindowResize()

  // Resize window to IDLE height on initial mount
  useEffect(() => {
    resizeWindow(STATE_HEIGHTS.IDLE)
    console.log('window resized to', STATE_HEIGHTS.IDLE)
  }, [])

  // Keep stateRef in sync with currentState
  useEffect(() => {
    stateRef.current = currentState
  }, [currentState])

  // Keep generatedPromptRef in sync for stale-closure-safe access in keydown listener
  useEffect(() => {
    generatedPromptRef.current = generatedPrompt
  }, [generatedPrompt])

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
      else if (stateRef.current === STATES.SHORTCUTS) startRecordingRef.current()
    })

    window.electronAPI.onModeSelected((key) => {
      setMode(key)
    })

    window.electronAPI.onShowShortcuts(() => {
      prevStateRef.current = stateRef.current
      transition(STATES.SHORTCUTS)
    })
  }, [])

  // Window-focused keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      const meta = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        if (stateRef.current === STATES.RECORDING) {
          stopRecordingRef.current()
        } else if (stateRef.current === STATES.SHORTCUTS) {
          transition(prevStateRef.current || STATES.IDLE)
        } else if (stateRef.current !== STATES.IDLE) {
          transition(STATES.IDLE)
        }
        return
      }
      if (meta && e.key === 'c' && stateRef.current === STATES.PROMPT_READY) {
        e.preventDefault()
        if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPromptRef.current)
        return
      }
      if (meta && e.key === 'e' && stateRef.current === STATES.PROMPT_READY) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('export-prompt'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Right-click context menu on bar (mode menu)
  function handleContextMenu(e) {
    e.preventDefault()
    if (currentState !== STATES.IDLE) return
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  return (
    <div
      className="w-[520px] h-screen flex flex-col rounded-[18px] overflow-hidden relative bg-white/[0.04] border-t border-t-white/[0.18] border-l border-l-white/[0.10] border-r border-r-white/[0.06] border-b border-b-white/[0.04] backdrop-blur-[40px] shadow-[0_0_0_0.5px_rgba(255,255,255,0.06)_inset,0_32px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]"
      id="bar"
      onContextMenu={handleContextMenu}
    >
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.28] to-transparent pointer-events-none z-10" />
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
      {currentState === STATES.SHORTCUTS && (
        <>
          <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
          <ShortcutsPanel onClose={() => transition(prevStateRef.current || STATES.IDLE)} />
        </>
      )}
      <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[#FF3B30]/20 to-transparent pointer-events-none z-10" />
    </div>
  )
}
