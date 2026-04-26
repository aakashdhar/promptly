import WaveformCanvas from './WaveformCanvas.jsx'
import MorphCanvas from './MorphCanvas.jsx'

export default function ExpandedTransportBar({
  currentState,
  duration,
  mode,
  modeLabel,
  onStart,
  onStop,
  onPause,
  onCollapse,
  onOpenSettings,
}) {
  const isRecording = currentState === 'RECORDING'
  const isThinking = currentState === 'THINKING'

  const isPolish = mode === 'polish'
  const isRefine = mode === 'refine'
  const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'
  const pillBorder = isPolish ? '0.5px solid rgba(48,209,88,0.3)' : isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)'
  const pillColor = isPolish ? 'rgba(100,220,130,0.9)' : isRefine ? 'rgba(200,160,255,1.0)' : 'rgba(100,180,255,0.85)'

  const pauseBtnBg = isRecording ? 'rgba(255,189,46,0.12)' : 'rgba(255,255,255,0.06)'
  const pauseBtnBorder = isRecording ? '0.5px solid rgba(255,189,46,0.3)' : '0.5px solid rgba(255,255,255,0.1)'
  const pauseBtnAnim = isRecording ? 'pauseGlow 2s ease-in-out infinite' : 'none'
  const pauseIconFill = isRecording ? 'rgba(255,189,46,0.9)' : 'rgba(255,255,255,0.5)'

  return (
    <div style={{
      background: '#111113',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Collapse button — absolutely positioned */}
      <button
        onClick={onCollapse}
        title="Collapse"
        style={{
          position: 'absolute', top: '16px', right: '18px',
          width: '28px', height: '28px', borderRadius: '7px',
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
        <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
          <rect x="0" y="1" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
          <rect x="0" y="7" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
        </svg>
      </button>

      {/* Traffic light drag spacer */}
      <div style={{ height: '36px', WebkitAppRegion: 'drag' }} />

      {/* Transport row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '0 20px 12px' }}>

        {/* Left flank: pause button + timer */}
        <div style={{ width: '140px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <div
            onClick={onPause}
            style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              background: pauseBtnBg, border: pauseBtnBorder,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitAppRegion: 'no-drag',
              animation: pauseBtnAnim,
              transition: 'background 200ms, border 200ms',
            }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <rect x="1" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
              <rect x="6" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
            </svg>
          </div>
          <span style={{
            fontFamily: 'monospace', fontSize: '14px',
            color: 'rgba(255,255,255,0.4)', minWidth: '32px', textAlign: 'right',
            letterSpacing: '0.06em',
            WebkitAppRegion: 'no-drag',
          }}>
            {duration}
          </span>
        </div>

        {/* Centre: mic / stop / thinking button */}
        <div style={{ position: 'relative', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
          {isRecording && (
            <>
              <div style={{
                position: 'absolute', inset: '-8px', borderRadius: '50%',
                border: '1px solid rgba(200,50,35,0.3)',
                animation: 'pulse-ring 2.2s ease-out infinite',
                pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', inset: '-16px', borderRadius: '50%',
                border: '1px solid rgba(200,50,35,0.15)',
                animation: 'pulse-ring 2.2s ease-out infinite 0.7s',
                pointerEvents: 'none',
              }} />
            </>
          )}
          {isThinking ? (
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
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
                width: '60px', height: '60px', borderRadius: '50%',
                background: isRecording ? 'rgba(200,50,35,0.95)' : 'rgba(255,255,255,0.06)',
                border: isRecording ? 'none' : '0.5px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative',
                boxShadow: isRecording ? '0 0 24px rgba(200,50,35,0.4)' : 'none',
                transition: 'background 200ms, box-shadow 200ms',
                animation: isRecording ? 'stop-glow 2s ease-in-out infinite' : 'none',
              }}
            >
              {!isRecording && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.06)',
                  animation: 'breathe 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
              )}
              {isRecording ? (
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none">
                  <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
                </svg>
              ) : (
                <svg width="14" height="16" viewBox="0 0 12 16" fill="none">
                  <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                  <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Right flank: mode pill + settings button */}
        <div style={{ width: '140px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px' }}>
          <span
            onClick={() => { if (window.electronAPI) window.electronAPI.showModeMenu(mode) }}
            style={{
              padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
              background: pillBg, border: pillBorder, color: pillColor,
              cursor: 'pointer', WebkitAppRegion: 'no-drag', whiteSpace: 'nowrap',
            }}
          >
            {modeLabel}
          </span>
          <div
            onClick={onOpenSettings}
            style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitAppRegion: 'no-drag',
              transition: 'background 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <line x1="0" y1="2.5" x2="14" y2="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeLinecap="round" />
              <circle cx="4" cy="2.5" r="1.5" fill="#111113" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
              <line x1="0" y1="9.5" x2="14" y2="9.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeLinecap="round" />
              <circle cx="10" cy="9.5" r="1.5" fill="#111113" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Waveform zone — 60% centre */}
      <div style={{
        height: '44px', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20%', overflow: 'hidden',
      }}>
        {isRecording ? (
          <WaveformCanvas />
        ) : isThinking ? (
          <MorphCanvas />
        ) : (
          <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.08)' }} />
        )}
      </div>
    </div>
  )
}
