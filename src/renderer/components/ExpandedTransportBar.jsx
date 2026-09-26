import { useState, useRef } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import ModeDropdown from './ModeDropdown.jsx'
import useHotkeyWords from '../hooks/useHotkeyWords.js'

// The slim toolbar: one row beside the window buttons. Controls appear only when they mean
// something (pause and the timer only while recording); what's happening is said once, here or
// in the result's own header, never both.
const iconBtn = (active = false) => ({
  width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0, padding: 0, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppRegion: 'no-drag',
  background: active ? 'rgba(10,132,255,0.14)' : 'rgba(var(--ink),0.06)',
  border: active ? '0.5px solid rgba(10,132,255,0.35)' : '0.5px solid rgba(var(--ink),0.1)',
  color: active ? readableColor('rgba(100,180,255,0.9)') : 'var(--text-secondary)',
})

function modeColours(mode) {
  const byMode = {
    polish: ['rgba(48,209,88,0.12)', 'rgba(48,209,88,0.3)', 'rgba(100,220,130,0.9)'],
    refine: ['rgba(168,85,247,0.12)', 'rgba(168,85,247,0.3)', 'rgba(200,160,255,1)'],
    video: ['rgba(251,146,60,0.12)', 'rgba(251,146,60,0.3)', 'rgba(251,146,60,0.85)'],
    workflow: ['rgba(34,197,94,0.12)', 'rgba(34,197,94,0.3)', 'rgba(74,222,128,0.9)'],
    email: ['rgba(20,184,166,0.12)', 'rgba(20,184,166,0.3)', 'rgba(45,212,191,0.9)'],
  }
  return byMode[mode] || ['rgba(10,132,255,0.12)', 'rgba(10,132,255,0.28)', 'rgba(100,180,255,0.85)']
}

