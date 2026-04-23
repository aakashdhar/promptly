export default function ShortcutsPanel({ onClose }) {

  const groups = [
    {
      label: 'Recording',
      color: 'rgba(10,132,255,0.55)',
      items: [
        { desc: 'Start / stop recording', keys: ['⌥', 'Space'] },
        { desc: 'Pause / resume recording', keys: ['⌥', 'P'] },
      ]
    },
    {
      label: 'Prompt',
      color: 'rgba(10,132,255,0.55)',
      items: [
        { desc: 'Type prompt', keys: ['⌘', 'T'] },
        { desc: 'Copy last prompt', keys: ['⌘', 'C'] },
        { desc: 'Export prompt', keys: ['⌘', 'E'] },
        { desc: 'Iterate on last prompt', keys: ['⌘', 'I'] },
      ]
    },
    {
      label: 'Navigation',
      color: 'rgba(10,132,255,0.55)',
      items: [
        { desc: 'Open history', keys: ['⌘', 'H'] },
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
          color: 'rgba(255,255,255,0.28)'
        }}>
          Keyboard shortcuts
        </span>
        <button
          onClick={onClose}
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid rgba(255,255,255,0.1)',
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
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              margin: '10px 0'
            }}/>
          )}

          {/* Group label */}
          <div style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: group.color,
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
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Description */}
              <span style={{
                fontSize: '12.5px',
                color: 'rgba(255,255,255,0.6)',
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
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.2)',
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
                      background: 'rgba(255,255,255,0.07)',
                      border: '0.5px solid rgba(255,255,255,0.14)',
                      borderBottom: '1.5px solid rgba(0,0,0,0.35)',
                      borderRadius: '5px',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: '-apple-system, sans-serif',
                      letterSpacing: '0.01em',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset'
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
