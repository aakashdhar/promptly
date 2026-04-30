import { useEffect } from 'react'

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
  closeHistory,
  openSettings,
  closeSettings,
  handleExpand,
  isExpandedRef,
}) {
  useEffect(() => {
    if (!window.electronAPI) return

    const unsubs = [
      window.electronAPI.onShortcutTriggered(() => {
        if (modeRef.current === 'email' && isExpandedRef && !isExpandedRef.current) {
          handleExpand?.()
          return
        }
        if (stateRef.current === STATES.IDLE) startRecordingRef.current()
        else if (stateRef.current === STATES.RECORDING) stopRecordingRef.current()
        else if (stateRef.current === STATES.SHORTCUTS) startRecordingRef.current()
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

      window.electronAPI.onToggleExpand?.(() => {
        if (!isExpandedRef.current) handleExpand?.()
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
        } else if (stateRef.current === STATES.HISTORY) {
          closeHistory()
        } else if (stateRef.current === STATES.SETTINGS) {
          closeSettings()
        } else if (stateRef.current !== STATES.IDLE) {
          transitionRef.current(STATES.IDLE)
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
        transitionRef.current(STATES.TYPING)
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
      if (meta && e.key === '/') {
        e.preventDefault()
        openSettings()
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
