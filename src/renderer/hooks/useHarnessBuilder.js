import { useState, useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'

export const HARNESS_ACCENT = 'rgba(242,155,203,0.9)'

// "Run it with: …" then every file, for history and Copy all.
export function bundleHarness({ run, files }) {
  return [run ? `Run it with: ${run}` : '', ...files.map((f) => `=== ${f.path} ===\n${f.content}`)].filter(Boolean).join('\n\n')
}

// Harness mode: the spoken job → a plan (loop or pipeline) with gaps to fill → the files.
// Both steps are written by Claude in main (main/harness.js); this hook holds the state between them.
export default function useHarnessBuilder({
  STATES,
  transitionRef,
  originalTranscript,
  setThinkTranscript,
  setThinkingLabel,
  setThinkingAccentColor,
  startRecordingRef,
  contextRef,
}) {
  const [harnessPlan, setHarnessPlan] = useState(null)
  const [answers, setAnswers] = useState({})
  const [harnessFiles, setHarnessFiles] = useState(null) // { run, files }
  const [savedTo, setSavedTo] = useState('')
  const isReiteratingRef = useRef(false)
  const runIdRef = useRef(0)

  const fail = useCallback((message) => transitionRef.current(STATES.ERROR, { message }), [STATES, transitionRef])

  const runHarnessPlan = useCallback(async (transcript, isReiterate = false) => {
    if (!window.electronAPI?.harnessPlan) return fail('Harness mapping failed. Please try again.')
    const runId = ++runIdRef.current
    setThinkingLabel(isReiterate ? 'Re-mapping your harness...' : 'Mapping your harness...')
    setThinkingAccentColor?.(HARNESS_ACCENT)
    setThinkTranscript(transcript)
    transitionRef.current(STATES.THINKING)

    const { selectedText, appName } = contextRef?.current || {}
    const result = await window.electronAPI.harnessPlan(transcript, { selectedText, appName })
    if (runId !== runIdRef.current || result?.cancelled) return
    if (!result?.success) return fail(result?.error || 'Harness mapping failed. Please try again.')

    // Speaking again keeps the answers to gaps the new plan still has.
    setAnswers((prev) => {
      if (!isReiterate) return {}
      const ids = new Set(result.plan.gaps.map((g) => g.id))
      return Object.fromEntries(Object.entries(prev).filter(([id]) => ids.has(id)))
    })
    setHarnessPlan(result.plan)
    setHarnessFiles(null)
    setSavedTo('')
    isReiteratingRef.current = false
    transitionRef.current(STATES.HARNESS_BUILDER)
  }, [STATES, transitionRef, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, contextRef, fail])

  const writeHarnessFiles = useCallback(async () => {
    if (!harnessPlan || !window.electronAPI?.harnessFiles) return
    const runId = ++runIdRef.current
    setThinkingLabel('Writing the files...')
    setThinkingAccentColor?.(HARNESS_ACCENT)
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const result = await window.electronAPI.harnessFiles(originalTranscript.current, harnessPlan, answers)
    if (runId !== runIdRef.current || result?.cancelled) return
    if (!result?.success) return fail(result?.error || 'Writing the harness failed. Please try again.')

    const bundle = { run: result.run, files: result.files }
    saveToHistory({ transcript: originalTranscript.current, prompt: bundleHarness(bundle), mode: 'harness' })
    window.electronAPI?.setLastPrompt?.(bundleHarness(bundle))
    setHarnessFiles(bundle)
    setSavedTo('')
    transitionRef.current(STATES.HARNESS_BUILDER_DONE)
  }, [STATES, transitionRef, originalTranscript, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, harnessPlan, answers, fail])

  const handleHarnessStartOver = useCallback(() => {
    runIdRef.current++
    setHarnessPlan(null)
    setAnswers({})
    setHarnessFiles(null)
    setSavedTo('')
    isReiteratingRef.current = false
    transitionRef.current(STATES.IDLE)
  }, [STATES, transitionRef])

  const saveToProject = useCallback(async () => {
    if (!harnessFiles) return
    const result = await window.electronAPI?.saveHarness?.(harnessFiles.files)
    if (result?.ok) setSavedTo(result.dir)
    return result
  }, [harnessFiles])

  const harnessBuilderProps = {
    transcript: originalTranscript.current,
    plan: harnessPlan,
    answers,
    files: harnessFiles,
    savedTo,
    onAnswer: (id, value) => setAnswers((prev) => ({ ...prev, [id]: value })),
    onConfirm: writeHarnessFiles,
    onReiterate: () => { isReiteratingRef.current = true; startRecordingRef?.current?.() },
    onStartOver: handleHarnessStartOver,
    onBackToPlan: () => transitionRef.current(STATES.HARNESS_BUILDER),
    onSaveToProject: saveToProject,
    onCopy: (text) => window.electronAPI?.copyToClipboard(text),
  }

  return {
    isReiteratingRef,
    runHarnessPlan,
    handleHarnessStartOver,
    harnessBuilderProps,
  }
}
