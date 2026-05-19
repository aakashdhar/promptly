import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const MODES = [
  { key: 'balanced', label: 'Balanced', desc: 'Role · Task · Context · Output — works for anything',       dot: 'rgba(100,170,255,0.9)', group: 'general' },
  { key: 'detailed', label: 'Detailed', desc: 'More depth, more constraints — for complex requests',       dot: 'rgba(100,170,255,0.8)', group: 'general' },
  { key: 'concise',  label: 'Concise',  desc: 'Tight, focused prompt — forces sharp thinking',             dot: 'rgba(150,160,175,0.8)', group: 'general' },
  { key: 'chain',    label: 'Chain',    desc: 'Step-by-step reasoning — best for complex analysis',        dot: 'rgba(100,170,255,0.7)', group: 'general' },
  { key: 'code',     label: 'Code',     desc: 'Stack · constraints · output format — production quality',  dot: 'rgba(100,170,255,0.9)', group: 'general' },
  { key: 'design',   label: 'Design',   desc: 'UI · UX · component thinking — frames design problems',    dot: 'rgba(200,200,210,0.7)', group: 'general' },
  { key: 'refine',   label: 'Refine',   desc: "Improve an existing prompt — speak what's wrong",          dot: 'rgba(167,139,250,0.9)', group: 'general' },
  { key: 'polish',   label: 'Polish',   desc: 'Paste rough text, speak the change — get it back clean',   dot: 'rgba(48,209,88,0.8)',   group: 'specialist' },
  { key: 'image',    label: 'Image',    desc: 'Nano Banana prompt — 5 categories, 3 variations',          dot: 'rgba(139,92,246,0.9)',  group: 'specialist' },
  { key: 'video',    label: 'Video',    desc: 'Veo · Sora · Runway · Kling · Pika — model-aware params',  dot: 'rgba(251,146,60,0.9)',  group: 'specialist' },
  { key: 'workflow', label: 'Workflow', desc: 'Plain English → importable n8n JSON',                      dot: 'rgba(34,197,94,0.9)',   group: 'specialist' },
  { key: 'email',    label: 'Email',    desc: 'Speak the situation → ready-to-send email with tone',      dot: 'rgba(20,184,166,0.9)',  group: 'specialist' },
]

const GENERAL_MODES = MODES.filter(m => m.group === 'general')
const SPECIALIST_MODES = MODES.filter(m => m.group === 'specialist')

const SECTION_LABEL_STYLE = {
  fontFamily: '"DM Mono", monospace',
  fontSize: '8.5px',
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.2)',
  padding: '8px 10px 4px',
  display: 'block',
}

const DIVIDER_STYLE = {
  height: '0.5px',
  background: 'rgba(255,255,255,0.06)',
  margin: '4px 0',
}

export default function ModeDropdown({ mode, top, right, onSelect, onShowShortcuts, onShowHistory, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose])

  function handleSelect(key) {
    onSelect(key)
    onClose()
  }

  function renderItem(m) {
    const isActive = mode === m.key
    return (
      <div
        key={m.key}
        onPointerDown={e => { e.stopPropagation(); handleSelect(m.key) }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 10px',
          cursor: 'pointer',
          borderRadius: '6px',
          margin: '0 4px',
          background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.88)', lineHeight: 1.3 }}>
            {m.label}
          </span>
          <span style={{
            display: 'block', fontSize: '10.5px', fontWeight: 300,
            color: 'rgba(255,255,255,0.28)', lineHeight: 1.4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {m.desc}
          </span>
        </span>
        {isActive && (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    )
  }

  const menu = (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: `${top}px`,
        right: `${right}px`,
        width: '340px',
        background: 'rgba(16,16,26,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
        zIndex: 9999,
        overflow: 'hidden',
        WebkitAppRegion: 'no-drag',
        paddingBottom: '4px',
      }}
    >
      <div style={{ paddingTop: '4px' }}>
        <span style={SECTION_LABEL_STYLE}>General</span>
        {GENERAL_MODES.map(renderItem)}
      </div>
      <div style={DIVIDER_STYLE} />
      <div>
        <span style={SECTION_LABEL_STYLE}>Specialist</span>
        {SPECIALIST_MODES.map(renderItem)}
      </div>
      <div style={DIVIDER_STYLE} />
      <div style={{ padding: '2px 0' }}>
        <div
          onPointerDown={e => { e.stopPropagation(); onShowShortcuts(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', cursor: 'pointer', borderRadius: '6px', margin: '0 4px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>Keyboard shortcuts</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: 'system-ui' }}>⌘?</span>
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onShowHistory(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', cursor: 'pointer', borderRadius: '6px', margin: '0 4px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>History</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: 'system-ui' }}>⌘H</span>
        </div>
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
