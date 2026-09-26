import { useEffect } from 'react'

// Where ⌘T and the Type button open the typing box: anywhere you're not in the middle of
// something (recording, Claude writing, filling in a builder). A result on screen is already
// in history, so starting a new request loses nothing.
export const CAN_START_TYPING = new Set([
  'IDLE', 'PROMPT_READY', 'EMAIL_READY', 'IMAGE_BUILDER_DONE', 'VIDEO_BUILDER_DONE', 'WORKFLOW_BUILDER_DONE',
  'ERROR', 'TRANSCRIPTION_ERROR', 'GENERATION_ERROR', 'SETTINGS', 'SHORTCUTS',
])

// States in which the global hotkey starts a fresh recording. Finished and error
// states are included so the hotkey keeps working after the first prompt.
const RESTARTABLE_STATES = ['IDLE', 'SHORTCUTS', 'PROMPT_READY', 'EMAIL_READY', 'ERROR', 'TRANSCRIPTION_ERROR', 'GENERATION_ERROR']

export default function useKeyboardShortcuts({
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
  openSettings,
  closeSettings,
  requestStop,
  dismissRecording,
}) {
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubs = [
      // Hold to talk / tap to toggle: main decides start vs stop.
      window.electronAPI.onHotkeyStart?.(() => {
        if (RESTARTABLE_STATES.includes(stateRef.current)) startRecordingRef.current()
      }),
      window.electronAPI.onHotkeyStop?.(() => {
        const s = stateRef.current
        if (s === STATES.RECORDING || s === STATES.PAUSED || RESTARTABLE_STATES.includes(s)) requestStop?.()
      }),
      window.electronAPI.onHotkeyCancel?.(() => {
        const s = stateRef.current
        if (s === STATES.RECORDING || s === STATES.PAUSED) dismissRecording?.()
      }),

      window.electronAPI.onModeSelected((key) => {
        setMode(key)
      }),

      window.electronAPI.onToneSelected((t) => {
        setPolishToneValue(t)
      }),

      window.electronAPI.onShowShortcuts(() => {
        prevStateRef.current = stateRef.current
        transitionRef.current(STATES.SHORTCUTS)
      }),

      window.electronAPI.onShowHistory(() => {
        openHistory()
      }),

      window.electronAPI.onShortcutPause(() => {
        if (stateRef.current === STATES.RECORDING) pauseRecordingRef.current()
        else if (stateRef.current === STATES.PAUSED) resumeRecordingRef.current()
      }),

      window.electronAPI.onOpenSettings(() => {
        openSettings()
      }),

    ]

    return () => unsubs.forEach(fn => fn?.())
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      const meta = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') {
        if (stateRef.current === STATES.RECORDING) {
          stopRecordingRef.current()
        } else if (stateRef.current === STATES.SHORTCUTS) {
          transitionRef.current(prevStateRef.current || STATES.IDLE)
        } else if (stateRef.current === STATES.SETTINGS) {
          closeSettings()
        } else if (stateRef.current !== STATES.IDLE) {
          transitionRef.current(STATES.IDLE)
        }
        return
      }
      if (meta && e.key === 'h' && stateRef.current !== STATES.RECORDING) {
        e.preventDefault()
        openHistory()
        return
      }
      if (meta && e.key === 't' && CAN_START_TYPING.has(stateRef.current)) {
        e.preventDefault()
        transitionRef.current(STATES.TYPING)
        return
      }
      if (meta && e.key === 'c' && stateRef.current === STATES.PROMPT_READY) {
        // With text selected, let the normal copy of the selection happen.
        if (window.getSelection()?.toString()) return
        e.preventDefault()
        if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPromptRef.current)
        return
      }
      if (meta && e.key === 'e' && stateRef.current === STATES.PROMPT_READY) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('export-prompt'))
      }
      if (meta && e.key === '?') {
        e.preventDefault()
        prevStateRef.current = stateRef.current
        transitionRef.current(STATES.SHORTCUTS)
        return
      }
      if (meta && e.key === '/') {
        e.preventDefault()
        openSettings()
      }
      // Pause/resume while the bar has focus; main also claims Option+P globally during recording.
      if (e.altKey && !meta && e.code === 'KeyP') {
        if (stateRef.current === STATES.RECORDING) { e.preventDefault(); pauseRecordingRef.current() }
        else if (stateRef.current === STATES.PAUSED) { e.preventDefault(); resumeRecordingRef.current() }
      }
      if (meta && e.key === ',' && stateRef.current === STATES.IDLE) {
        e.preventDefault()
        if (window.electronAPI) window.electronAPI.showModeMenu(modeRef.current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
