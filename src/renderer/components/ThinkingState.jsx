import MorphCanvas from './MorphCanvas.jsx'
import { readableColor } from '../utils/promptUtils.js'

const PAD = { paddingLeft: 32, paddingRight: 32 }

// accentColor must be rgba(R,G,B,A) format with no spaces — alpha digit replaced for bg/border variants
export default function ThinkingState({ transcript, mode, label, accentColor, transcriptionSlow, generationSlow, streamText, context }) {
  const pillStyle = accentColor
    ? { padding: '7px 16px', background: `${accentColor.replace(/[\d.]+\)$/, '0.1)')}`, border: `1px solid ${accentColor.replace(/[\d.]+\)$/, '0.2)')}`, color: readableColor(accentColor) }
    : { padding: '7px 16px', color: 'color-mix(in oklab, rgba(100,180,255,0.8) var(--accent-text-strength), rgb(var(--ink)))' }
  const dotStyle = accentColor
    ? { background: accentColor, boxShadow: `0 0 6px ${accentColor}` }
    : {}
  return (
    <div id="panel-thinking" className="relative z-[1]">
      <div className="h-7 [-webkit-app-region:drag]" />
      <div className="h-20 flex items-center gap-[14px]" style={PAD}>
        <div className={accentColor ? 'rounded-full text-[10px] font-medium tracking-[0.04em] flex items-center gap-[6px] flex-shrink-0' : 'bg-[var(--color-blue)]/[0.10] border border-[var(--color-blue)]/[0.20] rounded-full text-[10px] font-medium tracking-[0.04em] flex items-center gap-[6px] flex-shrink-0'} style={pillStyle}>
          <div className={accentColor ? 'w-[5px] h-[5px] rounded-full animate-pulse' : 'w-[5px] h-[5px] rounded-full bg-[var(--color-blue)]/90 shadow-[0_0_6px_rgba(10,132,255,0.7)] animate-pulse'} style={dotStyle} />
          Processing
        </div>
        {/* POLISH-003: status text — fontWeight 500, letterSpacing -0.01em, color 0.82 */}
        <div className="text-[13px] font-medium" style={{ color: 'rgba(var(--ink),0.95)', letterSpacing: '-0.01em' }}>
          {label || (mode === 'image' ? 'Assembling prompt…' : 'Building your prompt')}
        </div>
      </div>
      {context && (context.destinationLabel || context.selectedText) && (
        <div style={{ ...PAD, marginTop: -8, marginBottom: 10, fontSize: 11.5, color: 'rgba(var(--ink),0.6)' }}>
          {[context.appName && `For ${context.appName}`, context.selectedText && `using your selection (${context.selectedText.length.toLocaleString()} characters)`].filter(Boolean).join(' · ')}
        </div>
      )}
      {streamText ? (
        // The prompt as Claude writes it (streamed through the CLI).
        <div
          className="selectable"
          style={{ ...PAD, paddingTop: 4, paddingBottom: 16, maxHeight: 150, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.6, color: 'rgba(var(--ink),0.82)' }}
          id="think-stream"
        >
          {streamText}
        </div>
      ) : (
        <div className="pt-[10px] pb-6" style={PAD}>
          <MorphCanvas />
        </div>
      )}
      <div className="h-px bg-gradient-to-r from-transparent via-[rgba(var(--ink),0.07)] to-transparent" style={{marginLeft:'auto', marginRight:'auto', width:'60%', marginTop:24, marginBottom:24}} />
      {transcriptionSlow && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: 'color-mix(in oklab, rgba(255,189,46,0.7) var(--accent-text-strength), rgb(var(--ink)))', padding: '0 32px', marginBottom: '12px', lineHeight: 1.5 }}>
          Taking longer than expected... Whisper may still be processing.
        </div>
      )}
      {generationSlow && (
        <div style={{ textAlign: 'center', fontSize: '11px', color: 'color-mix(in oklab, rgba(255,189,46,0.7) var(--accent-text-strength), rgb(var(--ink)))', padding: '0 32px', marginBottom: '12px', lineHeight: 1.5 }}>
          Claude is taking longer than usual...
        </div>
      )}
      {/* POLISH-003: section label tracking 0.12em; POLISH-009: 0.14 → 0.45 */}
      <span
        className="block text-[9px] font-bold uppercase mb-3"
        style={{ ...PAD, letterSpacing: '0.12em', color: 'rgba(var(--ink),0.62)' }}
      >
        You said
      </span>
      {/* POLISH-009: 0.26 → 0.58 */}
      <div
        className="pb-7 text-[13px] leading-[1.75] max-h-[120px] overflow-y-auto"
        style={{ ...PAD, color: 'rgba(var(--ink),0.78)', letterSpacing: '-0.01em' }}
        id="think-transcript"
      >
        {transcript}
      </div>
    </div>
  )
}
