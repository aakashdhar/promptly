export default function IdleState({ mode, modeLabel, onStart }) {
  function handleModePillClick(e) {
    e.stopPropagation()
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }

  return (
    <div id="panel-idle" className="relative z-[1]">
      <div
        className="h-[76px] flex items-center px-5 [-webkit-app-region:drag]"
        id="idle-area"
        onClick={onStart}
      >
        <div className="w-10 h-10 rounded-full bg-[#0A84FF]/[0.15] border border-[#0A84FF]/[0.4] flex items-center justify-center flex-shrink-0 relative shadow-[0_0_12px_rgba(10,132,255,0.3),0_0_24px_rgba(10,132,255,0.12)] [-webkit-app-region:no-drag]">
          <div className="absolute w-10 h-10 rounded-full border-[1.5px] border-[#0A84FF]/[0.35] [animation:pulse-expand_1.8s_ease-out_infinite] pointer-events-none" />
          <div className="absolute w-10 h-10 rounded-full border border-[#0A84FF]/[0.18] [animation:pulse-expand_1.8s_ease-out_infinite_0.6s] pointer-events-none" />
          <svg width="13" height="15" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,180,255,1)" strokeWidth="1" />
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
            <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 ml-[14px] [-webkit-app-region:no-drag]">
          <div className="text-[13px] font-medium text-white/50 tracking-[0.01em] mb-[3px]">Promptly is ready</div>
          <div className="text-[11px] text-white/[0.18] tracking-[0.01em]">Press ⌥ Space or click to speak your prompt</div>
        </div>
        <span
          className="bg-[#0A84FF]/[0.12] border border-[#0A84FF]/[0.25] rounded-full px-[11px] py-[3px] text-[10px] font-medium text-[rgba(100,180,255,0.85)] tracking-[0.03em] flex-shrink-0 [-webkit-app-region:no-drag]"
          id="mode-pill"
          onClick={handleModePillClick}
        >
          {modeLabel}
        </span>
      </div>
    </div>
  )
}
