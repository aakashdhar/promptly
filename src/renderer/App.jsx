import { useState, useRef, useEffect, useCallback } from 'react'
import useMode from './hooks/useMode.js'
import usePolishMode, { parsePolishOutput } from './hooks/usePolishMode.js'
import useWindowResize from './hooks/useWindowResize.js'
import useRecording from './hooks/useRecording.js'
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'
import useIteration from './hooks/useIteration.js'
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
import SettingsPanel from './components/SettingsPanel.jsx'
import ExpandedView from './components/ExpandedView.jsx'
import ImageBuilderState, { QUESTIONS as IMAGE_QUESTIONS } from './components/ImageBuilderState.jsx'
import ImageBuilderDoneState from './components/ImageBuilderDoneState.jsx'
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
  SETTINGS: 'SETTINGS',
  IMAGE_BUILDER: 'IMAGE_BUILDER',
  IMAGE_BUILDER_DONE: 'IMAGE_BUILDER_DONE',
}

const STATE_HEIGHTS = {
  IDLE: 134,
  RECORDING: 89,
  PAUSED: 89,
  THINKING: 320,
  PROMPT_READY: 560,
  ERROR: 101,
  SHORTCUTS: 380,
  HISTORY: 720,
  ITERATING: 200,
  TYPING: 244,
  SETTINGS: 322,
  EXPANDED: 860,
  IMAGE_BUILDER: 380,
  IMAGE_BUILDER_DONE: 380,
}

