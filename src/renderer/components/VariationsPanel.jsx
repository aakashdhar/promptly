export default function VariationsPanel({ variations, selectedVariation, isLoading, onSelectVariation, onGenerateMore }) {
  return (
    <div style={{
      width: '320px', flexShrink: 0,
      borderLeft: '0.5px solid rgba(255,255,255,0.06)',
      background: 'rgba(10,10,15,1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '12px 16px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,0.25)' }}>
          {isLoading ? 'Generating variations…' : `${variations.length} variation${variations.length !== 1 ? 's' : ''} · tap to select`}
        </span>
        <button type="button" onClick={onGenerateMore} disabled={isLoading} style={{
          background: 'none', border: 'none', padding: 0,
          cursor: isLoading ? 'default' : 'pointer',
          fontSize: '11px', color: isLoading ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.7)',
        }}>
          All different →
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} style={{ padding: '11px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
            <div className="skeleton-pulse" style={{ height: '9px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', width: '50%', marginBottom: '7px' }} />
            <div className="skeleton-pulse" style={{ height: '9px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', width: '85%', marginBottom: '4px' }} />
            <div className="skeleton-pulse" style={{ height: '9px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', width: '70%', marginBottom: '4px' }} />
            <div className="skeleton-pulse" style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', width: '40%', marginTop: '4px' }} />
          </div>
        ))}
        {!isLoading && variations.map(v => {
          const isSelected = v.id === selectedVariation
          return (
            <div
              key={v.id}
              onClick={() => onSelectVariation(v.id)}
              style={{
                padding: '11px 16px', paddingLeft: isSelected ? '14px' : '16px',
                borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(139,92,246,0.07)' : 'transparent',
                borderLeft: isSelected ? '2px solid rgba(139,92,246,0.5)' : '2px solid transparent',
                transition: 'background 150ms',
              }}
            >
              <div style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '.06em',
                textTransform: 'uppercase', color: 'rgba(139,92,246,0.5)', marginBottom: '5px',
              }}>
                Variation {v.id}{isSelected ? ' · selected' : ''}
              </div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                {isSelected ? v.prompt : (v.prompt.length > 120 ? v.prompt.slice(0, 120) + '…' : v.prompt)}
              </div>
              {v.focus && (
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.28)', marginTop: '3px' }}>
                  {v.focus}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '0.5px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onGenerateMore}
          disabled={isLoading}
          style={{
            width: '100%', height: '34px',
            background: 'rgba(139,92,246,0.08)',
            border: '0.5px solid rgba(139,92,246,0.2)', borderRadius: '8px',
            fontSize: '12px', color: 'rgba(196,168,255,0.7)',
            cursor: isLoading ? 'default' : 'pointer',
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          {isLoading ? 'Generating…' : '+ Generate 3 more variations'}
        </button>
      </div>
    </div>
  )
}
