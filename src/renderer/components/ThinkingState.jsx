import MorphCanvas from './MorphCanvas.jsx'

const PAD = { paddingLeft: 32, paddingRight: 32 }

export default function ThinkingState({ transcript }) {
  return (
    <div id="panel-thinking" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div className="h-20 flex items-center gap-[14px]" style={PAD}>
        <div className="bg-[#0A84FF]/[0.10] border border-[#0A84FF]/[0.20] rounded-full text-[10px] font-medium text-[rgba(100,180,255,0.8)] tracking-[0.04em] flex items-center gap-[6px] flex-shrink-0" style={{padding:'7px 16px'}}>
          <div className="w-[5px] h-[5px] rounded-full bg-[#0A84FF]/90 shadow-[0_0_6px_rgba(10,132,255,0.7)] animate-pulse" />
          Processing
        </div>
        <div className="text-[13px] text-white/[0.45] font-medium tracking-[0.01em]">Building your prompt</div>
      </div>
      <div className="pt-[10px] pb-6" style={PAD}>
        <MorphCanvas />
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{marginLeft:'auto', marginRight:'auto', width:'60%', marginTop:24, marginBottom:24}} />
      <span className="block text-[9px] font-bold tracking-[0.14em] uppercase text-white/[0.14] mb-3" style={PAD}>You said</span>
      <div
        className="pb-7 text-[13px] text-white/[0.26] leading-[1.75] tracking-[0.01em] max-h-[120px] overflow-y-auto scrollbar-thin"
        id="think-transcript"
        style={PAD}
      >
        {transcript}
      </div>
    </div>
  )
}
