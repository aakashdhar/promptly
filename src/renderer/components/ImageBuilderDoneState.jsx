import { useState } from 'react'

const MODEL_IDS = {
  'Nano Banana': 'Nano Banana (gemini-2.5-flash-image)',
  'Nano Banana 2': 'Nano Banana 2 (gemini-3.1-flash-image-preview)',
  'Nano Banana Pro': 'Nano Banana Pro (gemini-3-pro-image-preview)',
}

function getOptimisedForChips(model) {
  const chips = []
  if (model && MODEL_IDS[model]) chips.push(MODEL_IDS[model])
  chips.push('ChatGPT image gen')
  return chips
}

export default function ImageBuilderDoneState({
  prompt,
  answers,
  transcript,
  onEditAnswers,
  onStartOver,
  isExpanded,
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (window.electronAPI) window.electronAPI.copyToClipboard(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const answeredEntries = Object.entries(answers).filter(([, v]) => v)
  const paramLabel = (key) => key.replace(/_/g, ' ')

  if (isExpanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', gap: '14px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(52,199,89,0.9)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Image prompt ready</span>
        </div>

        {/* Two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Assembled prompt</p>
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px', padding: '12px', flex: 1, overflowY: 'auto',
            }}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>{prompt}</p>
            </div>
            <div>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px 0', fontWeight: 600 }}>Optimised for</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {getOptimisedForChips(answers.model).map((tool) => (
                  <span key={tool} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{tool}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto' }}>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Parameters applied</p>
            {answeredEntries.length === 0 && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No parameters selected</p>
            )}
            {answeredEntries.map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '11px', color: 'rgba(252,211,77,0.7)', minWidth: '90px', textTransform: 'capitalize', flexShrink: 0 }}>{paramLabel(key)}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onEditAnswers}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}
          >Edit answers</button>
          <button
            onClick={onStartOver}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
          >Start over</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500,
              background: copied ? 'rgba(52,199,89,0.7)' : 'rgba(245,158,11,0.75)',
              border: 'none', color: 'white', cursor: 'pointer', transition: 'background 200ms ease',
            }}
          >{copied ? 'Copied ✓' : 'Copy prompt'}</button>
        </div>
      </div>
    )
  }

  // Compact bar layout
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '11px 14px', gap: '9px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(52,199,89,0.9)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>Image prompt ready</span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

      {/* Prompt box */}
      <div>
        <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)', fontWeight: 600, margin: '0 0 6px 0' }}>Assembled prompt</p>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '9px', padding: '10px 12px',
        }}>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, margin: 0 }}>{prompt}</p>
        </div>
      </div>

      {/* Param summary */}
      {answeredEntries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {answeredEntries.map(([key, value]) => (
            <span key={key} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '6px', padding: '2px 7px', fontSize: '10.5px',
            }}>
              <span style={{ fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(252,211,77,0.6)', fontWeight: 600 }}>{paramLabel(key)}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onEditAnswers}
          style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 11px', cursor: 'pointer' }}
        >Edit answers</button>
        <button
          onClick={onStartOver}
          style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 6px' }}
        >Start over</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleCopy}
          style={{
            padding: '6px 15px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
            background: copied ? 'rgba(52,199,89,0.7)' : 'rgba(245,158,11,0.75)',
            border: 'none', color: 'white', cursor: 'pointer', transition: 'background 200ms ease',
          }}
        >{copied ? 'Copied ✓' : 'Copy prompt'}</button>
      </div>
    </div>
  )
}
