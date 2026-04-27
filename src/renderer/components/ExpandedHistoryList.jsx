import { useState, useEffect } from 'react'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory } from '../utils/history.js'
import { getModeTagStyle } from '../utils/promptUtils.js'

export default function ExpandedHistoryList({ currentState, selected, onSelect }) {
  const [history, setHistory] = useState(() => getHistory())
  const [hoveredId, setHoveredId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')

  // Refresh list on state change (new prompt arrives) and sync bookmark/rating indicators
  useEffect(() => {
    setHistory(query ? searchHistory(query) : getHistory())
  }, [currentState])

  // Sync bookmark/rating display when selected entry changes via detail panel
  useEffect(() => {
    if (!selected) return
    setHistory(prev => prev.map(e =>
      e.id === selected.id
        ? { ...e, bookmarked: selected.bookmarked, rating: selected.rating, ratingTag: selected.ratingTag }
        : e
    ))
  }, [selected])

  function handleSearch(e) {
    setQuery(e.target.value)
    setHistory(searchHistory(e.target.value))
  }

  function handleClearSearch() {
    setQuery('')
    setSearchOpen(false)
    setHistory(getHistory())
  }

  function handleClearAll() {
    clearHistory()
    setHistory([])
    onSelect(null)
  }

  function handleEntryDelete(id, e) {
    e.stopPropagation()
    deleteHistoryItem(id)
    const updated = getHistory()
    setHistory(query ? searchHistory(query) : updated)
    if (selected?.id === id) onSelect(updated[0] || null)
  }

  const tabFiltered = activeTab === 'saved' ? history.filter(e => e.bookmarked) : history
  const filteredEntries = tabFiltered.filter(e => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'up') return e.rating === 'up'
    if (activeFilter === 'down') return e.rating === 'down'
    if (activeFilter === 'unrated') return !e.rating
    return true
  })
  const savedCount = history.filter(e => e.bookmarked).length
  const statsRated = history.reduce((acc, e) => {
    if (e.rating) { acc.total++; if (e.rating === 'up') acc.up++ }
    return acc
  }, { total: 0, up: 0 })
  const upPct = statsRated.total > 0 ? Math.round(statsRated.up / statsRated.total * 100) : 0
  const downPct = 100 - upPct
  const footerText = savedCount > 0
    ? `${history.length} prompt${history.length !== 1 ? 's' : ''} · ${savedCount} saved`
    : `${history.length} prompt${history.length !== 1 ? 's' : ''}`

  return (
    <div style={{
      width: '300px', flexShrink: 0,
      background: 'transparent',
      borderRight: '0.5px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', flexShrink: 0,
        borderBottom: '0.5px solid rgba(255,255,255,0.05)',
      }}>
        {searchOpen ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            height: '28px', background: 'rgba(255,255,255,0.07)',
            border: '0.5px solid rgba(10,132,255,0.35)',
            borderRadius: '7px', padding: '0 10px',
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="4" stroke="rgba(100,180,255,0.6)" strokeWidth="1.2" />
              <path d="M8.5 8.5L11 11" stroke="rgba(100,180,255,0.6)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={handleSearch}
              placeholder="Search prompts..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', fontSize: '11px',
                color: 'rgba(255,255,255,0.8)', fontFamily: 'inherit',
              }}
            />
            <button onClick={handleClearSearch} style={{
              fontSize: '10px', color: 'rgba(255,255,255,0.5)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
            }}>
              Session History
            </span>
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.09)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
                <path d="M8.5 8.5L11 11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* All / Saved tabs */}
      <div style={{ display: 'flex', padding: '8px 10px 0', gap: '4px', flexShrink: 0 }}>
        {['all', 'saved'].map(tab => {
          const isActive = activeTab === tab
          const isSaved = tab === 'saved'
          return (
            <div
              key={tab}
              onClick={() => { setActiveTab(tab); setActiveFilter('all') }}
              style={{
                flex: 1, height: '26px', borderRadius: '7px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                background: isActive
                  ? (isSaved ? 'rgba(255,189,46,0.12)' : 'rgba(10,132,255,0.12)')
                  : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${isActive
                  ? (isSaved ? 'rgba(255,189,46,0.28)' : 'rgba(10,132,255,0.25)')
                  : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 150ms',
              }}
            >
              {isSaved && (
                <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                  <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                    fill={isActive ? 'rgba(255,189,46,0.85)' : 'none'}
                    stroke={isActive ? 'rgba(255,189,46,0.85)' : 'rgba(255,255,255,0.3)'}
                    strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 500 : 400,
                color: isActive
                  ? (isSaved ? 'rgba(255,189,46,0.9)' : 'rgba(100,180,255,0.9)')
                  : 'rgba(255,255,255,0.35)',
              }}>
                {tab === 'all' ? 'All' : 'Saved'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '4px', padding: '7px 10px 6px', flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'up', label: '👍' },
          { id: 'down', label: '👎' },
          { id: 'unrated', label: 'Unrated' },
        ].map(f => {
          const isActive = activeFilter === f.id
          const activeColors = {
            all:     { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', text: 'rgba(255,255,255,0.55)' },
            up:      { bg: 'rgba(48,209,88,0.10)',   border: 'rgba(48,209,88,0.25)',   text: 'rgba(100,220,130,0.8)' },
            down:    { bg: 'rgba(255,59,48,0.10)',   border: 'rgba(255,59,48,0.25)',   text: 'rgba(255,100,90,0.75)' },
            unrated: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.14)', text: 'rgba(255,255,255,0.55)' },
          }
          const inactiveColor = { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.3)' }
          const c = isActive ? activeColors[f.id] : inactiveColor
          return (
            <span key={f.id} onClick={() => setActiveFilter(f.id)} style={{
              padding: '2px 7px', borderRadius: '20px', fontSize: '9px',
              fontWeight: 600, cursor: 'pointer',
              background: c.bg, border: `0.5px solid ${c.border}`, color: c.text,
              transition: 'all 120ms',
            }}>
              {f.label}
            </span>
          )
        })}
      </div>

      {/* Stats bar */}
      {activeTab === 'all' && history.length > 0 && (
        <div style={{
          margin: '0 10px 8px', padding: '6px 10px',
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: '7px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
            {history.length} prompt{history.length !== 1 ? 's' : ''}
          </span>
          {statsRated.total > 0 && (
            <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'rgba(100,220,130,0.7)' }}>👍 {upPct}%</span>
              <div style={{ width: '0.5px', height: '9px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '10px', color: 'rgba(255,100,90,0.65)' }}>👎 {downPct}%</span>
            </div>
          )}
        </div>
      )}

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filteredEntries.length === 0 ? (
          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.25)',
            textAlign: 'center', padding: '24px 16px',
          }}>
            {activeFilter !== 'all' ? 'No prompts match this filter'
              : activeTab === 'saved' ? 'No saved prompts yet'
              : query ? 'No results found'
              : 'No history yet'}
          </div>
        ) : (
          filteredEntries.map(entry => {
            const isActive = selected?.id === entry.id
            const isEntryPolish = entry.mode === 'polish'
            const d = new Date(entry.timestamp)
            const ts = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const tagStyle = getModeTagStyle(entry.mode)
            const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
            const ratingTagIsPositive = entry.ratingTag && POSITIVE_TAGS.includes(entry.ratingTag)
            const ratingTagStyle = entry.ratingTag
              ? ratingTagIsPositive
                ? { bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.25)', color: 'rgba(100,220,130,0.9)' }
                : { bg: 'rgba(255,59,48,0.09)', border: 'rgba(255,59,48,0.25)', color: 'rgba(255,100,90,0.9)' }
              : null
            return (
              <div
                key={entry.id}
                onClick={() => onSelect(entry)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: isActive ? '10px 18px 10px 16px' : '10px 18px',
                  borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                  borderLeft: isActive
                    ? (isEntryPolish ? '2px solid rgba(48,209,88,0.5)' : '2px solid rgba(10,132,255,0.5)')
                    : '2px solid transparent',
                  background: isActive
                    ? (isEntryPolish ? 'rgba(48,209,88,0.07)' : 'rgba(10,132,255,0.07)')
                    : hoveredId === entry.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                  cursor: 'pointer', position: 'relative',
                  transition: 'background 100ms',
                }}
              >
                {/* Row 1: timestamp + mode pill + rating tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>
                      {ts}
                    </span>
                    {entry.isIteration && (
                      <span style={{ fontSize: '9px', color: 'rgba(10,132,255,0.6)' }}>↻</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {ratingTagStyle && (
                      <span style={{
                        fontSize: '9px', fontWeight: 500, padding: '1px 6px', borderRadius: '3px',
                        background: ratingTagStyle.bg,
                        border: `0.5px solid ${ratingTagStyle.border}`,
                        color: ratingTagStyle.color,
                      }}>
                        {entry.ratingTag}
                      </span>
                    )}
                    <span style={{
                      fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px',
                      background: tagStyle.background, color: tagStyle.color,
                    }}>
                      {entry.mode}
                    </span>
                  </div>
                </div>

                {/* Row 2: title + inline bookmark/rating indicators */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  marginTop: '4px', paddingRight: hoveredId === entry.id ? '20px' : '0',
                }}>
                  <span style={{
                    fontSize: '13px',
                    color: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.48)',
                    fontWeight: isActive ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    flex: 1, minWidth: 0,
                  }}>
                    {entry.title || entry.transcript?.split(' ').slice(0, 6).join(' ')}
                  </span>
                  {entry.bookmarked && (
                    <svg width="8" height="10" viewBox="0 0 10 13" fill="rgba(255,189,46,0.8)" style={{ flexShrink: 0 }}>
                      <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke="rgba(255,189,46,0.8)" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  )}
                  {entry.rating && (
                    <span style={{ fontSize: '9px', flexShrink: 0 }}>{entry.rating === 'up' ? '👍' : '👎'}</span>
                  )}
                </div>

                {/* Hover-only delete */}
                <button
                  onClick={(e) => handleEntryDelete(entry.id, e)}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    fontSize: '10px', color: 'rgba(255,255,255,0.4)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    opacity: hoveredId === entry.id ? 1 : 0,
                    transition: 'opacity 120ms',
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '9px 14px',
        borderTop: '0.5px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
          {activeTab === 'saved' ? `${tabFiltered.length} saved` : footerText}
        </span>
        <button
          onClick={handleClearAll}
          style={{
            fontSize: '10px', color: 'rgba(255,59,48,0.5)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', padding: 0,
            transition: 'color 120ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,59,48,0.8)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,59,48,0.5)'}
        >
          Clear all
        </button>
      </div>
    </div>
  )
}