export default function App() {
  const [currentState, setCurrentState] = useState(STATES.IDLE)
  const [displayState, setDisplayState] = useState(STATES.IDLE)
  const [stateClass, setStateClass] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const isExpandedRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [thinkTranscript, setThinkTranscript] = useState('')

  const [imageAnswers, setImageAnswers] = useState({})
  const [imageQuestionIndex, setImageQuestionIndex] = useState(0)
  const [imageBuiltPrompt, setImageBuiltPrompt] = useState('')

  const originalTranscript = useRef('')
  const stateRef = useRef(STATES.IDLE)
  const prevStateRef = useRef(STATES.IDLE)
  const generatedPromptRef = useRef('')
  const isIterated = useRef(false)
  const transitionTimerRef = useRef(null)
  const transitionRef = useRef(null)

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
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  function transition(newState, payload = {}) {
    stateRef.current = newState
    setCurrentState(newState)
    if (payload.message) setErrorMessage(payload.message)
    if (!isExpandedRef.current) resizeWindow(STATE_HEIGHTS[newState])
    if (window.electronAPI) {
      window.electronAPI.setWindowButtonsVisible(
        newState !== STATES.RECORDING &&
        newState !== STATES.PAUSED &&
        newState !== STATES.ITERATING
      )
      window.electronAPI.updateMenuBarState?.(newState)
    }
    animateToState(newState)
  }

  function handleExpand() {
    isExpandedRef.current = true
    setIsExpanded(true)
    if (window.electronAPI) window.electronAPI.setWindowSize(1100, STATE_HEIGHTS.EXPANDED)
  }

  function handleCollapse() {
    isExpandedRef.current = false
    setIsExpanded(false)
    stateRef.current = STATES.IDLE
    setCurrentState(STATES.IDLE)
    if (window.electronAPI) {
      window.electronAPI.setWindowSize(520, STATE_HEIGHTS.IDLE)
      window.electronAPI.setWindowButtonsVisible(true)
      window.electronAPI.updateMenuBarState?.(STATES.IDLE)
    }
    animateToState(STATES.IDLE)
  }

  transitionRef.current = transition

  const { polishResult, setPolishResult, copied, setCopied, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange } = usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES })

  const handleGenerateResultRef = useRef(null)

  const {
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
  } = useRecording({
    STATES,
    transitionRef,
    modeRef,
    polishToneRef,
    setThinkTranscript,
    onGenerateResult: handleGenerateResultRef,
    isIterated,
    originalTranscript,
  })

  const handleGenerateResult = useCallback((genResult, transcript) => {
    if (mode === 'image') {
      // genResult.prompt is a passthrough of the transcript — go to question flow
      setImageAnswers({})
      setImageQuestionIndex(0)
      transitionRef.current(STATES.IMAGE_BUILDER)
      return
    }
    if (mode === 'polish') {
      const parsed = parsePolishOutput(genResult.prompt)
      setPolishResult(parsed)
      setGeneratedPrompt(parsed.polished)
      window.electronAPI?.setLastPrompt?.(parsed.polished)
      saveToHistory({ transcript, prompt: parsed.polished, mode, polishChanges: parsed.changes })
    } else {
      setPolishResult(null)
      setGeneratedPrompt(genResult.prompt)
      window.electronAPI?.setLastPrompt?.(genResult.prompt)
      saveToHistory({ transcript, prompt: genResult.prompt, mode })
    }
    transitionRef.current(STATES.PROMPT_READY)
  }, [mode])
  handleGenerateResultRef.current = handleGenerateResult

  const assembleImagePrompt = useCallback(async (answers) => {
    if (!window.electronAPI) {
      transition(STATES.ERROR, { message: 'Electron API not available' })
      return
    }
    setThinkTranscript(originalTranscript.current)
    transition(STATES.THINKING)
    const paramsJson = JSON.stringify(answers, null, 2)
    const systemPrompt = `You are an expert image prompt engineer for Nano Banana (Google Gemini image generation) and ChatGPT image generation. The user has spoken a rough image idea and selected parameters through a guided interview.

Assemble these into a single, flowing natural language image generation prompt. Do NOT use section headers or structured formatting. Write it as one or two paragraphs of vivid, specific description that image generation models respond to.

User's spoken idea: ${originalTranscript.current}
Selected parameters: ${paramsJson}

Rules:
1. Weave the parameters naturally into the description
2. Be specific and vivid — avoid vague adjectives
3. Put the most important visual elements first
4. Include the aspect ratio as a natural phrase
5. If text was specified, include it in quotes
6. End with any negative specifications (what to avoid)
7. Maximum 60 words — concise but complete
8. Output ONLY the prompt — no preamble, no explanation`
    const genResult = await window.electronAPI.generateRaw(systemPrompt)
    if (!genResult.success) {
      transition(STATES.ERROR, { message: 'Could not generate image prompt — try again' })
      return
    }
    setImageBuiltPrompt(genResult.prompt)
    saveToHistory({ transcript: originalTranscript.current, prompt: genResult.prompt, mode: 'image' })
    window.electronAPI?.setLastPrompt?.(genResult.prompt)
    transition(STATES.IMAGE_BUILDER_DONE)
  }, [])

  function calcImageBuilderHeight(answers, tier) {
    const base = tier === 1 ? 380 : tier === 2 ? 420 : 400
    const answeredRows = Math.ceil(Object.keys(answers).length / 3)
    return Math.min(base + Math.max(0, answeredRows - 1) * 28, 520)
  }

  function handleImageSelect(param, value) {
    setImageAnswers((prev) => ({ ...prev, [param]: value }))
  }

  function handleImageNext() {
    const q = IMAGE_QUESTIONS[imageQuestionIndex]
    const hasSelection = imageAnswers[q.param] != null
    if (q.tier <= 2 && !hasSelection) return
    if (imageQuestionIndex === IMAGE_QUESTIONS.length - 1) {
      assembleImagePrompt(imageAnswers)
      return
    }
    const nextIndex = imageQuestionIndex + 1
    const nextTier = IMAGE_QUESTIONS[nextIndex].tier
    const nextHeight = calcImageBuilderHeight(imageAnswers, nextTier)
    setImageQuestionIndex(nextIndex)
    if (!isExpandedRef.current) resizeWindow(nextHeight)
  }

  function handleImageBack() {
    if (imageQuestionIndex === 0) return
    const prevIndex = imageQuestionIndex - 1
    const prevTier = IMAGE_QUESTIONS[prevIndex].tier
    const prevHeight = calcImageBuilderHeight(imageAnswers, prevTier)
    setImageQuestionIndex(prevIndex)
    if (!isExpandedRef.current) resizeWindow(prevHeight)
  }

  function handleImageSkip() {
    const q = IMAGE_QUESTIONS[imageQuestionIndex]
    // Compute cleaned answers synchronously before any setState
    const newAnswers = { ...imageAnswers }
    delete newAnswers[q.param]
    setImageAnswers(newAnswers)
    if (imageQuestionIndex === IMAGE_QUESTIONS.length - 1) {
      assembleImagePrompt(newAnswers)
      return
    }
    const nextIndex = imageQuestionIndex + 1
    const nextTier = IMAGE_QUESTIONS[nextIndex].tier
    const nextHeight = calcImageBuilderHeight(newAnswers, nextTier)
    setImageQuestionIndex(nextIndex)
    if (!isExpandedRef.current) resizeWindow(nextHeight)
  }

  function handleImageCopyNow() {
    assembleImagePrompt(imageAnswers)
  }

  function handleImageStartOver() {
    setImageAnswers({})
    setImageQuestionIndex(0)
    if (!isExpandedRef.current) resizeWindow(STATE_HEIGHTS.IMAGE_BUILDER)
  }

  function handleImageEditAnswers() {
    setImageQuestionIndex(0)
    if (!isExpandedRef.current) resizeWindow(STATE_HEIGHTS.IMAGE_BUILDER)
    transition(STATES.IMAGE_BUILDER)
  }

  const { iterationBase, handleIterate, stopIterating, dismissIterating } = useIteration({
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
  })

  function openHistory() {
    isExpandedRef.current = false
    setIsExpanded(false)
    prevStateRef.current = stateRef.current
    if (window.electronAPI) {
      window.electronAPI.setWindowSize(746, STATE_HEIGHTS.HISTORY)
      window.electronAPI.setWindowButtonsVisible(true)
      window.electronAPI.updateMenuBarState?.(STATES.HISTORY)
    }
    setCurrentState(STATES.HISTORY)
    stateRef.current = STATES.HISTORY
    animateToState(STATES.HISTORY)
  }
  function closeHistory() {
    if (window.electronAPI) {
      window.electronAPI.setWindowSize(520, STATE_HEIGHTS.IDLE)
      window.electronAPI.setWindowButtonsVisible(true)
      window.electronAPI.updateMenuBarState?.(STATES.IDLE)
    }
    setCurrentState(STATES.IDLE)
    stateRef.current = STATES.IDLE
    animateToState(STATES.IDLE)
  }
  function openSettings() {
    prevStateRef.current = stateRef.current
    transition(STATES.SETTINGS)
  }
  function closeSettings() {
    transition(prevStateRef.current || STATES.IDLE)
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
    handleGenerateResult(genResult, typedText)
  }, [mode, handleGenerateResult])

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
    handleGenerateResult(genResult, originalTranscript.current)
  }, [mode, handleGenerateResult])

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getTheme().then(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    })
    const unsubTheme = window.electronAPI.onThemeChanged(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    })
    return () => unsubTheme?.()
  }, [])

  useKeyboardShortcuts({
    STATES,
    stateRef,
    prevStateRef,
    generatedPromptRef,
    modeRef,
    transitionRef,
    setMode,
    setPolishToneValue,
    startRecordingRef,
    stopRecordingRef,
    pauseRecordingRef,
    resumeRecordingRef,
    openHistory,
    closeHistory,
    openSettings,
    closeSettings,
  })

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
        {isExpanded ? (
          <ExpandedView
            currentState={displayState}
            mode={mode}
            modeLabel={modeLabel}
            duration={duration}
            generatedPrompt={generatedPrompt}
            thinkTranscript={thinkTranscript}
            onStart={() => { const s = stateRef.current; if (s === STATES.IDLE || s === STATES.PROMPT_READY) startRecording() }}
            onCollapse={handleCollapse}
            onPause={pauseRecording}
            onStop={stopRecording}
            onStopIterate={stopIterating}
            onRegenerate={handleRegenerate}
            onReset={() => transition(STATES.IDLE)}
            onIterate={handleIterate}
            isIterated={isIterated.current}
            setGeneratedPrompt={setGeneratedPrompt}
            isPolishMode={mode === 'polish'}
            polishResult={polishResult}
            polishTone={polishTone}
            onPolishToneChange={handlePolishToneChange}
            onOpenSettings={openSettings}
            onTypingSubmit={handleTypingSubmit}
            onSwitchToVoice={() => transition(STATES.IDLE)}
            onTypePrompt={() => transition(STATES.TYPING)}
            onReuse={(entry) => {
              originalTranscript.current = entry.transcript
              setGeneratedPrompt(entry.prompt)
              if (entry.mode === 'polish') {
                setPolishResult({ polished: entry.prompt, changes: entry.polishChanges || [] })
              } else {
                setPolishResult(null)
              }
              transition(STATES.PROMPT_READY)
            }}
            imageBuilderProps={{
              transcript: originalTranscript.current,
              questionIndex: imageQuestionIndex,
              answers: imageAnswers,
              imageBuiltPrompt,
              onSelect: handleImageSelect,
              onNext: handleImageNext,
              onBack: handleImageBack,
              onSkip: handleImageSkip,
              onCopyNow: handleImageCopyNow,
              onEditAnswers: handleImageEditAnswers,
              onStartOver: () => { handleImageStartOver(); transition(STATES.IMAGE_BUILDER) },
            }}
          />
        ) : (
          <>
            {displayState === STATES.IDLE && (
              <IdleState
                mode={mode}
                modeLabel={modeLabel}
                onStart={() => { if (stateRef.current === STATES.IDLE) startRecording() }}
                onTypePrompt={() => transition(STATES.TYPING)}
                polishTone={polishTone}
                onPolishToneChange={setPolishToneValue}
                onExpand={handleExpand}
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
                  onDismiss={() => transition(STATES.IDLE)}
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
                onCollapse={handleCollapse}
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
                  if (window.electronAPI) window.electronAPI.copyToClipboard(polishResult?.polished || generatedPrompt)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1800)
                }}
                copied={copied}
                onToneChange={handlePolishToneChange}
                onCollapse={handleCollapse}
              />
            )}
            {displayState === STATES.ERROR && (
              <ErrorState message={errorMessage} onDismiss={() => transition(STATES.IDLE)} />
            )}
            {displayState === STATES.SHORTCUTS && (
              <>
                <div className="h-[44px] w-full" style={{WebkitAppRegion:'drag'}} />
                <ShortcutsPanel onClose={() => transition(prevStateRef.current || STATES.IDLE)} />
              </>
            )}
            {displayState === STATES.SETTINGS && (
              <>
                <div className="h-[70px] w-full" style={{WebkitAppRegion:'drag'}} />
                <SettingsPanel onClose={closeSettings} />
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
            {displayState === STATES.IMAGE_BUILDER && (
              <ImageBuilderState
                transcript={originalTranscript.current}
                questionIndex={imageQuestionIndex}
                answers={imageAnswers}
                onSelect={handleImageSelect}
                onNext={handleImageNext}
                onBack={handleImageBack}
                onSkip={handleImageSkip}
                onCopyNow={handleImageCopyNow}
                isExpanded={false}
              />
            )}
            {displayState === STATES.IMAGE_BUILDER_DONE && (
              <ImageBuilderDoneState
                prompt={imageBuiltPrompt}
                answers={imageAnswers}
                transcript={originalTranscript.current}
                onEditAnswers={handleImageEditAnswers}
                onStartOver={() => { handleImageStartOver(); transition(STATES.IMAGE_BUILDER) }}
                isExpanded={false}
              />
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[var(--color-red)]/20 to-transparent pointer-events-none z-10" />
    </div>
  )
}
