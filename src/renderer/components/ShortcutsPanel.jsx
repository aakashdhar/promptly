import { readableColor } from '../utils/promptUtils.js'

export default function ShortcutsPanel({ onClose }) {

  const groups = [
    {
      label: 'Recording',
      color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))',
      items: [
        { desc: 'Start / stop recording', keys: ['⌥', 'Space'] },
        { desc: 'Pause / resume recording', keys: ['⌥', 'P'] },
      ]
    },
    {
      label: 'Prompt',
      color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))',
      items: [
        { desc: 'Type prompt', keys: ['⌘', 'T'] },
        { desc: 'Copy last prompt', keys: ['⌘', 'C'] },
        { desc: 'Export prompt', keys: ['⌘', 'E'] },
        { desc: 'Iterate on last prompt', keys: ['⌘', 'I'] },
      ]
    },
    {
      label: 'Navigation',
      color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))',
      items: [
        { desc: 'Open history', keys: ['⌘', 'H'] },
        { desc: 'Open path settings', keys: ['⌘', '/'] },
        { desc: 'Show / hide window', keys: ['⌥', 'Space'] },
        { desc: 'Reset to idle', keys: ['Esc'] },
      ]
    }
  ]

  return (
    <div style={{
      position: 'relative',
      zIndex: 1,
      padding: '16px 22px 20px',
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)'
        }}>
          Keyboard shortcuts
        </span>
        <button
          onClick={onClose}
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            background: 'rgba(var(--ink),0.05)',
            border: '0.5px solid rgba(var(--ink),0.1)',
            borderRadius: '7px',
            padding: '4px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          Done
        </button>
      </div>

      {/* Groups */}
      {groups.map((group, gi) => (
        <div key={gi}>

          {/* Divider between groups — not before first group */}
          {gi > 0 && (
            <div style={{
              height: '0.5px',
              background: 'linear-gradient(90deg, transparent, rgba(var(--ink),0.06), transparent)',
              margin: '10px 0'
            }}/>
          )}

          {/* Group label */}
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: readableColor(group.color),
            marginBottom: '6px',
            marginTop: gi === 0 ? '0' : '14px',
            paddingLeft: '2px'
          }}>
            {group.label}
          </div>

          {/* Shortcut rows */}
          {group.items.map((item, ii) => (
            <div
              key={ii}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderRadius: '9px',
                marginBottom: '3px',
                cursor: 'default'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--ink),0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Description */}
              <span style={{
                fontSize: '13px',
                color: 'rgba(var(--ink),0.8)',
                letterSpacing: '0.01em'
              }}>
                {item.desc}
              </span>

              {/* Key chips */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0
              }}>
                {item.keys.map((key, ki) => (
                  <span key={ki} style={{display:'flex',alignItems:'center',gap:'3px'}}>
                    {ki > 0 && (
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        margin: '0 1px'
                      }}>+</span>
                    )}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '24px',
                      height: '22px',
                      padding: '0 6px',
                      background: 'rgba(var(--ink),0.07)',
                      border: '0.5px solid rgba(var(--ink),0.14)',
                      borderBottom: '1.5px solid rgba(0,0,0,0.35)',
                      borderRadius: '5px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      fontFamily: 'inherit',
                      letterSpacing: '0.01em',
                      boxShadow: '0 1px 0 rgba(var(--ink),0.04) inset'
                    }}>
                      {key}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
