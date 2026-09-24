import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MODE_REGISTRY from '../../../shared/modes.json'

const { modes: MODES } = MODE_REGISTRY

// The mode menu is organised around the one real choice — Dictation or Craft a prompt — with
// the prompt styles as compact chips underneath and one line describing the hovered (or current)
// mode, instead of a long list where every mode has a paragraph.
const PROMPT_STYLES = MODES.filter((m) => m.group === 'general' && m.kind !== 'dictation')
const SPECIALIST = MODES.filter((m) => m.group === 'specialist')
const BY_KEY = Object.fromEntries(MODES.map((m) => [m.key, m]))

const sectionLabel = { fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', margin: '14px 0 7px' }

function Chip({ m, active, onPick, onHover }) {
  return (
    <button
      type="button"
      onClick={() => onPick(m.key)}
      onMouseEnter={() => onHover(m.key)}
      onFocus={() => onHover(m.key)}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        height: '28px', padding: '0 11px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: '12px', fontWeight: active ? 600 : 400,
        color: active ? 'rgba(var(--ink),0.95)' : 'var(--text-secondary)',
        background: active ? 'rgba(var(--ink),0.1)' : 'rgba(var(--ink),0.035)',
        border: `0.5px solid ${active ? 'rgba(var(--ink),0.28)' : 'rgba(var(--ink),0.1)'}`,
        transition: 'background 100ms, border-color 100ms',
      }}
    >
      <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
      {m.label}
    </button>
  )
}

export default function ModeDropdown({ mode, top, right, onSelect, onShowShortcuts, onShowHistory, onClose, anchorRef }) {
  const ref = useRef(null)
  const [hovered, setHovered] = useState(null)
  const [promptStyle, setPromptStyle] = useState('balanced')
  const isDictation = BY_KEY[mode]?.kind === 'dictation'
  const described = BY_KEY[hovered] || BY_KEY[mode]

  useEffect(() => {
    window.electronAPI?.getPreferences?.().then((p) => { if (p?.promptStyle) setPromptStyle(p.promptStyle) }).catch(() => {})
  }, [])

  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        // Let the anchor (pill) handle its own toggle — don't race with its onClick
        if (anchorRef?.current?.contains(e.target)) return
        onClose()
      }
    }
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose, anchorRef])

  function pick(key) {
    onSelect(key)
    onClose()
  }

  // "Craft a prompt" from Dictation goes to the prompt style set in Settings (Balanced by default).
  const segments = [
    ['dictate', 'Dictation', isDictation],
    [isDictation ? promptStyle : mode, 'Craft a prompt', !isDictation],
  ]

  // Opens under the mode button, kept inside the window whichever side the button is on.
  const WIDTH = 440
  const anchor = anchorRef?.current?.getBoundingClientRect()
  const wantedLeft = anchor ? anchor.left : window.innerWidth - right - WIDTH
  const left = Math.max(12, Math.min(window.innerWidth - WIDTH - 12, wantedLeft))

  const menu = (
    <div
      ref={ref}
      role="dialog"
      aria-label="Mode"
      style={{
        position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${WIDTH}px`, boxSizing: 'border-box',
        padding: '12px 16px 10px',
        background: 'var(--surface-raised)', border: '0.5px solid rgba(var(--ink),0.12)', borderRadius: '14px',
        boxShadow: 'var(--popover-shadow)', zIndex: 9999, WebkitAppRegion: 'no-drag',
      }}
    >
      <div role="tablist" aria-label="How to use what you say" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', padding: '3px', borderRadius: '10px', background: 'rgba(var(--ink),0.06)' }}>
        {segments.map(([key, label, active]) => (
          <button
            key={label}
            role="tab"
            aria-selected={active}
            onClick={() => (active ? onClose() : pick(key))}
            onMouseEnter={() => setHovered(key)}
            style={{
              height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '13px', fontWeight: active ? 600 : 500,
              color: active ? 'rgba(var(--ink),0.95)' : 'var(--text-secondary)',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.14)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={sectionLabel}>Prompt style</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {PROMPT_STYLES.map((m) => <Chip key={m.key} m={m} active={mode === m.key} onPick={pick} onHover={setHovered} />)}
      </div>

      <div style={sectionLabel}>Specialist</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {SPECIALIST.map((m) => <Chip key={m.key} m={m} active={mode === m.key} onPick={pick} onHover={setHovered} />)}
      </div>

      {/* What the hovered (or current) mode does: one place, two lines at most. */}
      <div aria-live="polite" style={{ minHeight: '34px', marginTop: '12px', paddingTop: '10px', borderTop: '0.5px solid rgba(var(--ink),0.08)', fontSize: '12px', lineHeight: 1.45, color: 'var(--text-secondary)' }}>
        {described && <><span style={{ color: 'rgba(var(--ink),0.9)', fontWeight: 500 }}>{described.label}:</span> {described.desc}</>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '0.5px solid rgba(var(--ink),0.08)' }}>
        {[['Keyboard shortcuts', '⌘?', onShowShortcuts], ['History', '⌘H', onShowHistory]].map(([label, keys, action]) => (
          <button
            key={label}
            type="button"
            onClick={() => { action(); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text-secondary)' }}
          >
            {label}<span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{keys}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
