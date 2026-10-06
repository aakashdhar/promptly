import { useState, useRef, useEffect, useCallback } from 'react'
import useMode from './hooks/useMode.js'
import usePolishMode, { parsePolishOutput } from './hooks/usePolishMode.js'
import useWindowLayout from './hooks/useWindowLayout.js'
import useRecording from './hooks/useRecording.js'
import useKeyboardShortcuts, { CAN_START_TYPING } from './hooks/useKeyboardShortcuts.js'
import useIteration from './hooks/useIteration.js'
import useImageBuilder from './hooks/useImageBuilder.js'
import useVideoBuilder from './hooks/useVideoBuilder.js'
import useWorkflowBuilder from './hooks/useWorkflowBuilder.js'
import useHarnessBuilder from './hooks/useHarnessBuilder.js'
import useOperationHandlers from './hooks/useOperationHandlers.js'
import useTextInput from './hooks/useTextInput.js'
import useDictation from './hooks/useDictation.js'
import { useThinkingProgress } from './hooks/useThinkingProgress.js'
import ExpandedView from './components/ExpandedView.jsx'
import LearnedNotice from './components/LearnedNotice.jsx'
import { saveToHistory, bookmarkHistoryItem } from './utils/history.js'
import { runStep } from './utils/claudeStep.js'
import { getModeAccent } from './utils/thinkingLabels.js'
import { parseEmailOutput } from './utils/promptUtils.js'
import { projectModeKey } from './utils/projects.js'

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
  VIDEO_BUILDER: 'VIDEO_BUILDER',
  VIDEO_BUILDER_DONE: 'VIDEO_BUILDER_DONE',
  WORKFLOW_BUILDER: 'WORKFLOW_BUILDER',
  WORKFLOW_BUILDER_DONE: 'WORKFLOW_BUILDER_DONE',
  HARNESS_BUILDER: 'HARNESS_BUILDER',
  HARNESS_BUILDER_DONE: 'HARNESS_BUILDER_DONE',
  EMAIL_READY: 'EMAIL_READY',
  TRANSCRIPTION_ERROR: 'TRANSCRIPTION_ERROR',
  GENERATION_ERROR: 'GENERATION_ERROR',
}

