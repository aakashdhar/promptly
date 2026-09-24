import { useState, useRef } from 'react'
import ModeDropdown from './ModeDropdown.jsx'

const IDLE_HEIGHT = 134

export default function IdleState({ mode, modeLabel, onStart, onTypePrompt, polishTone, onPolishToneChange, onExpand, onModeSelect, onShowShortcuts, onShowHistory }) {
  const isRefine = mode === 'refine'
  const isPolish = mode === 'polish'
  const isImage = mode === 'image'
  const isVideo = mode === 'video'
  const isWorkflow = mode === 'workflow'
  const isEmail = mode === 'email'

  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const pillRef = useRef(null)

  function handleModePillClick(e) {
    e.stopPropagation()
    if (showModeDropdown) {
      setShowModeDropdown(false)
      window.electronAPI?.resizeWindow(IDLE_HEIGHT)
      return
    }
    const rect = pillRef.current?.getBoundingClientRect()
    // Below the whole status block, so the menu never covers the hint lines.
    const top = Math.max(rect ? rect.bottom + 6 : 0, 108)
    const right = rect ? window.innerWidth - rect.right : 20
    setDropdownPos({ top, right })
    setShowModeDropdown(true)
  }

  function handleDropdownClose() {
    setShowModeDropdown(false)
    window.electronAPI?.resizeWindow(IDLE_HEIGHT)
  }

  const ringColor = isPolish ? 'rgba(48,209,88,' : isRefine ? 'rgba(168,85,247,' : isImage ? 'rgba(245,158,11,' : isVideo ? 'rgba(251,146,60,' : isWorkflow ? 'rgba(34,197,94,' : isEmail ? 'rgba(20,184,166,' : 'rgba(10,132,255,'
  const micStroke = isRefine ? 'rgba(200,160,255,0.8)' : isImage ? 'rgba(252,211,77,0.8)' : isVideo ? 'rgba(251,146,60,0.8)' : isWorkflow ? 'rgba(74,222,128,0.8)' : isEmail ? 'rgba(45,212,191,0.8)' : 'rgba(100,180,255,1)'
  const micStrokeFaded = isRefine ? 'rgba(200,160,255,0.8)' : isImage ? 'rgba(252,211,77,0.8)' : isVideo ? 'rgba(251,146,60,0.8)' : isWorkflow ? 'rgba(74,222,128,0.8)' : isEmail ? 'rgba(45,212,191,0.8)' : 'rgba(100,180,255,0.85)'

  return (
    <div id="panel-idle" className="relative z-[1]" style={{height:`${IDLE_HEIGHT}px`}}>
      <div style={{ height: '28px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', WebkitAppRegion: 'drag' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onExpand() }}
          title="Expand"
          style={{
            width: '22px', height: '22px', borderRadius: '6px',
            background: 'rgba(var(--ink),0.04)',
            border: '0.5px solid rgba(var(--ink),0.09)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', marginRight: '14px',
            WebkitAppRegion: 'no-drag', flexShrink: 0,
            padding: 0, transition: 'background 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(var(--ink),0.1)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(var(--ink),0.04)'}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M1 4V1h3" stroke="rgba(var(--ink),0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 1l4 4" stroke="rgba(var(--ink),0.38)" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M11 8v3H8" stroke="rgba(var(--ink),0.38)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 11L7 7" stroke="rgba(var(--ink),0.38)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div
        className="flex items-center h-[96px]"
        id="idle-area"
        style={{WebkitAppRegion:'drag', padding:'0 20px 0 24px', gap:'14px'}}
        onClick={onStart}
      >
        {/* Mic pulse ring — anchored left */}
        <div
          className="relative w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            WebkitAppRegion: 'no-drag',
            background: `${ringColor}0.12)`,
            border: `1px solid ${ringColor}0.35)`,
            boxShadow: isPolish
              ? '0 0 12px rgba(48,209,88,0.2)'
              : isRefine
                ? '0 0 12px rgba(168,85,247,0.2)'
                : isImage
                  ? '0 0 12px rgba(245,158,11,0.2)'
                  : isVideo
                    ? '0 0 12px rgba(251,146,60,0.2)'
                    : isEmail
                      ? '0 0 12px rgba(20,184,166,0.2)'
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

        <div style={{flex:1, minWidth:0, WebkitAppRegion:'no-drag'}}>
          <div
            className="text-[13px] font-medium mb-[3px]"
            style={{ color:'rgba(var(--ink),0.95)', letterSpacing:'-0.01em' }}
          >
            Promptly is ready
          </div>
          <div
            className="text-[11px]"
            style={{ color:'var(--text-secondary)', letterSpacing:'-0.01em' }}
          >
            {isPolish ? 'Speak it rough, get it polished' : isRefine ? "Describe what's there and what should change" : isImage ? 'Speak your image idea' : isVideo ? 'Speak your video idea' : isWorkflow ? 'Describe your automation' : isEmail ? 'Describe the email you need' : mode === 'do' ? 'Select text or look at something, then say what you want' : '⌥ Space to speak · ⌘T to type'}
          </div>
          <span className="text-[11px] mt-[3px] block" style={{color:'var(--text-tertiary)'}}>⌘? for shortcuts</span>
        </div>

        {/* Keyboard icon — type prompt */}
        <div
          onClick={(e) => { e.stopPropagation(); onTypePrompt(); }}
          title="Type prompt (⌘T)"
          style={{
            width:'32px', height:'32px', borderRadius:'9px',
            background:'rgba(var(--ink),0.05)',
            border:'0.5px solid rgba(var(--ink),0.1)',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0,
            WebkitAppRegion:'no-drag',
            transition:'background 150ms'
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(var(--ink),0.1)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(var(--ink),0.05)'}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <rect x="1" y="1" width="12" height="8" rx="2" stroke="rgba(var(--ink),0.45)" strokeWidth="1.2"/>
            <line x1="3.5" y1="4" x2="10.5" y2="4" stroke="rgba(var(--ink),0.45)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="3.5" y1="6.5" x2="7.5" y2="6.5" stroke="rgba(var(--ink),0.45)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Mode pill / tone toggle — anchored right */}
        {isPolish ? (
          <div style={{
            display:'flex', flexDirection:'row', alignItems:'center', gap:'6px',
            flexShrink:0, WebkitAppRegion:'no-drag'
          }}>
            {/* Tone pill — opens native menu like mode selector */}
            <span
              onClick={(e) => { e.stopPropagation(); if (window.electronAPI) window.electronAPI.showToneMenu(polishTone) }}
              style={{
                padding:'4px 12px', borderRadius:'20px', fontSize:'11px',
                fontWeight:500, cursor:'pointer', textAlign:'center',
                background:'rgba(48,209,88,0.08)',
                border:'0.5px solid rgba(48,209,88,0.2)',
                color:'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))', whiteSpace:'nowrap'
              }}
            >
              {polishTone === 'formal' ? 'Formal' : 'Casual'}
            </span>
            {/* Mode pill */}
            <span
              ref={pillRef}
              id="mode-pill"
              style={{
                padding:'4px 12px', borderRadius:'20px', fontSize:'11px',
                fontWeight:500, cursor:'pointer', textAlign:'center',
                background:'rgba(48,209,88,0.12)',
                border:'0.5px solid rgba(48,209,88,0.3)',
                color:'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))', whiteSpace:'nowrap'
              }}
              onClick={handleModePillClick}
            >
              {modeLabel}
            </span>
          </div>
        ) : (
          <span
            ref={pillRef}
            className="rounded-full text-[11px] font-medium tracking-[0.03em] flex-shrink-0"
            id="mode-pill"
            style={{
              WebkitAppRegion: 'no-drag',
              padding: '7px 16px',
              cursor: 'pointer',
              minWidth: '80px',
              textAlign: 'center',
              background: isRefine ? 'rgba(139,92,246,0.12)' : isImage ? 'rgba(245,158,11,0.12)' : isVideo ? 'rgba(251,146,60,0.12)' : isWorkflow ? 'rgba(34,197,94,0.12)' : isEmail ? 'rgba(20,184,166,0.12)' : 'rgba(10,132,255,0.12)',
              border: isRefine ? '0.5px solid rgba(139,92,246,0.3)' : isImage ? '0.5px solid rgba(245,158,11,0.3)' : isVideo ? '0.5px solid rgba(251,146,60,0.3)' : isWorkflow ? '0.5px solid rgba(34,197,94,0.3)' : isEmail ? '0.5px solid rgba(20,184,166,0.3)' : '0.5px solid rgba(10,132,255,0.25)',
              color: isRefine ? 'color-mix(in oklab, rgb(200,160,255) var(--accent-text-strength), rgb(var(--ink)))' : isImage ? 'color-mix(in oklab, rgb(252,211,77) var(--accent-text-strength), rgb(var(--ink)))' : isVideo ? 'color-mix(in oklab, rgb(251,146,60) var(--accent-text-strength), rgb(var(--ink)))' : isWorkflow ? 'color-mix(in oklab, rgb(74,222,128) var(--accent-text-strength), rgb(var(--ink)))' : isEmail ? 'color-mix(in oklab, rgb(45,212,191) var(--accent-text-strength), rgb(var(--ink)))' : 'color-mix(in oklab, rgb(100,180,255) var(--accent-text-strength), rgb(var(--ink)))',
            }}
            onClick={handleModePillClick}
          >
            {modeLabel}
          </span>
        )}
      </div>

      {showModeDropdown && (
        <ModeDropdown
          mode={mode}
          top={dropdownPos.top}
          right={dropdownPos.right}
          onSelect={onModeSelect}
          onShowShortcuts={onShowShortcuts}
          onShowHistory={onShowHistory}
          onClose={handleDropdownClose}
          anchorRef={pillRef}
          fitWindow
        />
      )}
    </div>
  )
}
