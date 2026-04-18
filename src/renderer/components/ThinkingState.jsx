import MorphCanvas from './MorphCanvas.jsx'

export default function ThinkingState({ transcript }) {
  return (
    <div id="panel-thinking" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div className="h-20 flex items-center px-[22px] gap-[14px]">
        <div className="bg-[#0A84FF]/[0.10] border border-[#0A84FF]/[0.20] rounded-full px-3 py-1 text-[10px] font-medium text-[rgba(100,180,255,0.8)] tracking-[0.04em] flex items-center gap-[6px] flex-shrink-0">
          <div className="w-[5px] h-[5px] rounded-full bg-[#0A84FF]/90 shadow-[0_0_6px_rgba(10,132,255,0.7)] animate-pulse" />
          Processing
        </div>
        <div className="text-[13px] text-white/[0.45] font-medium tracking-[0.01em]">Building your prompt</div>
      </div>
      <div className="px-[22px] pt-[10px] pb-6">
        <MorphCanvas />
      </div>
      <div className="h-px mx-[18px] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <span className="block text-[9px] font-bold tracking-[0.14em] uppercase text-white/[0.14] px-[22px] mb-3 mt-3">You said</span>
      <div
        className="px-[22px] pb-7 text-[13px] text-white/[0.26] leading-[1.75] tracking-[0.01em] max-h-[120px] overflow-y-auto scrollbar-thin"
        id="think-transcript"
      >
        {transcript}
      </div>
    </div>
  )
}
