const PAD = { paddingLeft: 32, paddingRight: 32 }

export default function PausedState({ duration, onResume, onStop, onDismiss }) {
  return (
    <div id="panel-paused" className="relative z-[1]">
      <div className="h-[13px] [-webkit-app-region:drag]" />
      <div className="h-[68px] flex items-center gap-3 [-webkit-app-region:drag]" style={PAD}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] hover:bg-white/[0.12] transition-colors duration-150"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)' }}
          onClick={onDismiss}
        >
          {/* POLISH-009: stroke 0.45 → 0.75 */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 flex items-center h-9 [-webkit-app-region:no-drag]">
          <div style={{
            width: '100%', height: '1.5px',
            background: 'linear-gradient(90deg, transparent, rgba(255,189,46,0.45) 20%, rgba(255,189,46,0.45) 80%, transparent)',
            borderRadius: '2px',
          }} />
        </div>
        {/* POLISH-003: timer fontWeight 400, letterSpacing 0.08em */}
        <span
          className="text-[11px] flex-shrink-0 min-w-[28px] text-right tabular-nums [-webkit-app-region:no-drag]"
          style={{ color: 'rgba(255,189,46,0.7)', fontWeight: 400, letterSpacing: '0.08em' }}
        >
          {duration}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag]"
          style={{
            background: 'rgba(255,189,46,0.15)',
            border: '1px solid rgba(255,189,46,0.4)',
            animation: 'pauseGlow 2s ease-in-out infinite',
          }}
          onClick={onResume}
        >
          <svg width="10" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 1L10 6L2 11V1Z" fill="rgba(255,189,46,0.9)" />
          </svg>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] [animation:stop-glow_2s_ease-in-out_infinite]"
          style={{ background: '#FF3B30' }}
          onClick={onStop}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{ marginLeft: 32, marginRight: 32 }} />
      <div style={{ padding: '10px 18px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFBD2E', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'rgba(255,189,46,0.75)', letterSpacing: '.02em' }}>
          Paused — tap resume to continue
        </span>
      </div>
    </div>
  )
}
