import { useState } from 'react'
import { FIELD_LABELS } from './ImageBuilderState.constants.js'

function flattenAnswers(answers) {
  if (!answers || typeof answers !== 'object') return []
  const result = []
  for (const [, fields] of Object.entries(answers)) {
    if (!fields || typeof fields !== 'object') continue
    for (const [field, value] of Object.entries(fields)) {
      if (field === 'negativePrompts') {
        if (Array.isArray(value) && value.length > 0) {
          result.push(['Avoid', value.join(', ')])
        }
        continue
      }
      if (value !== null && value !== '' && value !== undefined) {
        result.push([FIELD_LABELS[field] || field, String(value)])
      }
    }
  }
  return result
}

export default function ImageBuilderDoneState({
  prompt,
  answers,
  transcript,
  onEditAnswers,
  onStartOver,
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (window.electronAPI) window.electronAPI.copyToClipboard(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const parts = (prompt || '').split('\n\n')
  const promptText = parts[0] || ''
  const flags = parts.length > 1 ? parts.slice(1).join('\n\n') : ''
  const answeredEntries = flattenAnswers(answers)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', gap: '14px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(139,92,246,0.9)' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Image prompt ready</span>
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left column: prompt + flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Assembled prompt</p>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '12px', flex: 1, overflowY: 'auto', minHeight: 0,
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>{promptText}</p>
          </div>
          {flags && (
            <div style={{
              background: 'rgba(139,92,246,0.06)', border: '0.5px solid rgba(139,92,246,0.2)',
              borderRadius: '8px', padding: '9px 12px', flexShrink: 0,
            }}>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(139,92,246,0.5)', margin: '0 0 5px 0', fontWeight: 600 }}>Nano Banana flags</p>
              <code style={{ fontSize: '12px', color: 'rgba(196,168,255,0.8)', fontFamily: 'monospace', lineHeight: 1.5 }}>{flags}</code>
            </div>
          )}
          <div style={{ flexShrink: 0 }}>
            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', margin: '0 0 6px 0', fontWeight: 600 }}>Optimised for</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Nano Banana', 'ChatGPT image gen'].map((tool) => (
                <span key={tool} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 9px', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{tool}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: param summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0, overflowY: 'auto' }}>
          <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 600 }}>Parameters applied</p>
          {answeredEntries.length === 0 && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No parameters selected</p>
          )}
          {answeredEntries.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
              <span style={{ fontSize: '11px', color: 'rgba(196,168,255,0.6)', minWidth: '90px', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {onEditAnswers && (
          <button
            onClick={onEditAnswers}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '6px 13px', cursor: 'pointer' }}
          >← Edit answers</button>
        )}
        <button
          onClick={onStartOver}
          style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
        >Start over</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleCopy}
          style={{
            padding: '7px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 500,
            background: copied ? 'rgba(52,199,89,0.7)' : 'rgba(139,92,246,0.75)',
            border: 'none', color: 'white', cursor: 'pointer', transition: 'background 200ms ease',
          }}
        >{copied ? 'Copied ✓' : 'Copy prompt'}</button>
      </div>
    </div>
  )
}
