import { useState, useEffect } from 'react'
import WaveformCanvas from './WaveformCanvas.jsx'

export default function RecordingState({ onStop, onDismiss }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    setSecs(0)
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  const dur = `${m}:${String(s).padStart(2, '0')}`

  return (
    <div id="panel-recording" className="relative z-[1]">
      <div className="h-[13px] [-webkit-app-region:drag]" />
      <div className="h-[68px] flex items-center px-4 gap-3 [-webkit-app-region:drag]">
        <div
          className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] hover:bg-white/[0.12] transition-colors duration-150"
          id="dismissBtn"
          onClick={onDismiss}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 flex items-center h-9 [-webkit-app-region:no-drag]">
          <WaveformCanvas />
        </div>
        <span
          className="text-[11px] font-medium text-white/30 tracking-[0.06em] flex-shrink-0 min-w-[28px] text-right tabular-nums [-webkit-app-region:no-drag]"
          id="recDur"
        >
          {dur}
        </span>
        <div
          className="w-8 h-8 rounded-full bg-[#FF3B30] border-none flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] [animation:stop-glow_2s_ease-in-out_infinite]"
          id="stopBtn"
          onClick={onStop}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
      </div>
      <div className="h-px mx-[18px] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  )
}
