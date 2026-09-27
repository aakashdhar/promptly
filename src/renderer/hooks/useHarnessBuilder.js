import { useState, useRef, useCallback } from 'react'
import { saveToHistory } from '../utils/history.js'
import { runStep } from '../utils/claudeStep.js'

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
  opIdRef,
}) {
  const [harnessPlan, setHarnessPlan] = useState(null)
  const [answers, setAnswers] = useState({})
  const [harnessFiles, setHarnessFiles] = useState(null) // { run, files }
  const [savedTo, setSavedTo] = useState('')
  const [scheduled, setScheduled] = useState('') // "every day at 02:00" once installed
  const [alreadyScheduled, setAlreadyScheduled] = useState(false)
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
    const result = await runStep(opIdRef, () => window.electronAPI.harnessPlan(transcript, { selectedText, appName }))
    if (runId !== runIdRef.current || !result) return
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
  }, [STATES, transitionRef, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, contextRef, fail, opIdRef])

  const writeHarnessFiles = useCallback(async () => {
    if (!harnessPlan || !window.electronAPI?.harnessFiles) return
    const runId = ++runIdRef.current
    setThinkingLabel('Writing the files...')
    setThinkingAccentColor?.(HARNESS_ACCENT)
    setThinkTranscript(originalTranscript.current)
    transitionRef.current(STATES.THINKING)

    const result = await runStep(opIdRef, () => window.electronAPI.harnessFiles(originalTranscript.current, harnessPlan, answers))
    if (runId !== runIdRef.current || !result) return
    if (!result?.success) return fail(result?.error || 'Writing the harness failed. Please try again.')

    const bundle = { run: result.run, schedule: result.schedule || null, files: result.files }
    saveToHistory({ transcript: originalTranscript.current, prompt: bundleHarness(bundle), mode: 'harness' })
    window.electronAPI?.setLastPrompt?.(bundleHarness(bundle))
    setHarnessFiles(bundle)
    setSavedTo('')
    setScheduled('')
    transitionRef.current(STATES.HARNESS_BUILDER_DONE)
  }, [STATES, transitionRef, originalTranscript, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, harnessPlan, answers, fail, opIdRef])

  const handleHarnessStartOver = useCallback(() => {
    runIdRef.current++
    setHarnessPlan(null)
    setAnswers({})
    setHarnessFiles(null)
    setSavedTo('')
    setScheduled('')
    isReiteratingRef.current = false
    transitionRef.current(STATES.IDLE)
  }, [STATES, transitionRef])

  const saveToProject = useCallback(async () => {
    if (!harnessFiles) return
    const result = await window.electronAPI?.saveHarness?.(harnessFiles.files, harnessFiles.run)
    if (result?.ok) {
      setSavedTo(result.dir)
      setScheduled('')
      setAlreadyScheduled(!!result.alreadyScheduled)
    }
    return result
  }, [harnessFiles])

  const schedule = useCallback(async (when) => {
    const result = await window.electronAPI?.scheduleHarness?.(when)
    if (result?.ok) { setScheduled(result.label); setAlreadyScheduled(false) }
    return result
  }, [])

  const unschedule = useCallback(async () => {
    const result = await window.electronAPI?.unscheduleHarness?.()
    if (result?.ok) { setScheduled(''); setAlreadyScheduled(false) }
    return result
  }, [])

  const harnessBuilderProps = {
    transcript: originalTranscript.current,
    plan: harnessPlan,
    answers,
    files: harnessFiles,
    savedTo,
    scheduled,
    alreadyScheduled,
    onSchedule: schedule,
    onUnschedule: unschedule,
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
