import { useState, useEffect } from 'react'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory } from '../utils/history.js'
import { getModeTagStyle, readableColor } from '../utils/promptUtils.js'
import MODE_REGISTRY from '../../../shared/modes.json'

const MODE_LABELS = Object.fromEntries(MODE_REGISTRY.modes.map((m) => [m.key, m.label]))

export default function ExpandedHistoryList({ currentState, selected, onSelect }) {
  const [history, setHistory] = useState(() => getHistory())
  const [hoveredId, setHoveredId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  // ⌘H (and the menu's History) jump straight to searching your history.
  useEffect(() => {
    const open = () => setSearchOpen(true)
    window.addEventListener('promptly:search-history', open)
    return () => window.removeEventListener('promptly:search-history', open)
  }, [])
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
      borderRight: '0.5px solid rgba(var(--ink),0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', flexShrink: 0,
        borderBottom: '0.5px solid rgba(var(--ink),0.05)',
      }}>
        {searchOpen ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            height: '28px', background: 'rgba(var(--ink),0.07)',
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
                color: 'rgba(var(--ink),0.95)', fontFamily: 'inherit',
              }}
            />
            <button onClick={handleClearSearch} style={{
              fontSize: '11px', color: 'var(--text-secondary)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              color: 'var(--text-tertiary)', textTransform: 'uppercase',
            }}>
              Session History
            </span>
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                width: '24px', height: '24px', borderRadius: '6px',
                background: 'rgba(var(--ink),0.05)',
                border: '0.5px solid rgba(var(--ink),0.09)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="4" stroke="rgba(var(--ink),0.5)" strokeWidth="1.2" />
                <path d="M8.5 8.5L11 11" stroke="rgba(var(--ink),0.5)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* All / Saved tabs */}
      <div style={{ display: 'flex', padding: '8px 18px 0', gap: '6px', flexShrink: 0 }}>
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
                  : 'rgba(var(--ink),0.04)',
                border: `0.5px solid ${isActive
                  ? (isSaved ? 'rgba(255,189,46,0.28)' : 'rgba(10,132,255,0.25)')
                  : 'rgba(var(--ink),0.08)'}`,
                transition: 'all 150ms',
              }}
            >
              {isSaved && (
                <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                  <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                    fill={isActive ? 'rgba(255,189,46,0.85)' : 'none'}
                    stroke={isActive ? 'rgba(255,189,46,0.85)' : 'rgba(var(--ink),0.3)'}
                    strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? 500 : 400,
                color: readableColor(isActive
                  ? (isSaved ? 'rgba(255,189,46,0.9)' : 'rgba(100,180,255,0.9)')
                  : 'var(--text-tertiary)'),
              }}>
                {tab === 'all' ? 'All' : 'Saved'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '6px', padding: '10px 18px 8px', flexWrap: 'wrap', flexShrink: 0 }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'up', label: '👍' },
          { id: 'down', label: '👎' },
          { id: 'unrated', label: 'Unrated' },
        ].map(f => {
          const isActive = activeFilter === f.id
          const activeColors = {
            all:     { bg: 'rgba(var(--ink),0.08)', border: 'rgba(var(--ink),0.14)', text: 'rgba(var(--ink),0.55)' },
            up:      { bg: 'rgba(48,209,88,0.10)',   border: 'rgba(48,209,88,0.25)',   text: 'rgba(100,220,130,0.8)' },
            down:    { bg: 'rgba(255,59,48,0.10)',   border: 'rgba(255,59,48,0.25)',   text: 'rgba(255,100,90,0.75)' },
            unrated: { bg: 'rgba(var(--ink),0.08)', border: 'rgba(var(--ink),0.14)', text: 'rgba(var(--ink),0.55)' },
          }
          const inactiveColor = { bg: 'rgba(var(--ink),0.04)', border: 'rgba(var(--ink),0.08)', text: 'rgba(var(--ink),0.3)' }
          const c = isActive ? activeColors[f.id] : inactiveColor
          return (
            <span key={f.id} onClick={() => setActiveFilter(f.id)} style={{
              padding: '2px 7px', borderRadius: '20px', fontSize: '11px',
              fontWeight: 600, cursor: 'pointer',
              background: c.bg, border: `0.5px solid ${c.border}`, color: readableColor(c.text),
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
          margin: '0 18px 10px', padding: '6px 10px',
          background: 'rgba(var(--ink),0.03)',
          border: '0.5px solid rgba(var(--ink),0.06)',
          borderRadius: '7px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {history.length} prompt{history.length !== 1 ? 's' : ''}
          </span>
          {statsRated.total > 0 && (
            <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))' }}>👍 {upPct}%</span>
              <div style={{ width: '0.5px', height: '9px', background: 'rgba(var(--ink),0.1)' }} />
              <span style={{ fontSize: '11px', color: 'color-mix(in oklab, rgb(255,100,90) var(--accent-text-strength), rgb(var(--ink)))' }}>👎 {downPct}%</span>
            </div>
          )}
        </div>
      )}

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filteredEntries.length === 0 ? (
          <div style={{
            fontSize: '11px', color: 'var(--text-tertiary)',
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
                ? { bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.25)', color: 'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))' }
                : { bg: 'rgba(255,59,48,0.09)', border: 'rgba(255,59,48,0.25)', color: 'color-mix(in oklab, rgb(255,100,90) var(--accent-text-strength), rgb(var(--ink)))' }
              : null
            return (
              <div
                key={entry.id}
                data-history-entry
                onClick={() => onSelect(entry)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: isActive ? '10px 18px 10px 16px' : '10px 18px',
                  borderBottom: '0.5px solid rgba(var(--ink),0.04)',
                  borderLeft: isActive
                    ? (isEntryPolish ? '2px solid rgba(48,209,88,0.5)' : '2px solid rgba(10,132,255,0.5)')
                    : '2px solid transparent',
                  background: isActive
                    ? (isEntryPolish ? 'rgba(48,209,88,0.07)' : 'rgba(10,132,255,0.07)')
                    : hoveredId === entry.id ? 'rgba(var(--ink),0.03)' : 'transparent',
                  cursor: 'pointer', position: 'relative',
                  transition: 'background 100ms',
                }}
              >
                {/* Row 1: timestamp + mode pill + rating tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {ts}
                    </span>
                    {entry.isIteration && (
                      <span style={{ fontSize: '11px', color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))' }}>↻</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {ratingTagStyle && (
                      <span style={{
                        fontSize: '11px', fontWeight: 500, padding: '1px 6px', borderRadius: '3px',
                        background: ratingTagStyle.bg,
                        border: `0.5px solid ${ratingTagStyle.border}`,
                        color: readableColor(ratingTagStyle.color),
                      }}>
                        {entry.ratingTag}
                      </span>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                      textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px',
                      background: tagStyle.background, color: readableColor(tagStyle.color),
                    }}>
                      {MODE_LABELS[entry.mode] || entry.mode}
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
                    color: isActive ? 'rgba(var(--ink),0.82)' : 'var(--text-tertiary)',
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
                    <span style={{ fontSize: '11px', flexShrink: 0 }}>{entry.rating === 'up' ? '👍' : '👎'}</span>
                  )}
                </div>

                {/* Hover-only delete */}
                <button
                  onClick={(e) => handleEntryDelete(entry.id, e)}
                  style={{
                    position: 'absolute', top: '10px', right: '10px',
                    fontSize: '11px', color: 'var(--text-secondary)',
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
        padding: '12px 18px',
        borderTop: '0.5px solid rgba(var(--ink),0.06)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {activeTab === 'saved' ? `${tabFiltered.length} saved` : footerText}
        </span>
        <button
          onClick={handleClearAll}
          style={{
            fontSize: '11px', color: 'color-mix(in oklab, rgb(255,59,48) var(--accent-text-strength), rgb(var(--ink)))',
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
