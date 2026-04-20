export default function IdleState({ mode, modeLabel, onStart }) {
  const isRefine = mode === 'refine'

  function handleModePillClick(e) {
    e.stopPropagation()
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  const ringColor = isRefine ? 'rgba(168,85,247,' : 'rgba(10,132,255,'
  const micStroke = isRefine ? 'rgba(200,160,255,0.8)' : 'rgba(100,180,255,1)'
  const micStrokeFaded = isRefine ? 'rgba(200,160,255,0.8)' : 'rgba(100,180,255,0.85)'

  return (
    <div id="panel-idle" className="relative z-[1]" style={{height:'118px'}}>
      <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
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
            boxShadow: isRefine
              ? '0 0 12px rgba(168,85,247,0.2)'
              : '0 0 12px rgba(10,132,255,0.3), 0 0 24px rgba(10,132,255,0.12)',
          }}
        >
          <div
            className="absolute w-10 h-10 rounded-full [animation:pulse-expand_1.8s_ease-out_infinite] pointer-events-none"
            style={{ border: `1.5px solid ${ringColor}0.35)` }}
          />
          <div
            className="absolute w-10 h-10 rounded-full [animation:pulse-expand_1.8s_ease-out_infinite_0.6s] pointer-events-none"
            style={{ border: `1px solid ${ringColor}0.18)` }}
          />
          <svg width="13" height="15" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke={micStroke} strokeWidth="1" />
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
            <line x1="6" y1="13.5" x2="6" y2="15.5" stroke={micStrokeFaded} strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>

        {/* Text — true screen-centre */}
        <div className="text-center" style={{WebkitAppRegion:'no-drag'}}>
          <div className="text-[13px] font-medium tracking-[0.01em] mb-[3px]" style={{color:'rgba(255,255,255,0.5)'}}>Promptly is ready</div>
          <div className="text-[11px] tracking-[0.01em]" style={{color:'rgba(255,255,255,0.18)'}}>
            {isRefine ? "Describe what exists, what's wrong, and what you want" : 'Press ⌥ Space or click to speak your prompt'}
          </div>
          <span className="text-[9px] mt-[4px] block" style={{color:'rgba(255,255,255,0.1)'}}>⌘? for shortcuts</span>
        </div>

        {/* Mode pill — anchored right */}
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
            color: isRefine ? 'rgba(200,160,255,0.9)' : 'rgba(100,180,255,0.85)',
          }}
          onClick={handleModePillClick}
        >
          {modeLabel}
        </span>
      </div>
    </div>
  )
}
