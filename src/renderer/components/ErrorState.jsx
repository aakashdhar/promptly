export default function ErrorState({ message, onDismiss }) {
  return (
    <div id="panel-error" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div
        className="h-[76px] flex items-center px-5 cursor-pointer [-webkit-app-region:drag]"
        id="error-area"
        onClick={onDismiss}
      >
        <div className="w-9 h-9 rounded-full bg-[#FF3B30]/[0.10] border border-[#FF3B30]/[0.25] flex items-center justify-center flex-shrink-0 text-[14px] [-webkit-app-region:no-drag]">
          ⚠
        </div>
        <div className="flex-1 ml-[14px] [-webkit-app-region:no-drag]">
          <div className="text-[13px] font-medium text-white/50 tracking-[0.01em] mb-[3px]" id="error-message">
            {message || 'Something went wrong'}
          </div>
          <div className="text-[11px] text-white/[0.18] tracking-[0.01em]">Tap to retry</div>
        </div>
      </div>
    </div>
  )
}
