import { useState, useRef, useEffect, useCallback } from 'react'
import useMode from './hooks/useMode.js'
import usePolishMode, { parsePolishOutput } from './hooks/usePolishMode.js'
import useWindowResize from './hooks/useWindowResize.js'
import IdleState from './components/IdleState.jsx'
import ShortcutsPanel from './components/ShortcutsPanel.jsx'
import HistoryPanel from './components/HistoryPanel.jsx'
import RecordingState from './components/RecordingState.jsx'
import PausedState from './components/PausedState.jsx'
import ThinkingState from './components/ThinkingState.jsx'
import PromptReadyState from './components/PromptReadyState.jsx'
import PolishReadyState from './components/PolishReadyState.jsx'
import ErrorState from './components/ErrorState.jsx'
import IteratingState from './components/IteratingState.jsx'
import TypingState from './components/TypingState.jsx'
import { saveToHistory } from './utils/history.js'

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',
  ERROR: 'ERROR',
  SHORTCUTS: 'SHORTCUTS',
  HISTORY: 'HISTORY',
  ITERATING: 'ITERATING',
  TYPING: 'TYPING',
}

const STATE_HEIGHTS = {
  IDLE: 118,
  RECORDING: 89,
  PAUSED: 89,
  THINKING: 320,
  PROMPT_READY: 560,
  ERROR: 101,
  SHORTCUTS: 380,
  HISTORY: 720,
  ITERATING: 200,
  TYPING: 220,
}

