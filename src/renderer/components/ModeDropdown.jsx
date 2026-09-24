import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import MODE_REGISTRY from '../../../shared/modes.json'

const { modes: MODES } = MODE_REGISTRY

const GENERAL_MODES = MODES.filter(m => m.group === 'general')
const SPECIALIST_MODES = MODES.filter(m => m.group === 'specialist')

const SECTION_LABEL_STYLE = {
  fontFamily: '"DM Mono", monospace',
  fontSize: '11px',
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  padding: '8px 10px 4px',
  display: 'block',
}

const DIVIDER_STYLE = {
  height: '0.5px',
  background: 'rgba(var(--ink),0.06)',
  margin: '4px 0',
}

export default function ModeDropdown({ mode, top, right, onSelect, onShowShortcuts, onShowHistory, onClose, anchorRef, fitWindow = false }) {
  const ref = useRef(null)

  // In the compact bar the window is only as tall as the bar: grow it to fit the whole menu.
  useLayoutEffect(() => {
    if (fitWindow && ref.current) window.electronAPI?.resizeWindow(Math.ceil(top + ref.current.offsetHeight + 16))
  }, [fitWindow, top])

  useEffect(() => {
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        // Let the anchor (pill) handle its own toggle — don't race with its onClick
        if (anchorRef?.current?.contains(e.target)) return
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [onClose, anchorRef])

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
          padding: '6px 10px',
          cursor: 'pointer',
          borderRadius: '6px',
          margin: '0 4px',
          background: isActive ? 'rgba(var(--ink),0.07)' : 'transparent',
          transition: 'background 100ms',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(var(--ink),0.04)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, color: 'rgba(var(--ink),0.95)', lineHeight: 1.3 }}>
            {m.label}
          </span>
          <span style={{
            display: 'block', fontSize: '11px', fontWeight: 400,
            color: 'var(--text-secondary)', lineHeight: 1.4,
          }}>
            {m.desc}
          </span>
        </span>
        {isActive && (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1.5 5.5L4.5 8.5L9.5 2.5" stroke="rgba(var(--ink),0.65)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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
        width: '380px',
        background: 'var(--surface-raised)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(var(--ink),0.12)',
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
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--ink),0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>Keyboard shortcuts</span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'system-ui' }}>⌘?</span>
        </div>
        <div
          onPointerDown={e => { e.stopPropagation(); onShowHistory(); onClose() }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', cursor: 'pointer', borderRadius: '6px', margin: '0 4px' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--ink),0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>History</span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'system-ui' }}>⌘H</span>
        </div>
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