export default function ExpandedTransportBar({
  currentState,
  duration,
  mode,
  modeLabel,
  onStart,
  onStop,
  onStopIterate,
  onPause,
  onOpenSettings,
  onTypePrompt,
  generationErrorType,
  onModeSelect,
  onShowShortcuts,
  onShowHistory,
  micQuiet = false,
  historyHidden = false,
  onToggleHistory,
}) {
  const hotkey = useHotkeyWords()
  const isRecording = currentState === 'RECORDING'
  const isPaused = currentState === 'PAUSED'
  const isThinking = currentState === 'THINKING'
  const isTyping = currentState === 'TYPING'
  const isIterating = currentState === 'ITERATING'
  const capturing = isRecording || isPaused || isIterating
  const busy = capturing || isThinking

  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const pillRef = useRef(null)
  const [pillBg, pillBorder, pillColor] = modeColours(mode)

  function handleModePillClick() {
    if (showModeDropdown) { setShowModeDropdown(false); return }
    const rect = pillRef.current?.getBoundingClientRect()
    setDropdownPos({ top: rect ? rect.bottom + 6 : 60, right: rect ? window.innerWidth - rect.right : 20 })
    setShowModeDropdown(true)
  }

  // What the status line says. Recording and working states say it in the result's header.
  let label = ''
  let hint = ''
  let warn = false
  if (isRecording) { hint = micQuiet ? 'Speak up or move closer to the mic' : 'Tap stop when done'; warn = micQuiet }
  else if (isPaused) { label = 'Paused'; hint = 'Tap resume to continue' }
  else if (isIterating) { label = 'Iterating'; hint = 'Tap stop when done' }
  else if (isTyping) { label = 'Type your prompt'; hint = '⌘↵ to generate' }
  else if (isThinking) { label = '' }
  else if (currentState === 'EMAIL_READY') { label = 'Email ready' }
  else if (currentState === 'TRANSCRIPTION_ERROR') { label = 'Transcription failed' }
  else if (currentState === 'GENERATION_ERROR') {
    label = generationErrorType === 'auth' ? 'Not logged in' : generationErrorType === 'timeout' ? 'Claude timed out' : generationErrorType === 'empty' ? 'Empty response' : 'Generation failed'
  } else {
    label = mode === 'dictate' ? 'Ready to dictate' : 'Speak your prompt'
    hint = `${hotkey.needsAccess ? hotkey.fallback : hotkey.action} or click mic to start`
  }

  const modePill = (
    <button
      type="button"
      ref={pillRef}
      id="mode-pill"
      aria-haspopup="dialog"
      onClick={handleModePillClick}
      style={{
        height: '30px', padding: '0 16px', borderRadius: '15px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit',
        background: pillBg, border: `0.5px solid ${pillBorder}`, color: readableColor(pillColor),
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, WebkitAppRegion: 'no-drag',
      }}
    >
      {modeLabel}
    </button>
  )

  const micColour = isRecording || isPaused ? 'rgba(255,69,58,0.95)' : isIterating ? 'rgba(10,132,255,0.95)' : null
  const onMic = isRecording || isPaused ? onStop : isIterating ? onStopIterate : onStart

  return (
    <>
      <div style={{
        height: '56px', flexShrink: 0, position: 'relative',
        display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 0 84px',
        borderBottom: '0.5px solid rgba(var(--ink),0.08)', WebkitAppRegion: 'drag',
      }}>
        <button
          type="button"
          onClick={onToggleHistory}
          aria-label={historyHidden ? 'Show history' : 'Hide history'}
          aria-pressed={historyHidden}
          title={`${historyHidden ? 'Show' : 'Hide'} history (⌃⌘S)`}
          style={{ ...iconBtn(historyHidden), background: historyHidden ? 'rgba(var(--ink),0.08)' : 'transparent', border: historyHidden ? '0.5px solid rgba(var(--ink),0.12)' : '0.5px solid transparent', color: historyHidden ? 'rgba(var(--ink),0.85)' : 'var(--text-secondary)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M9 5v14" /><path d="M5.5 9h1.5M5.5 12h1.5" strokeLinecap="round" /></svg>
        </button>

        {/* Mic: starts, and while recording becomes the stop button. */}
        <button
          type="button"
          onClick={isThinking ? undefined : onMic}
          disabled={isThinking}
          aria-label={capturing ? 'Stop' : 'Start talking'}
          style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppRegion: 'no-drag',
            cursor: isThinking ? 'default' : 'pointer', opacity: isThinking ? 0.45 : 1,
            background: micColour || 'rgba(var(--ink),0.07)',
            border: micColour ? 'none' : '0.5px solid rgba(var(--ink),0.14)',
            boxShadow: isRecording ? '0 0 0 4px rgba(255,69,58,0.18)' : isIterating ? '0 0 0 4px rgba(10,132,255,0.18)' : 'none',
            animation: isRecording ? 'mic-ring 1.6s ease-in-out infinite' : 'none',
            transition: 'background 200ms, box-shadow 200ms, opacity 200ms',
          }}
        >
          {capturing ? (
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fff' }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink),0.8)" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          )}
        </button>

        {(isRecording || isPaused) && (
          <button type="button" onClick={onPause} aria-label={isPaused ? 'Resume' : 'Pause'} style={iconBtn(isPaused)}>
            {isPaused ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            )}
          </button>
        )}
        {capturing && (
          <span style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: '14px', letterSpacing: '0.04em', color: 'rgba(var(--ink),0.9)', minWidth: '40px', flexShrink: 0 }}>
            {duration}
          </span>
        )}

        {!busy && modePill}
        {!busy && (
          <button type="button" onClick={onTypePrompt} aria-label="Type instead" title="Type instead (⌘T)" style={iconBtn(isTyping)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" strokeLinecap="round" /></svg>
          </button>
        )}

        {(label || hint) && (
          <div role={warn ? 'status' : undefined} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0, marginLeft: '4px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {label && <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(var(--ink),0.92)' }}>{label}</span>}
            {hint && (
              <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', ...(warn ? { color: readableColor('rgba(255,159,10,0.95)'), fontWeight: 600 } : { color: 'var(--text-secondary)' }) }}>
                {hint}
              </span>
            )}
          </div>
        )}

        <div style={{ flex: 1 }} />
        {busy && modePill}
        {onOpenSettings && (
          <button type="button" onClick={onOpenSettings} aria-label="Settings" title="Settings (⌘/)" style={iconBtn()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
        )}

        {/* Working: a thin sweep along the bottom edge. */}
        {isThinking && <span aria-hidden="true" className="toolbar-sweep" />}
      </div>

      {showModeDropdown && (
        <ModeDropdown
          mode={mode}
          top={dropdownPos.top}
          right={dropdownPos.right}
          onSelect={onModeSelect}
          onShowShortcuts={onShowShortcuts}
          onShowHistory={onShowHistory}
          onClose={() => setShowModeDropdown(false)}
          anchorRef={pillRef}
        />
      )}
    </>
  )
}
