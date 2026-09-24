// Promptly has one window (history beside the current result) plus the floating pill, so there
// is nothing to expand or collapse. This keeps the window-level actions in one place: ⌘H jumps
// to history search, and Settings opens over the window and returns to where you were.
export default function useWindowLayout({ prevStateRef, stateRef, transitionRef, STATES }) {
  function openHistory() {
    window.dispatchEvent(new CustomEvent('promptly:search-history'))
  }

  function openSettings() {
    prevStateRef.current = stateRef.current
    transitionRef.current(STATES.SETTINGS)
  }

  function closeSettings() {
    transitionRef.current(prevStateRef.current || STATES.IDLE)
  }

  return { openHistory, openSettings, closeSettings }
}
