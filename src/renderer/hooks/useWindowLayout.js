import { useState, useRef } from 'react'

export default function useWindowLayout({
  animateToStateRef,
  stateRef,
  setCurrentState,
  prevStateRef,
  transitionRef,
  STATES,
  STATE_HEIGHTS,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isExpandedRef = useRef(false)

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
    animateToStateRef.current(STATES.IDLE)
  }

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
    animateToStateRef.current(STATES.HISTORY)
  }

  function closeHistory() {
    if (window.electronAPI) {
      window.electronAPI.setWindowSize(520, STATE_HEIGHTS.IDLE)
      window.electronAPI.setWindowButtonsVisible(true)
      window.electronAPI.updateMenuBarState?.(STATES.IDLE)
    }
    setCurrentState(STATES.IDLE)
    stateRef.current = STATES.IDLE
    animateToStateRef.current(STATES.IDLE)
  }

  function openSettings() {
    prevStateRef.current = stateRef.current
    transitionRef.current(STATES.SETTINGS)
  }

  function closeSettings() {
    transitionRef.current(prevStateRef.current || STATES.IDLE)
  }

  return {
    isExpanded,
    isExpandedRef,
    handleExpand,
    handleCollapse,
    openHistory,
    closeHistory,
    openSettings,
    closeSettings,
  }
}
