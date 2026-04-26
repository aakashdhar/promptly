import { useState, useEffect, useRef } from 'react'
import WaveformCanvas from './WaveformCanvas.jsx'
import MorphCanvas from './MorphCanvas.jsx'
import { getHistory } from '../utils/history.js'

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',
}

function parseSections(text) {
  if (!text) return []
  const lines = text.split('\n')
  const sections = []
  let current = null
  let bodyLines = []

  function flush() {
    if (current !== null) {
      sections.push({ label: current, body: bodyLines.join('\n').trim() })
      bodyLines = []
      current = null
    }
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      current = m[1].trim()
    } else {
      bodyLines.push(line)
    }
  }
  flush()

  if (sections.length === 0 && text.trim()) {
    sections.push({ label: null, body: text.trim() })
  }
  return sections
}

export default function ExpandedView({
  currentState,
  mode,
  modeLabel,
  duration,
  generatedPrompt,
  originalTranscript,
  thinkTranscript,
  onStart,
  onCollapse,
  onPause,
  onStop,
  onRegenerate,
  onReset,
  onIterate,
  isIterated,
  setGeneratedPrompt,
  isPolishMode,
  polishResult,
  polishTone,
  onPolishToneChange,
  onPolishCopy,
  polishCopied,
}) {
  const [history, setHistory] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editHovered, setEditHovered] = useState(false)
  const promptRef = useRef(null)
  const preEditValue = useRef('')

  useEffect(() => {
    setHistory(getHistory())
  }, [currentState])

  useEffect(() => {
    if (currentState === STATES.PROMPT_READY) {
      setIsEditing(false)
      setIsCopied(false)
    }
  }, [currentState])

  useEffect(() => {
    if (isEditing && promptRef.current) {
      promptRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(promptRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [isEditing])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && isEditing) {
        if (promptRef.current) promptRef.current.textContent = preEditValue.current
        setIsEditing(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditing])

  function handleCopy() {
    const text = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt
    if (window.electronAPI) window.electronAPI.copyToClipboard(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1800)
  }

  function handleEdit() {
    if (!isEditing) {
      preEditValue.current = generatedPrompt
      setIsEditing(true)
    } else {
      if (promptRef.current) setGeneratedPrompt(promptRef.current.textContent)
      setIsEditing(false)
    }
  }

  const isRecording = currentState === STATES.RECORDING
  const isThinking = currentState === STATES.THINKING
  const isReady = currentState === STATES.PROMPT_READY

  const isRefine = mode === 'refine'
  const isPolish = mode === 'polish'
  const accentColor = isPolish ? 'rgba(48,209,88,' : isRefine ? 'rgba(168,85,247,' : 'rgba(10,132,255,'
  const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'
  const pillBorder = isPolish ? '0.5px solid rgba(48,209,88,0.3)' : isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)'
  const pillColor = isPolish ? 'rgba(100,220,130,0.9)' : isRefine ? 'rgba(200,160,255,1.0)' : 'rgba(100,180,255,0.85)'

  const sections = parseSections(generatedPrompt)
  const mid = Math.ceil(sections.length / 2)
  const leftSections = sections.slice(0, mid)
  const rightSections = sections.slice(mid)
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0e0e0f', position: 'relative' }}>

      {/* ── ZONE 1: TOP BAR ── */}
      <div style={{ background: '#111113', borderBottom: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>

        {/* Traffic light row + collapse button */}
        <div style={{ height: '36px', WebkitAppRegion: 'drag', position: 'relative' }}>
          <button
            onClick={onCollapse}
            title="Collapse"
            style={{
              position: 'absolute', top: '7px', right: '16px',
              width: '26px', height: '26px', borderRadius: '7px',
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 20,
              WebkitAppRegion: 'no-drag', padding: 0,
              transition: 'background 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <svg width="12" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0" y="1" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
              <rect x="0" y="7" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
            </svg>
          </button>
        </div>

        {/* Transport row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '0 20px 10px' }}>

          {/* Left flank */}
          <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            {isRecording && (
              <div
                onClick={onPause}
                style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,189,46,0.12)', border: '0.5px solid rgba(255,189,46,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', WebkitAppRegion: 'no-drag',
                  animation: 'pauseGlow 2s ease-in-out infinite',
                }}
              >
                <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                  <rect x="1" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)" />
                  <rect x="6" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)" />
                </svg>
              </div>
            )}
            <span style={{
              fontFamily: 'monospace', fontSize: '11px',
              color: 'rgba(255,255,255,0.4)', minWidth: '32px', textAlign: 'right',
              WebkitAppRegion: 'no-drag',
            }}>
              {duration}
            </span>
          </div>

          {/* Centre: record button */}
          <div style={{ position: 'relative', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
            {isRecording && (
              <>
                <div style={{
                  position: 'absolute', inset: '-8px', borderRadius: '50%',
                  border: '1.5px solid rgba(200,50,35,0.35)',
                  animation: 'pulse-inner 2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', inset: '-16px', borderRadius: '50%',
                  border: '1px solid rgba(200,50,35,0.15)',
                  animation: 'pulse-expand 2s ease-out infinite 0.5s',
                  pointerEvents: 'none',
                }} />
              </>
            )}
            {isThinking ? (
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
                  style={{ animation: 'spin 1s linear infinite', position: 'absolute' }}>
                  <circle cx="20" cy="20" r="17" stroke="rgba(10,132,255,0.12)" strokeWidth="2" />
                  <path d="M20 3 A17 17 0 0 1 37 20" stroke="rgba(10,132,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                }} />
              </div>
            ) : (
              <div
                onClick={isRecording ? onStop : onStart}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: isRecording ? 'rgba(200,50,35,0.95)' : 'rgba(255,255,255,0.06)',
                  border: isRecording ? 'none' : '0.5px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isRecording ? '0 0 24px rgba(200,50,35,0.4)' : 'none',
                  transition: 'background 200ms, box-shadow 200ms',
                  animation: isRecording ? 'stop-glow 2s ease-in-out infinite' : 'none',
                }}
              >
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 10 10" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
                  </svg>
                ) : (
                  <svg width="14" height="16" viewBox="0 0 12 16" fill="none" style={{ animation: 'mic-breathe 3s ease-in-out infinite' }}>
                    <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,180,255,1)" strokeWidth="1" />
                    <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
                    <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Right flank */}
          <div style={{ width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px' }}>
            <span
              onClick={() => { if (window.electronAPI) window.electronAPI.showModeMenu(mode) }}
              style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: 500,
                background: pillBg, border: pillBorder, color: pillColor,
                cursor: 'pointer', WebkitAppRegion: 'no-drag', whiteSpace: 'nowrap',
              }}
            >
              {modeLabel}
            </span>
          </div>
        </div>

        {/* Waveform zone */}
        <div style={{ height: '36px', width: '100%', overflow: 'hidden' }}>
          {isRecording ? (
            <WaveformCanvas />
          ) : isThinking ? (
            <MorphCanvas />
          ) : (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ height: '1px', width: '60%', background: 'rgba(255,255,255,0.08)' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── ZONES 2 + 3: BODY ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>

        {/* ── ZONE 2: LEFT PANEL ── */}
        <div style={{
          width: '228px', flexShrink: 0,
          background: '#0e0e0f',
          borderRight: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
            padding: '14px 16px 8px',
          }}>
            Session History
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {history.length === 0 ? (
              <div style={{
                fontSize: '11px', color: 'rgba(255,255,255,0.25)',
                textAlign: 'center', padding: '24px 0',
              }}>
                No history yet
              </div>
            ) : (
              history.map(entry => {
                const isActive = activeId === entry.id
                const isHovered = hoveredId === entry.id && !isActive
                const d = new Date(entry.timestamp)
                const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <div
                    key={entry.id}
                    onClick={() => setActiveId(entry.id)}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: isActive ? '8px 8px 8px 6px' : '8px',
                      borderRadius: '6px',
                      marginBottom: '2px',
                      cursor: 'pointer',
                      borderLeft: isActive ? '2px solid rgba(10,132,255,0.5)' : '2px solid transparent',
                      background: isActive
                        ? 'rgba(10,132,255,0.07)'
                        : isHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.25)' }}>
                        {ts}
                      </span>
                      <span style={{
                        fontSize: '9px', color: 'rgba(255,255,255,0.3)',
                        background: 'rgba(255,255,255,0.06)', borderRadius: '4px',
                        padding: '1px 5px',
                      }}>
                        {entry.mode}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px', color: 'rgba(255,255,255,0.72)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.title}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── ZONE 3: RIGHT PANEL ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#0e0e0f', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {currentState === STATES.IDLE && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.82)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                Speak your prompt
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', letterSpacing: '-0.01em' }}>
                Press ⌥ Space or click mic to start
              </div>
            </div>
          )}

          {currentState === STATES.RECORDING && (
            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '8px' }}>
                Listening...
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                Speak now. Recording will stop when you tap the square.
              </div>
            </div>
          )}

          {(currentState === STATES.PAUSED) && (
            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,189,46,0.75)', marginBottom: '8px' }}>
                Paused
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                Tap resume to continue recording.
              </div>
            </div>
          )}

          {currentState === STATES.THINKING && (
            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>
                Generating prompt...
              </div>
              {thinkTranscript && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{thinkTranscript}"
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['80%', '60%', '70%'].map((w, i) => (
                  <div key={i} style={{
                    height: '12px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.06)', width: w,
                    animation: `pulse-inner ${1.2 + i * 0.3}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {currentState === STATES.PROMPT_READY && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px 12px', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
                  <span style={{ color: 'var(--color-green, #30D158)', fontSize: '15px', textShadow: '0 0 8px rgba(48,209,88,0.5)' }}>✓</span>
                  <span>Prompt ready</span>
                  {isIterated && (
                    <span style={{
                      fontSize: '10px', color: 'rgba(10,132,255,0.72)',
                      background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.2)',
                      borderRadius: '20px', padding: '1px 8px', letterSpacing: '.04em',
                    }}>↻ iterated</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '14px' }}>
                  <button onClick={onIterate} style={{ fontSize: '11px', color: 'rgba(10,132,255,0.85)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    ↻ Iterate
                  </button>
                  <button onClick={onRegenerate} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Regenerate
                  </button>
                  <button onClick={onReset} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Reset
                  </button>
                </div>
              </div>

              <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 20px', flexShrink: 0 }} />

              {/* Two-column prompt content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {isEditing ? (
                  <div
                    ref={promptRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      fontSize: '13px', lineHeight: '1.75', color: 'rgba(255,255,255,0.78)',
                      whiteSpace: 'pre-wrap', outline: '1.5px solid rgba(10,132,255,0.6)',
                      outlineOffset: '4px', borderRadius: '6px', minHeight: '100px',
                    }}
                  >
                    {generatedPrompt}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      {leftSections.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < leftSections.length - 1 ? '16px' : 0 }}>
                          {s.label && (
                            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                              {s.label}
                            </div>
                          )}
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.75' }}>
                            {s.body}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      {rightSections.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < rightSections.length - 1 ? '16px' : 0 }}>
                          {s.label && (
                            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                              {s.label}
                            </div>
                          )}
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.75' }}>
                            {s.body}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 20px' }} />
                <div style={{ display: 'flex', gap: '10px', padding: '12px 20px 16px', alignItems: 'center' }}>
                  <button
                    onClick={handleEdit}
                    onMouseEnter={() => setEditHovered(true)}
                    onMouseLeave={() => setEditHovered(false)}
                    style={{
                      height: '36px', padding: '0 20px',
                      border: editHovered ? '0.5px solid rgba(255,255,255,0.16)' : '0.5px solid rgba(255,255,255,0.1)',
                      background: editHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.70)', borderRadius: '8px',
                      fontSize: '12px', cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={handleCopy}
                    style={{
                      height: '36px', padding: '0 20px',
                      border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.20)',
                      background: isCopied
                        ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))'
                        : 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
                      color: 'white', borderRadius: '8px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      boxShadow: isCopied ? '0 2px 16px rgba(48,209,88,0.35)' : '0 2px 20px rgba(10,132,255,0.4)',
                      transition: 'all 300ms ease',
                    }}
                  >
                    {isCopied ? '✓ Copied' : 'Copy prompt'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spin keyframe for thinking arc */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
