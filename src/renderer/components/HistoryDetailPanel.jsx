import { useState } from 'react'

const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
const ALL_TAGS = ['Perfect', 'Clear', 'Detailed', 'Too long']

function renderPromptSections(prompt) {
  if (!prompt) return null
  const lines = prompt.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const isLabel = /^[A-Z][A-Z\s\/]+:/.test(line)
    if (isLabel) {
      elements.push(
        <div key={`label-${i}`} style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'rgba(100,170,255,0.7)',
          marginBottom: '6px', marginTop: elements.length ? '18px' : 0,
          display: 'block',
        }}>
          {line.replace(':', '').trim()}
        </div>
      )
    } else {
      elements.push(
        <div key={`text-${i}`} style={{
          fontSize: '13.5px', color: 'rgba(255,255,255,0.88)',
          lineHeight: 1.75, marginBottom: '4px',
        }}>
          {line}
        </div>
      )
    }
    i++
  }
  return elements
}

export default function HistoryDetailPanel({ selected, onCopy, onReuse, onBookmark, onRate, onTag }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (!selected) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '13px',
        color: 'rgba(255,255,255,0.55)',
      }}>
        Select a prompt to view
      </div>
    )
  }

  return (
    <>
      <div style={{ padding: '20px 24px 16px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '8px',
        }}>
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.60)',
          }}>
            You said
          </div>
          <button onClick={onBookmark} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'inherit',
            background: selected.bookmarked ? 'rgba(255,189,46,0.10)' : 'rgba(255,255,255,0.04)',
            border: `0.5px solid ${selected.bookmarked ? 'rgba(255,189,46,0.25)' : 'rgba(255,255,255,0.08)'}`,
          }}>
            <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
              <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                fill={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'none'}
                stroke={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.3)'}
                strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontSize: '10px', fontWeight: selected.bookmarked ? 500 : 400,
              color: selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.35)',
            }}>
              {selected.bookmarked ? 'Saved' : 'Save'}
            </span>
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.65 }}>
          {selected.transcript}
        </div>
      </div>

      <div style={{
        height: '0.5px',
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',
        margin: '0 24px 16px', flexShrink: 0,
      }}/>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px', minHeight: 0 }}>
        {renderPromptSections(selected.prompt)}
        {selected.polishChanges && selected.polishChanges.length > 0 && (
          <div style={{ margin: '12px 0 20px', padding: '10px 12px', background: 'rgba(48,209,88,0.04)', border: '0.5px solid rgba(48,209,88,0.12)', borderRadius: '10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(48,209,88,0.5)', marginBottom: '6px' }}>Changes made</div>
            {selected.polishChanges.map((note, i) => (
              <div key={i} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{note}</div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '12px 22px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>Rate this prompt</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['up', 'down'].map(r => (
              <button key={r} onClick={() => onRate(r)} style={{
                width: '30px', height: '30px', borderRadius: '8px',
                fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
                fontFamily: 'inherit',
                background: selected.rating === r
                  ? (r === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,59,48,0.15)')
                  : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${selected.rating === r
                  ? (r === 'up' ? 'rgba(48,209,88,0.35)' : 'rgba(255,59,48,0.35)')
                  : 'rgba(255,255,255,0.1)'}`,
              }}>
                {r === 'up' ? '👍' : '👎'}
              </button>
            ))}
          </div>
        </div>
        {selected.rating && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ALL_TAGS.map(tag => {
              const isActive = selected.ratingTag === tag
              const isPositive = POSITIVE_TAGS.includes(tag)
              const activeStyle = isPositive
                ? { bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.3)', text: 'rgba(100,220,130,0.85)' }
                : { bg: 'rgba(255,59,48,0.10)', border: 'rgba(255,59,48,0.3)', text: 'rgba(255,100,90,0.85)' }
              const inactiveStyle = { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.35)' }
              const s = isActive ? activeStyle : inactiveStyle
              return (
                <span key={tag} onClick={() => onTag(tag)} style={{
                  padding: '3px 10px', borderRadius: '6px',
                  fontSize: '10px', fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer', transition: 'all 150ms',
                  background: s.bg, border: `0.5px solid ${s.border}`, color: s.text,
                }}>
                  {tag}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div style={{
        display: 'flex', gap: '10px',
        padding: '16px 24px 20px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        marginTop: '8px', flexShrink: 0,
      }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, height: '38px', borderRadius: '10px',
            fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
            background: copied ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
            border: copied ? '0.5px solid rgba(48,209,88,0.3)' : '0.5px solid rgba(255,255,255,0.12)',
            color: copied ? 'rgba(48,209,88,0.9)' : 'rgba(255,255,255,0.72)',
            transition: 'all 200ms',
          }}
        >
          {copied ? 'Copied ✓' : 'Copy prompt'}
        </button>
        <button
          onClick={onReuse}
          style={{
            flex: 1, height: '38px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer',
            background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))',
            border: 'none', color: 'white',
            boxShadow: '0 2px 14px rgba(10,132,255,0.35)',
          }}
        >
          Reuse
        </button>
      </div>
    </>
  )
}
