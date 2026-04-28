import { useState } from 'react'

const ORANGE_CHIP = {
  background: 'rgba(251,146,60,0.08)',
  border: '1px solid rgba(251,146,60,0.15)',
  color: 'rgba(251,146,60,0.65)',
}

function formatParamValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function paramLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim()
}

function getAnsweredEntries(videoAnswers) {
  if (!videoAnswers) return []
  return Object.entries(videoAnswers).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'boolean') return v
    return !!v
  })
}

export default function VideoBuilderDoneState({
  prompt,
  videoAnswers,
  transcript,
  onCopy,
  onEdit,
  onStartOver,
  isSaved,
  onSave,
}) {
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  function handleCopy() {
    if (onCopy) onCopy()
    else if (window.electronAPI) window.electronAPI.copyToClipboard({ text: prompt })
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleSave() {
    if (isSaved || savedFlash) return
    if (onSave) onSave()
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  const answeredEntries = getAnsweredEntries(videoAnswers)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', gap: '14px', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(52,199,89,0.9)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Video prompt ready</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onEdit}
            style={{ fontSize: '11.5px', color: 'rgba(251,146,60,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >← Edit</button>
          <button
            onClick={onStartOver}
            style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
          >Start over</button>
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>

        {/* Left column: prompt + optimised for */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Assembled prompt</p>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '9px', padding: '10px 12px', flex: 1, overflowY: 'auto',
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0 }}>{prompt}</p>
          </div>

          <div>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px 0', fontWeight: 600 }}>Optimised for</p>
            <span style={{ ...ORANGE_CHIP, display: 'inline-block', padding: '3px 9px', borderRadius: '6px', fontSize: '11px' }}>
              veo-3.1-generate-preview
            </span>
          </div>
        </div>

        {/* Right column: param breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Parameters applied</p>
          {answeredEntries.length === 0 && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No parameters selected</p>
          )}
          {answeredEntries.map(([key, value]) => (
            <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '11px', color: 'rgba(251,146,60,0.6)', minWidth: '90px', textTransform: 'capitalize', flexShrink: 0 }}>{paramLabel(key)}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{formatParamValue(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleSave}
          style={{
            fontSize: '12px', cursor: isSaved || savedFlash ? 'default' : 'pointer',
            background: isSaved || savedFlash ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isSaved || savedFlash ? 'rgba(52,199,89,0.25)' : 'rgba(255,255,255,0.1)'}`,
            color: isSaved || savedFlash ? 'rgba(52,199,89,0.75)' : 'rgba(255,255,255,0.4)',
            borderRadius: '7px', padding: '6px 13px', transition: 'all 200ms ease',
            fontFamily: 'inherit',
          }}
        >{isSaved || savedFlash ? 'Saved ✓' : 'Save'}</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleCopy}
          style={{
            padding: '7px 20px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
            background: copied
              ? 'rgba(52,199,89,0.7)'
              : 'linear-gradient(135deg, rgba(251,146,60,0.85) 0%, rgba(234,88,12,0.8) 100%)',
            border: 'none', color: 'white', cursor: 'pointer',
            transition: 'background 200ms ease', fontFamily: 'inherit',
          }}
        >{copied ? 'Copied ✓' : 'Copy prompt'}</button>
      </div>
    </div>
  )
}
