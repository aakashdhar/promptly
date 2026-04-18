export default function IdleState({ mode, modeLabel, onStart }) {
  function handleModePillClick(e) {
    e.stopPropagation()
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  return (
    <div id="panel-idle">
      <div className="traf" />
      <div className="cr-idle" id="idle-area" onClick={onStart}>
        <div className="pulse-ring">
          <svg width="13" height="15" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,180,255,1)" strokeWidth="1" />
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
            <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="ready-text">
          <div className="ready-title">Promptly is ready</div>
          <div className="ready-sub">Press ⌥ Space or click to speak your prompt</div>
        </div>
        <span className="mode-pill" id="mode-pill" onClick={handleModePillClick}>
          {modeLabel}
        </span>
      </div>
    </div>
  )
}
