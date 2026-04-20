export default function ErrorState({ message, onDismiss }) {
  return (
    <div id="panel-error" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div
        className="h-[76px] flex items-center cursor-pointer [-webkit-app-region:drag]"
        id="error-area"
        style={{paddingLeft:32, paddingRight:32}}
        onClick={onDismiss}
      >
        <div className="w-9 h-9 rounded-full bg-[#FF3B30]/[0.10] border border-[#FF3B30]/[0.25] flex items-center justify-center flex-shrink-0 text-[14px] [-webkit-app-region:no-drag]">
          ⚠
        </div>
        <div className="flex-1 [-webkit-app-region:no-drag]" style={{marginLeft:16}}>
          {/* error message stays at 0.50 */}
          <div className="text-[13px] font-medium tracking-[0.01em] mb-[3px]" style={{color:'rgba(255,255,255,0.75)'}} id="error-message">
            {message || 'Something went wrong'}
          </div>
          {/* POLISH-009: 0.18 → 0.48 */}
          <div className="text-[11px] tracking-[0.01em]" style={{color:'rgba(255,255,255,0.48)'}}>Tap to retry</div>
        </div>
      </div>
    </div>
  )
}
