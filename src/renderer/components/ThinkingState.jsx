import MorphCanvas from './MorphCanvas.jsx'

const PAD = { paddingLeft: 32, paddingRight: 32 }

export default function ThinkingState({ transcript, mode }) {
  return (
    <div id="panel-thinking" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div className="h-20 flex items-center gap-[14px]" style={PAD}>
        <div className="bg-[var(--color-blue)]/[0.10] border border-[var(--color-blue)]/[0.20] rounded-full text-[10px] font-medium tracking-[0.04em] flex items-center gap-[6px] flex-shrink-0" style={{padding:'7px 16px', color:'rgba(100,180,255,0.8)'}}>
          <div className="w-[5px] h-[5px] rounded-full bg-[var(--color-blue)]/90 shadow-[0_0_6px_rgba(10,132,255,0.7)] animate-pulse" />
          Processing
        </div>
        {/* POLISH-003: status text — fontWeight 500, letterSpacing -0.01em, color 0.82 */}
        <div className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em' }}>
          {mode === 'image' ? 'Assembling prompt…' : 'Building your prompt'}
        </div>
      </div>
      <div className="pt-[10px] pb-6" style={PAD}>
        <MorphCanvas />
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{marginLeft:'auto', marginRight:'auto', width:'60%', marginTop:24, marginBottom:24}} />
      {/* POLISH-003: section label tracking 0.12em; POLISH-009: 0.14 → 0.45 */}
      <span
        className="block text-[9px] font-bold uppercase mb-3"
        style={{ ...PAD, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)' }}
      >
        You said
      </span>
      {/* POLISH-009: 0.26 → 0.58 */}
      <div
        className="pb-7 text-[13px] leading-[1.75] max-h-[120px] overflow-y-auto"
        style={{ ...PAD, color: 'rgba(255,255,255,0.58)', letterSpacing: '-0.01em' }}
        id="think-transcript"
      >
        {transcript}
      </div>
    </div>
  )
}
