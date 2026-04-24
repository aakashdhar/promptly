import WaveformCanvas from './WaveformCanvas.jsx'

const PAD = { paddingLeft: 32, paddingRight: 32 }

export default function RecordingState({ onStop, onDismiss, onPause, duration }) {
  return (
    <div id="panel-recording" className="relative z-[1]">
      <div className="h-[13px] [-webkit-app-region:drag]" />
      <div
        className="h-[68px] flex items-center gap-3 [-webkit-app-region:drag]"
        style={PAD}
      >
        <div
          className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] hover:bg-white/[0.12] transition-colors duration-150"
          id="dismissBtn"
          onClick={onDismiss}
        >
          {/* POLISH-009: stroke 0.45 → 0.75 */}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 flex items-center h-9 [-webkit-app-region:no-drag]">
          <WaveformCanvas />
        </div>
        {/* POLISH-003: timer fontWeight 400, letterSpacing 0.08em; POLISH-009: 0.30 → 0.60 */}
        <span
          className="text-[11px] flex-shrink-0 min-w-[28px] text-right tabular-nums [-webkit-app-region:no-drag]"
          style={{ color: 'rgba(255,255,255,0.60)', fontWeight: 400, letterSpacing: '0.08em' }}
          id="recDur"
        >
          {duration}
        </span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag]"
          style={{
            background: 'rgba(255,189,46,0.12)',
            border: '0.5px solid rgba(255,189,46,0.3)',
            animation: 'pauseGlow 2s ease-in-out infinite',
          }}
          onClick={onPause}
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
            <rect x="1" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)" />
            <rect x="6" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)" />
          </svg>
        </div>
        <div
          className="w-8 h-8 rounded-full bg-[var(--color-red)] border-none flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] [animation:stop-glow_2s_ease-in-out_infinite]"
          id="stopBtn"
          onClick={onStop}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{marginLeft:32, marginRight:32}} />
    </div>
  )
}