export default function App() {
  const [currentState, setCurrentState] = useState(STATES.IDLE)
  const [displayState, setDisplayState] = useState(STATES.IDLE)
  const [stateClass, setStateClass] = useState('')
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
  const isPausedRef = useRef(false)
  const iterationBase = useRef(null)
  const isIterated = useRef(false)
  const iterRecorderRef = useRef(null)
  const iterChunksRef = useRef([])
  const iterIsProcessingRef = useRef(false)
  const recTimerRef = useRef(null)
  const transitionTimerRef = useRef(null)
  const transitionRef = useRef(null)
  const [recSecs, setRecSecs] = useState(0)

  const { mode, setMode, modeLabel } = useMode()
  const { resizeWindow } = useWindowResize()

  // POLISH-001: animate between states
  function animateToState(newState) {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    setStateClass('state-exit')
    transitionTimerRef.current = setTimeout(() => {
      setDisplayState(newState)
      setStateClass('state-enter')
      transitionTimerRef.current = setTimeout(() => {
        setStateClass('')
        transitionTimerRef.current = null
      }, 200)
    }, 120)
  }

  useEffect(() => {
    resizeWindow(STATE_HEIGHTS.IDLE)
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  useEffect(() => { stateRef.current = currentState }, [currentState])
  useEffect(() => { generatedPromptRef.current = generatedPrompt }, [generatedPrompt])

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

  function transition(newState, payload = {}) {
    stateRef.current = newState
    setCurrentState(newState)
    if (payload.message) setErrorMessage(payload.message)
    resizeWindow(STATE_HEIGHTS[newState])
    if (window.electronAPI) {
      window.electronAPI.setWindowButtonsVisible(
        newState !== STATES.RECORDING &&
        newState !== STATES.PAUSED &&
        newState !== STATES.ITERATING
      )
    }
    animateToState(newState)
  }

  transitionRef.current = transition

  const { polishResult, setPolishResult, copied, setCopied, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange } = usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.start()
      transition(STATES.RECORDING)
      startTimer()
    } catch {
      transition(STATES.ERROR, { message: 'Microphone access denied' })
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

      const genResult = await window.electronAPI.generatePrompt(text, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
      if (!genResult.success) {
        transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
        return
      }

      if (mode === 'polish') {
        const parsed = parsePolishOutput(genResult.prompt)
        setPolishResult(parsed)
        setGeneratedPrompt(parsed.polished)
        saveToHistory({ transcript: text, prompt: parsed.polished, mode, polishChanges: parsed.changes })
      } else {
        setPolishResult(null)
        setGeneratedPrompt(genResult.prompt)
        saveToHistory({ transcript: text, prompt: genResult.prompt, mode })
      }
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
    isPausedRef.current = false
    stopTimer()
    transition(STATES.IDLE)
  }, [])

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      pauseTimer()
      recorder.pause()
      isPausedRef.current = true
      transition(STATES.PAUSED)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'paused') {
      recorder.resume()
      isPausedRef.current = false
      startTimer()
      transition(STATES.RECORDING)
    }
  }, [])

  function openHistory() {
    prevStateRef.current = stateRef.current
    if (window.electronAPI) window.electronAPI.setWindowSize(746, STATE_HEIGHTS.HISTORY)
    setCurrentState(STATES.HISTORY)
    stateRef.current = STATES.HISTORY
    if (window.electronAPI) window.electronAPI.setWindowButtonsVisible(true)
    animateToState(STATES.HISTORY)
  }
  function closeHistory() {
    if (window.electronAPI) window.electronAPI.setWindowSize(520, STATE_HEIGHTS.IDLE)
    setCurrentState(STATES.IDLE)
    stateRef.current = STATES.IDLE
    if (window.electronAPI) window.electronAPI.setWindowButtonsVisible(true)
    animateToState(STATES.IDLE)
  }

  const handleTypingSubmit = useCallback(async (typedText) => {
    isIterated.current = false
    originalTranscript.current = typedText
    setThinkTranscript(typedText)
    transition(STATES.THINKING)

    if (!window.electronAPI) {
      transition(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const genResult = await window.electronAPI.generatePrompt(typedText, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
    if (!genResult.success) {
      transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
      return
    }

    if (mode === 'polish') {
      const parsed = parsePolishOutput(genResult.prompt)
      setPolishResult(parsed)
      setGeneratedPrompt(parsed.polished)
      saveToHistory({ transcript: typedText, prompt: parsed.polished, mode, polishChanges: parsed.changes })
    } else {
      setPolishResult(null)
      setGeneratedPrompt(genResult.prompt)
      saveToHistory({ transcript: typedText, prompt: genResult.prompt, mode })
    }
    transition(STATES.PROMPT_READY)
  }, [mode])

  const handleRegenerate = useCallback(async () => {
    transition(STATES.THINKING)
    setThinkTranscript(originalTranscript.current)

    if (!window.electronAPI) {
      transition(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const genResult = await window.electronAPI.generatePrompt(originalTranscript.current, mode, mode === 'polish' ? { tone: polishToneRef.current } : undefined)
    if (!genResult.success) {
      transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
      return
    }

    if (mode === 'polish') {
      const parsed = parsePolishOutput(genResult.prompt)
      setPolishResult(parsed)
      setGeneratedPrompt(parsed.polished)
      saveToHistory({ transcript: originalTranscript.current, prompt: parsed.polished, mode, polishChanges: parsed.changes })
    } else {
      setPolishResult(null)
      setGeneratedPrompt(genResult.prompt)
      saveToHistory({ transcript: originalTranscript.current, prompt: genResult.prompt, mode })
    }
    transition(STATES.PROMPT_READY)
  }, [mode])

  const handleIterate = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const recorder = new MediaRecorder(stream)
      iterRecorderRef.current = recorder
      iterChunksRef.current = []
      recorder.ondataavailable = (e) => iterChunksRef.current.push(e.data)
      iterationBase.current = { transcript: originalTranscript.current, prompt: generatedPrompt, mode }
      isIterated.current = false
      recorder.start()
      stopTimer()
      setRecSecs(0)
      startTimer()
      transition(STATES.ITERATING)
    } catch {
      transition(STATES.ERROR, { message: 'Microphone access denied' })
    }
  }, [generatedPrompt, mode])

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
        transition(STATES.ERROR, { message: 'Electron API not available' })
        return
      }
      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
      if (!transcribeResult.success) {
        transition(STATES.ERROR, { message: transcribeResult.error })
        return
      }
      const iterText = transcribeResult.transcript.trim()
      if (!iterText) {
        transition(STATES.PROMPT_READY)
        return
      }
      setThinkTranscript(iterText)
      transition(STATES.THINKING)
      resizeWindow(320)

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
        transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
        return
      }
      isIterated.current = true
      originalTranscript.current = iterText
      setGeneratedPrompt(genResult.prompt)
      saveToHistory({ transcript: iterText, prompt: genResult.prompt, mode, isIteration: true, basedOn: iterationBase.current.prompt.slice(0, 100) })
      transition(STATES.PROMPT_READY)
    }
  }, [mode])

  function dismissIterating() {
    const recorder = iterRecorderRef.current
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop())
      iterRecorderRef.current = null
    }
    iterChunksRef.current = []
    iterIsProcessingRef.current = false
    stopTimer()
    transition(STATES.PROMPT_READY)
  }

  const startRecordingRef = useRef(startRecording)
  const stopRecordingRef = useRef(stopRecording)
  const pauseRecordingRef = useRef(pauseRecording)
  const resumeRecordingRef = useRef(resumeRecording)
  useEffect(() => { startRecordingRef.current = startRecording }, [startRecording])
  useEffect(() => { stopRecordingRef.current = stopRecording }, [stopRecording])
  useEffect(() => { pauseRecordingRef.current = pauseRecording }, [pauseRecording])
  useEffect(() => { resumeRecordingRef.current = resumeRecording }, [resumeRecording])

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

    window.electronAPI.onShowHistory(() => {
      openHistory()
    })

    window.electronAPI.onShortcutPause(() => {
      if (stateRef.current === STATES.RECORDING) pauseRecordingRef.current()
      else if (stateRef.current === STATES.PAUSED) resumeRecordingRef.current()
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      const meta = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        if (stateRef.current === STATES.RECORDING) {
          stopRecordingRef.current()
        } else if (stateRef.current === STATES.SHORTCUTS) {
          transition(prevStateRef.current || STATES.IDLE)
        } else if (stateRef.current === STATES.HISTORY) {
          closeHistory()
        } else if (stateRef.current !== STATES.IDLE) {
          transition(STATES.IDLE)
        }
        return
      }
      if (meta && e.key === 'h' &&
          stateRef.current !== STATES.RECORDING &&
          stateRef.current !== STATES.HISTORY) {
        e.preventDefault()
        openHistory()
        return
      }
      if (meta && e.key === 't' && stateRef.current === STATES.IDLE) {
        e.preventDefault()
        transition(STATES.TYPING)
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

  const recM = Math.floor(recSecs / 60)
  const recS = recSecs % 60
  const duration = `${recM}:${String(recS).padStart(2, '0')}`

  function handleContextMenu(e) {
    e.preventDefault()
    if (currentState !== STATES.IDLE) return
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  return (
    <div
      style={{width:'100%', height:'100vh', display:'flex', flexDirection:'column', borderRadius:'18px', overflow:'hidden', position:'relative', background:'linear-gradient(135deg, #0A0A14 0%, #0D0A18 50%, #0A0A14 100%)', borderTop:'1px solid rgba(255,255,255,0.18)', borderLeft:'1px solid rgba(255,255,255,0.10)', borderRight:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.04)', boxShadow:'0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)'}}
      id="bar"
      onContextMenu={handleContextMenu}
    >
      <div style={{position:'absolute',top:'-60px',right:'-40px',width:'280px',height:'280px',borderRadius:'50%',background:'radial-gradient(circle, rgba(10,132,255,0.08) 0%, transparent 70%)',pointerEvents:'none',zIndex:-1}} />
      <div style={{position:'absolute',bottom:'-60px',left:'-40px',width:'240px',height:'240px',borderRadius:'50%',background:'radial-gradient(circle, rgba(120,40,200,0.1) 0%, transparent 70%)',pointerEvents:'none',zIndex:-1}} />
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/[0.28] to-transparent pointer-events-none z-10" />

      {/* POLISH-001: animated state wrapper */}
      <div
        className={stateClass}
        style={{flex:1, display:'flex', flexDirection:'column', position:'relative', minHeight:0, overflow:'hidden'}}
      >
        {displayState === STATES.IDLE && (
          <IdleState
            mode={mode}
            modeLabel={modeLabel}
            onStart={startRecording}
            onTypePrompt={() => transition(STATES.TYPING)}
            polishTone={polishTone}
            onPolishToneChange={setPolishToneValue}
          />
        )}
        {displayState === STATES.RECORDING && (
          <RecordingState onStop={stopRecording} onDismiss={handleDismiss} onPause={pauseRecording} duration={duration} />
        )}
        {displayState === STATES.PAUSED && (
          <PausedState duration={duration} onResume={resumeRecording} onStop={stopRecording} onDismiss={handleDismiss} />
        )}
        {displayState === STATES.ITERATING && (
          <IteratingState
            contextText={iterationBase.current?.transcript || ''}
            duration={duration}
            onStop={stopIterating}
            onDismiss={dismissIterating}
          />
        )}
        {displayState === STATES.TYPING && (
          <>
            <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
            <TypingState
              onDismiss={(target) => {
                if (target === 'voice') startRecording()
                else transition(STATES.IDLE)
              }}
              onSubmit={handleTypingSubmit}
              resizeWindow={resizeWindow}
            />
          </>
        )}
        {displayState === STATES.THINKING && (
          <ThinkingState transcript={thinkTranscript} />
        )}
        {displayState === STATES.PROMPT_READY && mode !== 'polish' && (
          <PromptReadyState
            originalTranscript={originalTranscript.current}
            generatedPrompt={generatedPrompt}
            setGeneratedPrompt={setGeneratedPrompt}
            onRegenerate={handleRegenerate}
            onReset={() => transition(STATES.IDLE)}
            mode={mode}
            onIterate={handleIterate}
            isIterated={isIterated.current}
          />
        )}
        {displayState === STATES.PROMPT_READY && mode === 'polish' && (
          <PolishReadyState
            polished={polishResult?.polished || generatedPrompt}
            changes={polishResult?.changes || []}
            transcript={originalTranscript.current}
            tone={polishTone}
            onReset={() => { setCopied(false); transition(STATES.IDLE) }}
            onCopy={() => {
              navigator.clipboard.writeText(polishResult?.polished || generatedPrompt)
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
            copied={copied}
            onToneChange={handlePolishToneChange}
          />
        )}
        {displayState === STATES.ERROR && (
          <ErrorState message={errorMessage} onDismiss={() => transition(STATES.IDLE)} />
        )}
        {displayState === STATES.SHORTCUTS && (
          <>
            <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
            <ShortcutsPanel onClose={() => transition(prevStateRef.current || STATES.IDLE)} />
          </>
        )}
        {displayState === STATES.HISTORY && (
          <>
            <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
            <HistoryPanel
              onClose={closeHistory}
              onReuse={(entry) => {
                originalTranscript.current = entry.transcript
                setGeneratedPrompt(entry.prompt)
                if (entry.mode === 'polish') {
                  setPolishResult({ polished: entry.prompt, changes: entry.polishChanges || [] })
                } else {
                  setPolishResult(null)
                }
                if (window.electronAPI) window.electronAPI.setWindowSize(520, STATE_HEIGHTS.PROMPT_READY)
                transition(STATES.PROMPT_READY)
              }}
            />
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[#FF3B30]/20 to-transparent pointer-events-none z-10" />
    </div>
  )
}
