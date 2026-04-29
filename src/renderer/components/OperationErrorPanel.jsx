import { useState } from 'react'

const ICONS = {
  error: { color: 'rgba(255,59,48,', svg: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={`${c}0.8)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  lock: { color: 'rgba(255,189,46,', svg: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="11" rx="2" stroke={`${c}0.8)`} strokeWidth="1.5"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={`${c}0.8)`} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )},
  clock: { color: 'rgba(255,189,46,', svg: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={`${c}0.8)`} strokeWidth="1.5"/>
      <path d="M12 7v5l3 3" stroke={`${c}0.8)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  warning: { color: 'rgba(255,189,46,', svg: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={`${c}0.8)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
}

export default function OperationErrorPanel({
  icon = 'error',
  title,
  body,
  errorDetails,
  slowWarning,
  fixLabel,
  fixCode,
  fixNote,
  fixPreNote,
  onRetry,
  retryLabel = 'Try again ↺',
  onOpenSettings,
}) {
  const [copied, setCopied] = useState(false)

  const { color, svg } = ICONS[icon] || ICONS.error
  const iconBg = `${color}0.08)`
  const iconBorder = `${color}0.2)`

  function handleCopy() {
    if (!fixCode) return
    if (window.electronAPI) window.electronAPI.copyToClipboard(fixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 36px', gap: '14px', minHeight: 0 }}>
      {/* Icon */}
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {svg(color)}
      </div>

      {/* Title + body */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '16px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '6px' }}>{title}</div>
        {body && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>{body}</div>}
      </div>

      {/* Slow warning */}
      {slowWarning && (
        <div style={{ fontSize: '11px', color: 'rgba(255,189,46,0.7)', textAlign: 'center' }}>{slowWarning}</div>
      )}

      {/* Error details */}
      {errorDetails && (
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '9px', padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '6px' }}>Error details</div>
          <div style={{ fontFamily: 'monospace', fontSize: '10.5px', color: 'rgba(255,100,90,0.55)', maxHeight: '80px', overflowY: 'auto', lineHeight: 1.5 }}>{errorDetails}</div>
        </div>
      )}

      {/* Fix box */}
      {fixCode ? (
        <div style={{ width: '100%', background: 'rgba(255,189,46,0.04)', border: '0.5px solid rgba(255,189,46,0.12)', borderRadius: '9px', padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,189,46,0.55)', marginBottom: '8px' }}>Fix</div>
          {fixPreNote && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>{fixPreNote}</div>}
          {fixLabel && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>{fixLabel}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,189,46,0.75)', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fixCode}</code>
            <button
              onClick={handleCopy}
              style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '10px', fontFamily: 'inherit', cursor: 'pointer', background: copied ? 'rgba(48,209,88,0.1)' : 'rgba(255,255,255,0.05)', border: `0.5px solid ${copied ? 'rgba(48,209,88,0.25)' : 'rgba(255,255,255,0.1)'}`, color: copied ? 'rgba(48,209,88,0.8)' : 'rgba(255,255,255,0.4)', transition: 'all 150ms', flexShrink: 0 }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {fixNote && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '4px' }}>{fixNote}</div>}
        </div>
      ) : onOpenSettings ? (
        <div style={{ width: '100%', background: 'rgba(255,189,46,0.04)', border: '0.5px solid rgba(255,189,46,0.12)', borderRadius: '9px', padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,189,46,0.55)', marginBottom: '6px' }}>Fix</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Open settings to verify your Whisper and ffmpeg paths.</div>
        </div>
      ) : null}

      {/* Action row */}
      <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '4px' }}>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            style={{ flex: 1, height: '38px', borderRadius: '9px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', transition: 'background 150ms' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Open settings
          </button>
        )}
        <button
          onClick={onRetry}
          style={{ flex: 2, height: '38px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: 'linear-gradient(135deg,rgba(168,85,247,0.85),rgba(124,58,237,0.85))', border: 'none', color: 'white', boxShadow: '0 2px 14px rgba(139,92,246,0.3)', transition: 'opacity 150ms' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {retryLabel}
        </button>
      </div>
    </div>
  )
}