export default function App() {
  const [currentState, setCurrentState] = useState(STATES.IDLE)
  const [displayState, setDisplayState] = useState(STATES.IDLE)
  const [stateClass, setStateClass] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [thinkTranscript, setThinkTranscript] = useState('')
  const [thinkingLabel, setThinkingLabel] = useState('')
  const [thinkingAccentColor, setThinkingAccentColor] = useState('')
  const [thinkingPhase, setThinkingPhase] = useState(1)
  const [emailOutput, setEmailOutput] = useState(null)
  const emailOutputRef = useRef(null)
  emailOutputRef.current = emailOutput
  const [emailSaved, setEmailSaved] = useState(false)
  const [transcriptionError, setTranscriptionError] = useState(null)
  const [generationError, setGenerationError] = useState(null)
  const [transcriptionSlow, setTranscriptionSlow] = useState(false)
  const [generationSlow, setGenerationSlow] = useState(false)

  const originalTranscript = useRef('')
  const stateRef = useRef(STATES.IDLE)
  const prevStateRef = useRef(STATES.IDLE)
  const generatedPromptRef = useRef('')
  const isIterated = useRef(false)
  const transitionTimerRef = useRef(null)
  const transitionRef = useRef(null)
  const animateToStateRef = useRef(null)
  // Bumped on every new generation and on abort; a result whose id is stale is ignored.
  const opIdRef = useRef(0)
  const emailHistoryIdRef = useRef(null)
  // App + selected text captured when a hotkey recording started (destination-aware prompts).
  const contextRef = useRef(null)
  const [recordingContext, setRecordingContext] = useState(null)
  const [streamText, setStreamText] = useState('')

  const { mode, setMode, modeLabel } = useMode()
  // The mode of the result on screen, which can differ from the selected mode: a prompt made
  // from a dictation, or one reopened from history. Regenerate and Iterate use it.
  const [resultMode, setResultModeState] = useState(null)
  const resultModeRef = useRef(null)
  const setResultMode = useCallback((m) => { resultModeRef.current = m; setResultModeState(m) }, [])

  // Main says so while you're recording but too faint to transcribe well.
  const [micQuiet, setMicQuiet] = useState(false)
  useEffect(() => window.electronAPI?.onMicQuiet?.((quiet) => setMicQuiet(!!quiet)), [])

  const { dictation, resultView, promptStyle, acceptDictation, showDictation, makePrompt, promptFromTyping, clearDictation, openDictation } = useDictation({
    STATES, transitionRef, opIdRef, contextRef, setGeneratedPrompt, setThinkingLabel, setThinkTranscript, setResultMode,
  })

  // Project modes (D-PROJECT-MODES): the result on screen when a project wrote it (its project,
  // output, the files it used, the files left out), so Write as and "leave this file out" can redo it.
  const [projectResult, setProjectResult] = useState(null)
  const projectResultRef = useRef(null)
  projectResultRef.current = projectResult
  // What a redo of the result on screen (Iterate, a tone change) sends so it stays in the project.
  const projectOptionRef = useRef(null)
  projectOptionRef.current = projectResult ? { id: projectResult.project.id, output: projectResult.output, exclude: projectResult.exclude || [] } : null
  const projectExcludeRef = useRef([])
  // After a dictation that names someone from a project: { id, name, output }.
  const [projectSuggestion, setProjectSuggestion] = useState(null)
  useEffect(() => {
    setProjectSuggestion(null)
    const text = dictation?.text
    if (!text) return undefined
    let live = true
    window.electronAPI?.suggestProject?.(text).then((s) => { if (live && s && s.id) setProjectSuggestion(s) }).catch(() => {})
    return () => { live = false }
  }, [dictation])

  const { openHistory, openSettings, closeSettings } = useWindowLayout({ prevStateRef, stateRef, transitionRef, STATES })

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
  animateToStateRef.current = animateToState

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
    }
  }, [])

  useEffect(() => { stateRef.current = currentState }, [currentState])
  useEffect(() => { generatedPromptRef.current = generatedPrompt }, [generatedPrompt])
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  function transition(newState, payload = {}) {
    const fromState = stateRef.current
    stateRef.current = newState
    setCurrentState(newState)
    if (payload.message) setErrorMessage(payload.message)
    if (newState === STATES.THINKING) {
      const builderStates = [STATES.IMAGE_BUILDER, STATES.VIDEO_BUILDER, STATES.WORKFLOW_BUILDER, STATES.HARNESS_BUILDER]
      setThinkingPhase(builderStates.includes(fromState) ? 2 : 1)
    }
    if (newState !== STATES.THINKING) { setThinkingLabel(''); setThinkingAccentColor(''); setThinkingPhase(1); setTranscriptionSlow(false); setGenerationSlow(false) }
    if (newState === STATES.THINKING || newState === STATES.RECORDING || newState === STATES.TYPING) setStreamText('')
    if (newState === STATES.RECORDING || newState === STATES.TYPING) { setRecordingContext(null); clearDictation(); setResultMode(null); setProjectResult(null); projectExcludeRef.current = [] }
    window.electronAPI?.updateMenuBarState?.(newState)
    animateToState(newState)
  }

  transitionRef.current = transition

  const { polishResult, setPolishResult, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange } = usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES, opIdRef, contextRef, projectRef: projectOptionRef })

  const handleGenerateResultRef = useRef(null)

  // A builder's "speak again" marks the next recording as a re-iteration. If that recording is
  // thrown away (or never starts), the mark must go too, or the next unrelated idea is merged
  // into the old one. Filled in once the builders exist, below.
  const discardRecordingRef = useRef(null)
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
    requestStop,
  } = useRecording({
    STATES,
    transitionRef,
    modeRef,
    polishToneRef,
    setThinkTranscript,
    setThinkingAccentColor,
    setThinkingLabel,
    onGenerateResult: handleGenerateResultRef,
    opIdRef,
    isIterated,
    originalTranscript,
    setTranscriptionError,
    contextRef,
    setMode,
    onDiscardRef: discardRecordingRef,
  })

  const {
    isReiteratingRef,
    runPreSelection,
    handleImageStartOver,
    imageBuilderProps,
  } = useImageBuilder({
    STATES,
    transitionRef,
    originalTranscript,
    setThinkTranscript,
    setThinkingLabel,
    setThinkingAccentColor,
    startRecordingRef,
    opIdRef,
  })

  const {
    isReiteratingRef: isVideoReiteratingRef,
    runPreSelection: runVideoPreSelection,
    handleVideoStartOver,
    videoBuilderProps,
  } = useVideoBuilder({
    STATES,
    transitionRef,
    originalTranscript,
    setThinkTranscript,
    setThinkingLabel,
    setThinkingAccentColor,
    startRecordingRef,
    opIdRef,
  })

  const {
    isReiteratingRef: isWorkflowReiteratingRef,
    runWorkflowAnalysis,
    handleWorkflowStartOver,
    workflowBuilderProps,
  } = useWorkflowBuilder({
    STATES,
    transitionRef,
    originalTranscript,
    setThinkTranscript,
    setThinkingLabel,
    setThinkingAccentColor,
    startRecordingRef,
    opIdRef,
  })

  const {
    isReiteratingRef: isHarnessReiteratingRef,
    runHarnessPlan,
    handleHarnessStartOver,
    harnessBuilderProps,
  } = useHarnessBuilder({
    STATES,
    transitionRef,
    originalTranscript,
    setThinkTranscript,
    setThinkingLabel,
    setThinkingAccentColor,
    startRecordingRef,
    contextRef,
    opIdRef,
  })

  discardRecordingRef.current = () => {
    isReiteratingRef.current = false
    isVideoReiteratingRef.current = false
    isWorkflowReiteratingRef.current = false
    isHarnessReiteratingRef.current = false
  }

  // Only ever called through handleGenerateResultRef, so it is rebuilt each render on purpose:
  // the ref always points at the version that sees the latest builder callbacks.
  function handleGenerateResult(genResult, transcript, opId, modeOverride) {
    if (opId !== undefined && opId !== opIdRef.current) return
    // Read the live mode: a spoken "code mode, …" may have switched it moments ago. Regenerating
    // a result made in another mode passes that mode instead.
    // A project result is shown as what it was written as: an email, a prompt or polished text.
    const mode = genResult.project ? genResult.output : (modeOverride || modeRef.current)
    if (genResult.success) {
      setResultMode(mode)
      setProjectResult(genResult.project ? { project: genResult.project, output: genResult.output, sources: genResult.sources || [], transcript, exclude: projectExcludeRef.current } : null)
    }
    const project = genResult.project || undefined
    if (mode === 'dictate') {
      if (genResult.success) acceptDictation(genResult, transcript)
      else transitionRef.current(STATES.ERROR, { message: genResult.error || "Didn't catch anything" })
      return
    }
    if (!genResult.success) {
      setGenerationError({
        error: genResult.error || '',
        errorType: genResult.errorType || (genResult.timedOut ? 'timeout' : 'unknown'),
        provider: genResult.provider || null,
        canRetry: true,
      })
      transitionRef.current(STATES.GENERATION_ERROR)
      return
    }
    if (mode === 'image') {
      const isReiterate = isReiteratingRef.current
      isReiteratingRef.current = false
      setThinkingLabel('Analysing your idea...')
      setThinkingAccentColor(getModeAccent('image'))
      runPreSelection(originalTranscript.current, isReiterate)
      return
    }
    if (mode === 'video') {
      const isReiterate = isVideoReiteratingRef.current
      isVideoReiteratingRef.current = false
      setThinkingLabel('Analysing your idea...')
      setThinkingAccentColor(getModeAccent('video'))
      runVideoPreSelection(originalTranscript.current, isReiterate)
      return
    }
    if (mode === 'workflow') {
      const isReiterate = isWorkflowReiteratingRef.current
      isWorkflowReiteratingRef.current = false
      runWorkflowAnalysis(originalTranscript.current, isReiterate)
      return
    }
    if (mode === 'harness') {
      const isReiterate = isHarnessReiteratingRef.current
      isHarnessReiteratingRef.current = false
      runHarnessPlan(originalTranscript.current, isReiterate)
      return
    }
    if (mode === 'email') {
      try {
        const parsed = parseEmailOutput(genResult.prompt)
        setEmailOutput(parsed)
        setEmailSaved(false)
        emailHistoryIdRef.current = saveToHistory({ transcript: originalTranscript.current, prompt: parsed.subject + '\n\n' + parsed.body, mode: 'email', project })
        window.electronAPI?.setLastPrompt?.(parsed.subject + '\n\n' + parsed.body)
        transitionRef.current(STATES.EMAIL_READY)
      } catch {
        setGenerationError({ errorType: 'unknown', error: 'Failed to parse email response', provider: genResult.provider || null, canRetry: true })
        transitionRef.current(STATES.GENERATION_ERROR)
      }
      return
    }
    setThinkingLabel('')
    if (mode === 'polish') {
      const parsed = parsePolishOutput(genResult.prompt)
      setPolishResult(parsed)
      setGeneratedPrompt(parsed.polished)
      window.electronAPI?.setLastPrompt?.(parsed.polished)
      saveToHistory({ transcript, prompt: parsed.polished, mode, polishChanges: parsed.changes, project })
    } else {
      setPolishResult(null)
      setGeneratedPrompt(genResult.prompt)
      window.electronAPI?.setLastPrompt?.(genResult.prompt)
      saveToHistory({ transcript, prompt: genResult.prompt, mode, project })
    }
    transitionRef.current(STATES.PROMPT_READY)
  }
  handleGenerateResultRef.current = handleGenerateResult

  // Redo a project result: as another output (Write as) or without some files.
  async function rerunProject({ output, exclude } = {}) {
    const pr = projectResultRef.current
    if (!pr) return
    const ex = exclude || pr.exclude || []
    projectExcludeRef.current = ex
    const key = projectModeKey(pr.project.id)
    setThinkTranscript(pr.transcript)
    transition(STATES.THINKING)
    const result = await runStep(opIdRef, () => window.electronAPI.generatePrompt(pr.transcript, key, {
      project: { id: pr.project.id, output: output || pr.output, exclude: ex },
      ...((output || pr.output) === 'polish' && { tone: polishToneRef.current }),
      ...(contextRef.current && { context: contextRef.current }),
    }))
    if (!result) return
    handleGenerateResult(result, pr.transcript, undefined, key)
  }

  // "As an Infer360 email" after a dictation: the dictated words, written in that project.
  async function runSuggestedProject() {
    const s = projectSuggestion
    const text = dictation?.text
    if (!s || !text) return
    originalTranscript.current = text
    projectExcludeRef.current = []
    clearDictation()
    const key = projectModeKey(s.id)
    setThinkTranscript(text)
    transition(STATES.THINKING)
    const result = await runStep(opIdRef, () => window.electronAPI.generatePrompt(text, key, { project: { id: s.id, output: s.output } }))
    if (!result) return
    handleGenerateResult(result, text, undefined, key)
  }

  const { handleIterate, stopIterating, dismissIterating } = useIteration({
    STATES,
    transitionRef,
    generatedPromptRef,
    modeRef,
    resultModeRef,
    isIterated,
    originalTranscript,
    setThinkTranscript,
    startTimer,
    stopTimer,
    contextRef,
    opIdRef,
    // Email refines the draft on screen; Polish keeps its tone; everything else refines the prompt.
    getIterationBase: () => {
      const shown = resultModeRef.current || modeRef.current
      if (stateRef.current === STATES.EMAIL_READY && emailOutputRef.current) {
        const e = emailOutputRef.current
        return { mode: 'email', prompt: e.body, email: { subject: e.subject, body: e.body }, transcript: originalTranscript.current, returnState: STATES.EMAIL_READY, project: projectOptionRef.current }
      }
      return { mode: shown, prompt: generatedPromptRef.current, transcript: originalTranscript.current, tone: shown === 'polish' ? polishToneRef.current : undefined, returnState: STATES.PROMPT_READY, project: projectOptionRef.current }
    },
    onRevised: (genResult, iterText, base) => {
      if (base.mode === 'email') { acceptRevisedEmail(genResult, iterText); return }
      originalTranscript.current = iterText
      if (base.mode === 'polish') {
        const parsed = parsePolishOutput(genResult.prompt)
        setPolishResult(parsed)
        setGeneratedPrompt(parsed.polished)
        window.electronAPI?.setLastPrompt?.(parsed.polished)
        saveToHistory({ transcript: iterText, prompt: parsed.polished, mode: 'polish', polishChanges: parsed.changes, isIteration: true, basedOn: base.prompt.slice(0, 100) })
      } else {
        setGeneratedPrompt(genResult.prompt)
        window.electronAPI?.setLastPrompt?.(genResult.prompt)
        saveToHistory({ transcript: iterText, prompt: genResult.prompt, mode: base.mode, isIteration: true, basedOn: base.prompt.slice(0, 100) })
      }
      transitionRef.current(STATES.PROMPT_READY)
    },
  })

  // A revised email (from Iterate or a tone chip) replaces the draft and is kept in history.
  function acceptRevisedEmail(result, change) {
    try {
      const parsed = parseEmailOutput(result.prompt)
      setEmailOutput(parsed)
      setEmailSaved(false)
      emailHistoryIdRef.current = saveToHistory({ transcript: `${originalTranscript.current}\n\nChange: ${change}`, prompt: parsed.subject + '\n\n' + parsed.body, mode: 'email', isIteration: true })
      window.electronAPI?.setLastPrompt?.(parsed.subject + '\n\n' + parsed.body)
      transitionRef.current(STATES.EMAIL_READY)
    } catch {
      setGenerationError({ errorType: 'unknown', error: 'Failed to read the revised email', provider: result?.provider || null, canRetry: true })
      transitionRef.current(STATES.GENERATION_ERROR)
    }
  }

  function handleEmailSave() {
    if (emailHistoryIdRef.current) bookmarkHistoryItem(emailHistoryIdRef.current)
    setEmailSaved(true)
  }

  // A tone chip ("More formal", "Shorter"…) revises the draft the same way a spoken change does.
  async function handleToneAdjust(adjustment) {
    if (!emailOutput) return
    setThinkingLabel('Adjusting tone...')
    setThinkingAccentColor('rgba(20,184,166,0.85)')
    setThinkTranscript(adjustment)
    transition(STATES.THINKING)
    const result = await runStep(opIdRef, () => window.electronAPI.generatePrompt(adjustment, 'email', {
      revise: { email: { subject: emailOutput.subject, body: emailOutput.body }, transcript: originalTranscript.current },
      ...(contextRef.current && { context: contextRef.current }),
      ...(projectOptionRef.current && { project: { ...projectOptionRef.current, output: 'email' } }),
    }))
    if (!result) return
    if (result.success) {
      isIterated.current = true
      acceptRevisedEmail(result, adjustment)
    } else {
      setGenerationError({ errorType: result?.errorType || 'unknown', error: result?.error || 'Tone adjustment failed', provider: result?.provider || null, canRetry: true })
      transitionRef.current(STATES.GENERATION_ERROR)
    }
  }

  const {
    handleAbort,
    handleRetryTranscription,
    handleRetryGeneration,
  } = useOperationHandlers({
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
  })

  const abortRef = useRef(null)
  abortRef.current = handleAbort

  const typedDictationRef = useRef(null)
  typedDictationRef.current = promptFromTyping
  const { handleTypingSubmit, handleRegenerate } = useTextInput({
    STATES,
    transitionRef,
    isIterated,
    originalTranscript,
    setThinkTranscript,
    modeRef,
    resultModeRef,
    polishToneRef,
    handleGenerateResultRef,
    opIdRef,
    contextRef,
    typedDictationRef,
  })

  const { elapsed: thinkingElapsed, currentLabel: thinkingCurrentLabel, labelOpacity: thinkingLabelOpacity } = useThinkingProgress({
    mode,
    phase: thinkingPhase,
    isActive: currentState === STATES.THINKING,
  })

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.getTheme().then(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    }).catch(() => { /* keep the default theme; onThemeChanged still applies later changes */ })
    const unsubTheme = window.electronAPI.onThemeChanged(({ dark }) => {
      document.body.classList.toggle('light', !dark)
    })
    return () => unsubTheme?.()
  }, [])

  useKeyboardShortcuts({
    STATES,
    abortRef,
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
    openSettings,
    closeSettings,
    requestStop,
    dismissRecording: handleDismiss,
  })

  useEffect(() => {
    if (!window.electronAPI?.onRecordingContext) return
    const unsubContext = window.electronAPI.onRecordingContext((ctx) => {
      contextRef.current = ctx
      setRecordingContext(ctx)
    })
    const unsubDelta = window.electronAPI.onGenerationDelta((data) => {
      if (stateRef.current === STATES.THINKING) setStreamText(data?.text || '')
    })
    // The pill's "Make it a prompt" after dictating from another app.
    const unsubMakePrompt = window.electronAPI.onMakePrompt?.(() => makePromptRef.current?.())
    return () => { unsubContext?.(); unsubDelta?.(); unsubMakePrompt?.() }
  }, [])
  const makePromptRef = useRef(null)
  makePromptRef.current = makePrompt

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
      style={{width:'100%', height:'100vh', display:'flex', flexDirection:'column', borderRadius:'18px', overflow:'hidden', position:'relative', background:'var(--bg)', border:'0.5px solid var(--window-edge)', boxShadow:'var(--window-shadow)'}}
      id="bar"
      onContextMenu={handleContextMenu}
    >

      {/* POLISH-001: animated state wrapper */}
      <div
        className={stateClass}
        style={{flex:1, display:'flex', flexDirection:'column', position:'relative', minHeight:0, overflow:'hidden'}}
      >
          <ExpandedView
            currentState={displayState}
            mode={mode}
            modeLabel={modeLabel}
            duration={duration}
            generatedPrompt={generatedPrompt}
            thinkTranscript={thinkTranscript}
            onStart={() => { const s = stateRef.current; if (s === STATES.IDLE || s === STATES.PROMPT_READY || s === STATES.IMAGE_BUILDER || s === STATES.IMAGE_BUILDER_DONE || s === STATES.VIDEO_BUILDER || s === STATES.VIDEO_BUILDER_DONE || s === STATES.WORKFLOW_BUILDER || s === STATES.WORKFLOW_BUILDER_DONE || s === STATES.HARNESS_BUILDER || s === STATES.HARNESS_BUILDER_DONE || s === STATES.EMAIL_READY) startRecording() }}
            onPause={() => (stateRef.current === STATES.PAUSED ? resumeRecording() : pauseRecording())}
            onStop={stopRecording}
            onStopIterate={stopIterating}
            // Reworking a prompt made from a dictation makes it a prompt of its own; the dictation
            // is still in history.
            onRegenerate={() => { clearDictation(); if (projectResultRef.current) rerunProject(); else handleRegenerate() }}
            onReset={() => transition(STATES.IDLE)}
            onIterate={() => { clearDictation(); handleIterate() }}
            isIterated={isIterated.current}
            setGeneratedPrompt={setGeneratedPrompt}
            isPolishMode={(resultMode || mode) === 'polish'}
            resultMode={resultMode}
            micQuiet={micQuiet}
            polishResult={polishResult}
            polishTone={polishTone}
            onPolishToneChange={handlePolishToneChange}
            onOpenSettings={openSettings}
            onCloseSettings={closeSettings}
            onTypingSubmit={handleTypingSubmit}
            onSwitchToVoice={() => transition(STATES.IDLE)}
            onTypePrompt={() => { if (CAN_START_TYPING.has(stateRef.current)) transition(STATES.TYPING) }}
            onReuse={(entry) => {
              isIterated.current = false
              originalTranscript.current = entry.transcript
              // A dictation comes back with its "As a prompt" switch; anything else comes back as
              // the result in its own mode, ready to iterate or regenerate.
              if (entry.mode === 'dictate') { openDictation(entry.prompt); return }
              clearDictation()
              setProjectResult(null)
              setResultMode(entry.mode)
              setGeneratedPrompt(entry.prompt)
              if (entry.mode === 'polish') {
                setPolishResult({ polished: entry.prompt, changes: entry.polishChanges || [] })
              } else {
                setPolishResult(null)
              }
              transition(STATES.PROMPT_READY)
            }}
            thinkingLabel={thinkingLabel}
            thinkingAccentColor={thinkingAccentColor}
            imageBuilderProps={imageBuilderProps}
            videoBuilderProps={videoBuilderProps}
            workflowBuilderProps={workflowBuilderProps}
            harnessBuilderProps={harnessBuilderProps}
            emailOutput={emailOutput}
            emailSaved={emailSaved}
            onEmailSave={handleEmailSave}
            onEmailIterate={handleIterate}
            onToneAdjust={handleToneAdjust}
            onEmailBodyChange={(body) => setEmailOutput((prev) => (prev ? { ...prev, body } : prev))}
            onAbort={handleAbort}
            transcriptionErrorProps={{ ...transcriptionError, onRetry: handleRetryTranscription, onOpenSettings: openSettings }}
            transcriptionSlow={transcriptionSlow}
            generationErrorProps={{ ...generationError, onRetry: handleRetryGeneration, onOpenSettings: openSettings }}
            generationSlow={generationSlow}
            thinkingElapsed={thinkingElapsed}
            thinkingCurrentLabel={thinkingCurrentLabel}
            thinkingLabelOpacity={thinkingLabelOpacity}
            onModeSelect={setMode}
            onShowShortcuts={() => { prevStateRef.current = stateRef.current; transition(STATES.SHORTCUTS) }}
            onCloseShortcuts={() => transition(prevStateRef.current || STATES.IDLE)}
            onShowHistory={openHistory}
            errorMessage={errorMessage}
            streamText={streamText}
            recordingContext={recordingContext}
            dictation={dictation}
            resultView={resultView}
            promptStyle={promptStyle}
            onShowDictation={showDictation}
            onMakePrompt={makePrompt}
            project={{
              result: projectResult,
              onWriteAs: (output) => rerunProject({ output }),
              onExclude: (rel) => rerunProject({ exclude: [...(projectResultRef.current?.exclude || []), rel] }),
              suggestion: projectSuggestion,
              onUseSuggestion: runSuggestedProject,
            }}
          />
      </div>
      <LearnedNotice />
    </div>
  )
}
