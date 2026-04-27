import { useState, useRef, useEffect } from 'react'

const MODE_DESCRIPTIONS = {
  balanced: 'Balanced mode — output includes role, task, context, constraints and output format',
  code: 'Code mode — output includes role, task, language, architecture, constraints and output format',
  design: 'Design mode — output includes role, task, visual personality, layout, motion and what to avoid',
  refine: 'Refine mode — output includes current state, problem, desired outcome and constraints',
  polish: 'Polish mode — output returns polished prose with a summary of what changed',
  detailed: 'Detailed mode — output includes persona, examples, step breakdown and full context',
  concise: 'Concise mode — minimal, direct prompt with no extra structure',
  chain: 'Chain mode — output includes numbered reasoning steps for complex tasks',
}

export default function ExpandedTypingContent({ mode, onTypingSubmit, onSwitchToVoice }) {
  const [typingText, setTypingText] = useState('')
  const typingTextareaRef = useRef(null)

  useEffect(() => {
    setTimeout(() => typingTextareaRef.current?.focus(), 50)
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        padding: '16px 28px 14px',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
            <line x1="3" y1="6" x2="8" y2="6" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="3" y1="8.5" x2="11" y2="8.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Type your prompt</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            onClick={onSwitchToVoice}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', WebkitAppRegion: 'no-drag',
            }}
          >
            <svg width="11" height="13" viewBox="0 0 12 16" fill="none">
              <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1"/>
              <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)' }}>Switch to voice</span>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.18)' }}>⌘↵ to generate</span>
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <textarea
            ref={typingTextareaRef}
            value={typingText}
            onChange={e => setTypingText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey && typingText.trim()) {
                onTypingSubmit(typingText.trim())
              }
            }}
            placeholder="Describe what you want Claude to build, design, or write..."
            style={{
              width: '100%', height: '100%', minHeight: '320px',
              background: 'rgba(255,255,255,0.02)',
              border: '0.5px solid rgba(10,132,255,0.2)',
              borderRadius: '14px',
              padding: '20px 22px',
              fontSize: '15px',
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.75,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'none',
              WebkitAppRegion: 'no-drag',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute', bottom: '14px', right: '16px',
            fontSize: '11px', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace',
            pointerEvents: 'none',
          }}>
            {typingText.length} chars
          </span>
        </div>

        <div style={{
          padding: '12px 16px',
          background: 'rgba(10,132,255,0.04)',
          border: '0.5px solid rgba(10,132,255,0.1)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexShrink: 0,
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(10,132,255,0.7)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            {MODE_DESCRIPTIONS[mode] || `Output will be structured for ${mode} mode`}
          </span>
        </div>
      </div>

      <div style={{
        padding: '14px 24px 20px',
        borderTop: '0.5px solid rgba(255,255,255,0.05)',
        display: 'flex', gap: '10px', alignItems: 'center',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setTypingText('')}
          style={{
            height: '40px', padding: '0 20px',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            fontSize: '13px', color: 'rgba(255,255,255,0.38)',
            cursor: 'pointer', fontFamily: 'inherit',
            WebkitAppRegion: 'no-drag',
          }}
        >
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.18)' }}>or press ⌘↵</span>
        <button
          onClick={() => typingText.trim() && onTypingSubmit(typingText.trim())}
          disabled={!typingText.trim()}
          style={{
            height: '40px', padding: '0 32px',
            background: 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
            color: 'white', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            boxShadow: '0 2px 16px rgba(10,132,255,0.3)',
            cursor: typingText.trim() ? 'pointer' : 'default',
            opacity: typingText.trim() ? 1 : 0.4,
            WebkitAppRegion: 'no-drag',
            transition: 'opacity 200ms',
          }}
        >
          Generate prompt
        </button>
      </div>
    </div>
  )
}
