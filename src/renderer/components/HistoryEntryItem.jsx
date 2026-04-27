import { formatTime } from '../utils/history.js'

export default function HistoryEntryItem({ entry, isSelected, isHovered, onSelect, onHoverEnter, onHoverLeave, onDelete }) {
  const isPolish = entry.mode === 'polish'

  return (
    <div
      onClick={() => onSelect(entry)}
      onMouseEnter={() => onHoverEnter(entry.id)}
      onMouseLeave={onHoverLeave}
      style={{
        padding: '12px 16px',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        borderLeft: isSelected
          ? isPolish ? '2px solid rgba(48,209,88,0.5)' : '2px solid rgba(10,132,255,0.6)'
          : '2px solid transparent',
        background: isSelected
          ? isPolish ? 'rgba(48,209,88,0.07)' : 'rgba(10,132,255,0.09)'
          : 'transparent',
        cursor: 'pointer',
        transition: 'all 150ms',
        position: 'relative',
      }}
    >
      <div style={{
        fontSize: '12px',
        fontWeight: isSelected ? 500 : 400,
        color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)',
        marginBottom: '6px',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        paddingRight: '20px',
      }}>
        {entry.title || entry.transcript?.split(' ').slice(0, 6).join(' ')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 600, letterSpacing: '.06em',
          textTransform: 'uppercase', padding: '2px 7px',
          borderRadius: '20px',
          background: isSelected
            ? isPolish ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.15)'
            : 'rgba(255,255,255,0.07)',
          color: isSelected
            ? isPolish ? 'rgba(100,220,130,0.85)' : 'rgba(100,180,255,0.85)'
            : 'rgba(255,255,255,0.70)',
        }}>
          {entry.mode}
        </span>
        {entry.isIteration && (
          <span style={{ fontSize: '9px', color: 'rgba(10,132,255,0.72)', marginLeft: '4px' }}>↻</span>
        )}
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.58)' }}>
          {formatTime(entry.timestamp)}
        </span>
        {entry.rating === 'down' && entry.ratingTag && (
          <span style={{
            fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
            background: 'rgba(255,59,48,0.08)',
            border: '0.5px solid rgba(255,59,48,0.2)',
            color: 'rgba(255,100,90,0.7)',
          }}>
            {entry.ratingTag}
          </span>
        )}
        {entry.rating === 'up' && entry.ratingTag && (
          <span style={{
            fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
            background: 'rgba(48,209,88,0.08)',
            border: '0.5px solid rgba(48,209,88,0.2)',
            color: 'rgba(100,220,130,0.7)',
          }}>
            {entry.ratingTag}
          </span>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
        style={{
          position: 'absolute', top: '12px', right: '12px',
          fontSize: '11px', color: 'rgba(255,255,255,0.50)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          lineHeight: 1,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 120ms ease',
        }}
      >
        ✕
      </button>

      {(entry.bookmarked || entry.rating) && !isHovered && (
        <div style={{
          position: 'absolute', top: '10px', right: '12px',
          display: 'flex', gap: '4px', alignItems: 'center',
        }}>
          {entry.bookmarked && (
            <svg width="9" height="11" viewBox="0 0 10 13" fill="rgba(255,189,46,0.8)">
              <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke="rgba(255,189,46,0.8)" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
          )}
          {entry.rating && (
            <span style={{ fontSize: '10px' }}>
              {entry.rating === 'up' ? '👍' : '👎'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
