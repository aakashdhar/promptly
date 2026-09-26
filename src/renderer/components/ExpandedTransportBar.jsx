import { useState, useRef, useLayoutEffect } from 'react'
import { readableColor } from '../utils/promptUtils.js'
import WaveformCanvas from './WaveformCanvas.jsx'
import MorphCanvas from './MorphCanvas.jsx'
import { getModeAccent } from '../utils/thinkingLabels.js'
import ModeDropdown from './ModeDropdown.jsx'
import useHotkeyWords from '../hooks/useHotkeyWords.js'

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
  onAbort,
  generationErrorType,
  thinkingElapsed,
  thinkingCurrentLabel,
  thinkingLabelOpacity,
  onModeSelect,
  onShowShortcuts,
  onShowHistory,
  micQuiet = false,
}) {
  const hotkey = useHotkeyWords()
  const isRecording = currentState === 'RECORDING'
  const isThinking = currentState === 'THINKING'
  const isTyping = currentState === 'TYPING'
  const isIterating = currentState === 'ITERATING'
  const isPaused = currentState === 'PAUSED'
  const isTranscriptionError = currentState === 'TRANSCRIPTION_ERROR'
  const isGenerationError = currentState === 'GENERATION_ERROR'

  const isVideo = mode === 'video'
  const isWorkflow = mode === 'workflow'
  const isEmail = mode === 'email'
  const isPolish = mode === 'polish'
  const isRefine = mode === 'refine'
  const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : isVideo ? 'rgba(251,146,60,0.12)' : isWorkflow ? 'rgba(34,197,94,0.12)' : isEmail ? 'rgba(20,184,166,0.12)' : 'rgba(10,132,255,0.12)'
  const pillBorder = isPolish ? '0.5px solid rgba(48,209,88,0.3)' : isRefine ? '0.5px solid rgba(168,85,247,0.3)' : isVideo ? '0.5px solid rgba(251,146,60,0.3)' : isWorkflow ? '0.5px solid rgba(34,197,94,0.3)' : isEmail ? '0.5px solid rgba(20,184,166,0.3)' : '0.5px solid rgba(10,132,255,0.25)'
  const pillColor = isPolish ? 'rgba(100,220,130,0.9)' : isRefine ? 'rgba(200,160,255,1.0)' : isVideo ? 'rgba(251,146,60,0.85)' : isWorkflow ? 'rgba(74,222,128,0.9)' : isEmail ? 'rgba(45,212,191,0.9)' : 'rgba(100,180,255,0.85)'

  const pauseBtnBg = isRecording ? 'rgba(255,189,46,0.12)' : 'rgba(var(--ink),0.06)'
  const pauseBtnBorder = isRecording ? '0.5px solid rgba(255,189,46,0.3)' : '0.5px solid rgba(var(--ink),0.1)'
  const pauseIconFill = isRecording ? 'rgba(255,189,46,0.9)' : 'rgba(var(--ink),0.5)'

  const transportRef = useRef(null)
  const [waveWidth, setWaveWidth] = useState(0)
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const pillRef = useRef(null)

  function handleModePillClick() {
    if (showModeDropdown) { setShowModeDropdown(false); return }
    const rect = pillRef.current?.getBoundingClientRect()
    const top = rect ? rect.bottom + 6 : 90
    const right = rect ? window.innerWidth - rect.right : 20
    setDropdownPos({ top, right })
    setShowModeDropdown(true)
  }

  useLayoutEffect(() => {
    const el = transportRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setWaveWidth(entry.contentRect.width))
    obs.observe(el)
    setWaveWidth(el.getBoundingClientRect().width)
    return () => obs.disconnect()
  }, [])

  const isEmailReady = currentState === 'EMAIL_READY'

  let textLine1, textLine2, textDot
  if (isRecording) {
    textLine1 = 'Listening...'; textLine2 = micQuiet ? 'Speak up or move closer to the mic' : 'Tap stop when done'; textDot = 'recording'
  } else if (isThinking) {
    textLine1 = ''; textLine2 = ''; textDot = null
  } else if (isIterating) {
    textLine1 = 'Iterating...'; textLine2 = 'Tap stop when done'; textDot = 'iterating'
  } else if (isPaused) {
    textLine1 = 'Paused'; textLine2 = 'Tap resume to continue'; textDot = null
  } else if (isTyping) {
    textLine1 = 'Type your prompt'; textLine2 = '⌘↵ to generate'; textDot = null
  } else if (isEmailReady) {
    textLine1 = 'Email ready'; textLine2 = ''; textDot = 'email-ready'
  } else if (isTranscriptionError) {
    textLine1 = 'Transcription failed'; textLine2 = ''; textDot = 'error'
  } else if (isGenerationError) {
    if (generationErrorType === 'auth') {
      textLine1 = 'Not logged in'; textLine2 = ''; textDot = 'gen-warn'
    } else if (generationErrorType === 'timeout') {
      textLine1 = 'Claude timed out'; textLine2 = ''; textDot = 'gen-warn'
    } else if (generationErrorType === 'empty') {
      textLine1 = 'Empty response'; textLine2 = ''; textDot = 'gen-warn'
    } else {
      textLine1 = 'Generation failed'; textLine2 = ''; textDot = 'error'
    }
  } else {
    textLine1 = mode === 'dictate' ? 'Ready to dictate' : 'Speak your prompt'; textLine2 = hotkey.needsAccess ? `${hotkey.fallback} or click mic to start` : `${hotkey.action} or click mic to start`; textDot = null
  }

  const dotColor = textDot === 'recording' ? 'rgba(200,50,35,0.85)'
    : textDot === 'iterating' ? 'rgba(10,132,255,0.85)'
    : textDot === 'email-ready' ? 'rgba(20,184,166,0.85)'
    : textDot === 'error' ? 'rgba(255,59,48,0.85)'
    : textDot === 'gen-warn' ? 'rgba(255,189,46,0.85)'
    : 'transparent'

  return (
    <>
    <div style={{
      background: 'transparent',
      borderBottom: '0.5px solid rgba(var(--ink),0.06)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Traffic-light drag spacer, with Settings at the right */}
      <div style={{
        height: '36px', WebkitAppRegion: 'drag',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px',
      }}>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Settings (⌘/)"
            style={{
              width: '28px', height: '28px', borderRadius: '7px',
              background: 'rgba(var(--ink),0.05)',
              border: '0.5px solid rgba(var(--ink),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              WebkitAppRegion: 'no-drag', padding: 0,
              transition: 'background 150ms', flexShrink: 0, marginRight: '18px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--ink),0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(var(--ink),0.05)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="rgba(var(--ink),0.5)" strokeWidth="1.5"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="rgba(var(--ink),0.5)" strokeWidth="1.5"/>
            </svg>
          </button>
        )}
      </div>

      {/* Transport row — inline-flex, shrinks to content, centred */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px 10px' }}>
        <div
          ref={transportRef}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '12px',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {/* Pause button — 36px */}
          <div
            onClick={onPause}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: pauseBtnBg, border: pauseBtnBorder,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 200ms, border 200ms, opacity 200ms',
              opacity: isTyping || isIterating ? 0.35 : 1,
            }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <rect x="1" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
              <rect x="6" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
            </svg>
          </div>

          {/* Timer */}
          <span style={{
            fontFamily: 'monospace', fontSize: '13px',
            color: 'var(--text-secondary)', minWidth: '28px', textAlign: 'right',
            letterSpacing: '0.06em',
            // The timer means nothing while typing: hidden, keeping its space so nothing shifts.
            visibility: isTyping || isIterating ? 'hidden' : 'visible',
          }}>
            {duration}
          </span>

          {/* Mic / Stop / Thinking — 52px */}
          <div style={{ position: 'relative', flexShrink: 0, opacity: isTyping ? 0.5 : 1, transition: 'opacity 200ms' }}>
            {isRecording && (
              <>
                <div style={{
                  position: 'absolute', inset: '-7px', borderRadius: '50%',
                  border: '1px solid rgba(200,50,35,0.3)',
                  animation: 'pulse-ring 2.2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', inset: '-14px', borderRadius: '50%',
                  border: '1px solid rgba(200,50,35,0.15)',
                  animation: 'pulse-ring 2.2s ease-out infinite 0.7s',
                  pointerEvents: 'none',
                }} />
              </>
            )}
            {isIterating && (
              <>
                <div style={{
                  position: 'absolute', inset: '-7px', borderRadius: '50%',
                  border: '1px solid rgba(10,132,255,0.3)',
                  animation: 'pulse-ring 2.2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', inset: '-14px', borderRadius: '50%',
                  border: '1px solid rgba(10,132,255,0.15)',
                  animation: 'pulse-ring 2.2s ease-out infinite 0.7s',
                  pointerEvents: 'none',
                }} />
              </>
            )}
            {isThinking ? (
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: 'rgba(var(--ink),0.06)',
                border: '0.5px solid rgba(var(--ink),0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="36" height="36" viewBox="0 0 40 40" fill="none"
                  style={{ animation: 'spin 1s linear infinite', position: 'absolute' }}>
                  <circle cx="20" cy="20" r="17" stroke="rgba(10,132,255,0.12)" strokeWidth="2" />
                  <path d="M20 3 A17 17 0 0 1 37 20" stroke="rgba(10,132,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(var(--ink),0.04)',
                  border: '0.5px solid rgba(var(--ink),0.08)',
                }} />
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label={isRecording || isIterating ? 'Stop' : 'Start talking'}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (isRecording ? onStop : isIterating ? onStopIterate : onStart)?.() } }}
                onClick={isRecording ? onStop : isIterating ? onStopIterate : onStart}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: isRecording
                    ? 'rgba(200,50,35,0.95)'
                    : isIterating
                      ? 'rgba(10,132,255,0.95)'
                      : 'rgba(var(--ink),0.06)',
                  border: (isRecording || isIterating) ? 'none' : '0.5px solid rgba(var(--ink),0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: isRecording
                    ? '0 0 20px rgba(200,50,35,0.4)'
                    : isIterating
                      ? '0 0 20px rgba(10,132,255,0.4)'
                      : 'none',
                  transition: 'background 200ms, box-shadow 200ms',
                  animation: isRecording
                    ? 'stop-glow 2s ease-in-out infinite'
                    : isIterating
                      ? 'iterGlow 2s ease-in-out infinite'
                      : 'none',
                }}
              >
                {!isRecording && !isIterating && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '1px solid rgba(var(--ink),0.06)',
                    animation: 'breathe 3s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}
                {(isRecording || isIterating) ? (
                  <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
                  </svg>
                ) : (
                  <svg width="13" height="15" viewBox="0 0 12 16" fill="none">
                    <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(var(--ink),0.55)" strokeWidth="1" />
                    <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(var(--ink),0.55)" strokeWidth="1" strokeLinecap="round" />
                    <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(var(--ink),0.55)" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Mode pill */}
          <button
            type="button"
            ref={pillRef}
            id="mode-pill"
            aria-haspopup="dialog"
            onClick={handleModePillClick}
            style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
              background: pillBg, border: pillBorder, color: readableColor(pillColor),
              cursor: 'pointer', whiteSpace: 'nowrap',
              WebkitAppRegion: 'no-drag',
            }}
          >
            {modeLabel}
          </button>

          {/* Type button — 36px */}
          <div
            onClick={onTypePrompt}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: isTyping ? 'rgba(10,132,255,0.15)' : 'rgba(var(--ink),0.06)',
              border: isTyping ? '0.5px solid rgba(10,132,255,0.35)' : '0.5px solid rgba(var(--ink),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 150ms, border 150ms',
            }}
            onMouseEnter={e => { if (!isTyping) e.currentTarget.style.background = 'rgba(var(--ink),0.1)' }}
            onMouseLeave={e => { if (!isTyping) e.currentTarget.style.background = 'rgba(var(--ink),0.06)' }}
          >
            <svg width="14" height="10" viewBox="0 0 15 11" fill="none">
              <rect x="0.5" y="0.5" width="14" height="10" rx="2" stroke={isTyping ? 'rgba(100,180,255,0.8)' : 'rgba(var(--ink),0.45)'} strokeWidth="1"/>
              <rect x="2.5" y="3" width="2" height="1.5" rx="0.5" fill={isTyping ? 'rgba(100,180,255,0.8)' : 'rgba(var(--ink),0.45)'}/>
              <rect x="6.25" y="3" width="2" height="1.5" rx="0.5" fill={isTyping ? 'rgba(100,180,255,0.8)' : 'rgba(var(--ink),0.45)'}/>
              <rect x="10" y="3" width="2" height="1.5" rx="0.5" fill={isTyping ? 'rgba(100,180,255,0.8)' : 'rgba(var(--ink),0.45)'}/>
              <rect x="2.5" y="6.5" width="10" height="1.5" rx="0.5" fill={isTyping ? 'rgba(100,180,255,0.8)' : 'rgba(var(--ink),0.45)'}/>
            </svg>
          </div>

          {/* Reset / abort button — 36px */}
          <div
            onClick={currentState !== 'IDLE' ? onAbort : undefined}
            title="Reset to start"
            style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(var(--ink),0.06)',
              border: '0.5px solid rgba(var(--ink),0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentState === 'IDLE' ? 'default' : 'pointer',
              opacity: currentState === 'IDLE' ? 0.3 : 1,
              transition: 'background 150ms, opacity 150ms',
            }}
            onMouseEnter={e => { if (currentState !== 'IDLE') e.currentTarget.style.background = 'rgba(var(--ink),0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(var(--ink),0.06)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M9 3H4.5A2.5 2.5 0 0 0 2 5.5v0A2.5 2.5 0 0 0 4.5 8H8"
                stroke="rgba(var(--ink),0.45)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M6.5 5.5L9 3L6.5 0.5"
                stroke="rgba(var(--ink),0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Divider */}
          <div style={{ width: '0.5px', height: '28px', background: 'rgba(var(--ink),0.1)', flexShrink: 0 }} />

          {/* State text block — fixed width so label changes never shift buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '220px', flexShrink: 0, overflow: 'hidden' }}>
            {isThinking ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontSize: '13px', fontWeight: 500,
                  color: 'rgba(var(--ink),0.8)',
                  opacity: thinkingLabelOpacity,
                  transition: 'opacity 150ms ease',
                }}>
                  <div style={{ animation: 'spin 1.1s linear infinite', flexShrink: 0, display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="12"
                        stroke="rgba(var(--ink),0.15)" strokeWidth="3" />
                      <path d="M16 4A12 12 0 0 1 28 16"
                        stroke={getModeAccent(mode)} strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                  {thinkingCurrentLabel}
                </div>
                <div style={{
                  fontFamily: 'monospace', fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  paddingLeft: '19px',
                }}>
                  {`${Math.floor(thinkingElapsed / 60)}:${(thinkingElapsed % 60).toString().padStart(2, '0')}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {textDot && (
                    <div style={{
                      width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                      background: dotColor,
                      animation: textDot === 'recording' ? 'cursor-blink 1.1s ease-in-out infinite'
                        : 'pulse-ring 2s ease-out infinite',
                    }} />
                  )}
                  <span style={{
                    fontSize: '12px', fontWeight: 500, color: 'rgba(var(--ink),0.95)',
                    letterSpacing: '-0.01em',
                  }}>
                    {textLine1}
                  </span>
                </div>
                {textLine2 && (
                  <span role={isRecording && micQuiet ? 'status' : undefined} style={{
                    fontSize: '11px', paddingLeft: textDot ? '11px' : '0',
                    ...(isRecording && micQuiet
                      ? { color: readableColor('rgba(255,159,10,0.95)'), fontWeight: 600 }
                      : { color: 'var(--text-tertiary)' }),
                  }}>
                    {textLine2}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Waveform — same pixel width as transport row */}
      <div style={{
        height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 0 10px',
      }}>
        <div style={{
          width: waveWidth > 0 ? `${waveWidth}px` : '60%',
          height: '24px', display: 'flex', alignItems: 'center', overflow: 'hidden',
          maskImage: (isRecording || isThinking || isIterating)
            ? 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' : undefined,
          WebkitMaskImage: (isRecording || isThinking || isIterating)
            ? 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' : undefined,
        }}>
          {isRecording ? (
            <WaveformCanvas />
          ) : isThinking || isIterating ? (
            <MorphCanvas />
          ) : (
            <div style={{ height: '1px', width: '100%', background: 'rgba(var(--ink),0.07)' }} />
          )}
        </div>
      </div>
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
