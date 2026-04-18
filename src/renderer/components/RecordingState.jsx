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
    <div id="panel-recording">
      <div style={{ height: '13px', WebkitAppRegion: 'drag' }} />
      <div className="cr-rec">
        <div className="dismiss-btn" id="dismissBtn" onClick={onDismiss}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="wave-wrap">
          <WaveformCanvas />
        </div>
        <span className="rec-dur" id="recDur">{dur}</span>
        <div className="stop-btn" id="stopBtn" onClick={onStop}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
          </svg>
        </div>
      </div>
      <div className="rec-div-line" />
    </div>
  )
}
