export default function IdleState({ mode, modeLabel, onStart, onTypePrompt, polishTone, onPolishToneChange, onExpand }) {
  const isRefine = mode === 'refine'
  const isPolish = mode === 'polish'

  function handleModePillClick(e) {
    e.stopPropagation()
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  const ringColor = isPolish ? 'rgba(48,209,88,' : isRefine ? 'rgba(168,85,247,' : 'rgba(10,132,255,'
  const micStroke = isRefine ? 'rgba(200,160,255,0.8)' : 'rgba(100,180,255,1)'
  const micStrokeFaded = isRefine ? 'rgba(200,160,255,0.8)' : 'rgba(100,180,255,0.85)'

  return (
    <div id="panel-idle" className="relative z-[1]" style={{height:'134px'}}>
      <div
        style={{
          height: '28px', display: 'flex', justifyContent: 'flex-end',
          alignItems: 'center', WebkitAppRegion: 'drag',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          title="Expand"
          style={{
            width: '22px', height: '22px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.09)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginRight: '14px',
            WebkitAppRegion: 'no-drag', flexShrink: 0,
            padding: 0, transition: 'background 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M1 4.5V1.5A0.5 0.5 0 0 1 1.5 1H4.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7.5 1H10.5A0.5 0.5 0 0 1 11 1.5V4.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 7.5V10.5A0.5 0.5 0 0 1 10.5 11H7.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 11H1.5A0.5 0.5 0 0 1 1 10.5V7.5" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div
        className="relative flex items-center justify-center h-[90px]"
        id="idle-area"
        style={{WebkitAppRegion:'drag'}}
        onClick={onStart}
      >
        {/* Mic pulse ring — anchored left */}
        <div
          className="absolute left-[28px] w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            WebkitAppRegion: 'no-drag',
            background: `${ringColor}0.12)`,
            border: `1px solid ${ringColor}0.35)`,
            boxShadow: isPolish
              ? '0 0 12px rgba(48,209,88,0.2)'
              : isRefine
                ? '0 0 12px rgba(168,85,247,0.2)'
                : '0 0 12px rgba(10,132,255,0.3), 0 0 24px rgba(10,132,255,0.12)',
          }}
        >
          {/* POLISH-005: two-ring staggered pulse */}
          <div
            className="absolute w-10 h-10 rounded-full pointer-events-none"
            style={{
              border: `1.5px solid ${ringColor}0.35)`,
              animation: 'pulse-inner 2s ease-out infinite',
            }}
          />
          <div
            className="absolute w-10 h-10 rounded-full pointer-events-none"
            style={{
              border: `1px solid ${ringColor}0.18)`,
              animation: 'pulse-expand 2s ease-out infinite 0.5s',
            }}
          />
          {isPolish ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h8M2 12h10" stroke="rgba(100,220,130,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="13" cy="12" r="2.5" fill="rgba(48,209,88,0.3)" stroke="rgba(100,220,130,0.8)" strokeWidth="1"/>
              <path d="M12 12l1 1 1.5-1.5" stroke="rgba(100,220,130,0.9)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg
              width="13" height="15" viewBox="0 0 12 16" fill="none"
              style={{ animation: 'mic-breathe 3s ease-in-out infinite' }}
            >
              <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke={micStroke} strokeWidth="1" />
              <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
              <line x1="6" y1="13.5" x2="6" y2="15.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Text — left-anchored near mic */}
        <div style={{position:'absolute', left:'78px', textAlign:'left', WebkitAppRegion:'no-drag'}}>
          {/* POLISH-003: status text */}
          <div
            className="text-[13px] font-medium mb-[3px]"
            style={{ color:'rgba(255,255,255,0.82)', letterSpacing:'-0.01em' }}
          >
            Promptly is ready
          </div>
          {/* POLISH-009: subtitle from 0.18 → 0.48 */}
          <div
            className="text-[11px]"
            style={{ color:'rgba(255,255,255,0.48)', letterSpacing:'-0.01em' }}
          >
            {isPolish ? "Speak it rough — get it polished" : isRefine ? "Describe what exists, what's wrong, and what you want" : '⌥ Space to speak · ⌘T to type'}
          </div>
          {/* POLISH-009: hint from 0.10 → 0.40 */}
          <span className="text-[9px] mt-[4px] block" style={{color:'rgba(255,255,255,0.40)'}}>⌘? for shortcuts</span>
        </div>

        {/* Keyboard icon — type prompt */}
        <div
          onClick={(e) => { e.stopPropagation(); onTypePrompt(); }}
          title="Type prompt (⌘T)"
          style={{
            position:'absolute', right: isPolish ? '156px' : '108px',
            width:'32px', height:'32px', borderRadius:'9px',
            background:'rgba(255,255,255,0.05)',
            border:'0.5px solid rgba(255,255,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
            WebkitAppRegion:'no-drag',
            transition:'background 150ms'
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <rect x="1" y="1" width="12" height="8" rx="2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2"/>
            <line x1="3.5" y1="4" x2="10.5" y2="4" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="3.5" y1="6.5" x2="7.5" y2="6.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Mode pill / tone toggle — anchored right */}
        {isPolish ? (
          <div style={{
            position:'absolute', right:'20px',
            display:'flex', flexDirection:'row', alignItems:'center', gap:'6px',
            flexShrink:0, WebkitAppRegion:'no-drag'
          }}>
            {/* Tone pill — opens native menu like mode selector */}
            <span
              onClick={(e) => { e.stopPropagation(); if (window.electronAPI) window.electronAPI.showToneMenu(polishTone) }}
              style={{
                padding:'4px 12px', borderRadius:'20px', fontSize:'10px',
                fontWeight:500, cursor:'pointer', textAlign:'center',
                background:'rgba(48,209,88,0.08)',
                border:'0.5px solid rgba(48,209,88,0.2)',
                color:'rgba(100,220,130,0.75)', whiteSpace:'nowrap'
              }}
            >
              {polishTone === 'formal' ? 'Formal' : 'Casual'}
            </span>
            {/* Mode pill — click to change mode */}
            <span
              id="mode-pill"
              style={{
                padding:'4px 12px', borderRadius:'20px', fontSize:'10px',
                fontWeight:500, cursor:'pointer', textAlign:'center',
                background:'rgba(48,209,88,0.12)',
                border:'0.5px solid rgba(48,209,88,0.3)',
                color:'rgba(100,220,130,0.9)', whiteSpace:'nowrap'
              }}
              onClick={handleModePillClick}
            >
              {modeLabel}
            </span>
          </div>
        ) : (
          <span
            className="absolute right-[20px] rounded-full text-[10px] font-medium tracking-[0.03em]"
            id="mode-pill"
            style={{
              WebkitAppRegion: 'no-drag',
              padding: '7px 16px',
              minWidth: '80px',
              textAlign: 'center',
              background: isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)',
              border: isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)',
              color: isRefine ? 'rgba(200,160,255,1.0)' : 'rgba(100,180,255,0.85)',
            }}
            onClick={handleModePillClick}
          >
            {modeLabel}
          </span>
        )}
      </div>
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: '9px',
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.12)',
        fontWeight: 400,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 2
      }}>
        built using vibe-* skills
      </div>
    </div>
  )
}
