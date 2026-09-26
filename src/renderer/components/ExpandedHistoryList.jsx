import { useState, useEffect, useRef } from 'react'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory, pairDictations } from '../utils/history.js'
import { getModeTagStyle, readableColor } from '../utils/promptUtils.js'
import { modeLabel } from '../utils/modes.js'

const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']

const iconBtn = (active) => ({
  width: '28px', height: '28px', borderRadius: '8px', padding: 0, cursor: 'pointer', flexShrink: 0, position: 'relative',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: active ? 'rgba(10,132,255,0.12)' : 'rgba(var(--ink),0.05)',
  border: active ? '0.5px solid rgba(10,132,255,0.35)' : '0.5px solid rgba(var(--ink),0.1)',
  color: active ? readableColor('rgba(100,180,255,0.9)') : 'var(--text-secondary)',
})

function Choice({ on, onClick, children }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on}
      onClick={onClick}
      style={{
        height: '28px', padding: '0 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        fontSize: '12px', fontWeight: on ? 600 : 400, whiteSpace: 'nowrap',
        background: on ? 'rgba(10,132,255,0.14)' : 'rgba(var(--ink),0.05)',
        color: on ? readableColor('rgba(100,180,255,0.95)') : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

export default function ExpandedHistoryList({ currentState, selected, onSelect }) {
  const [history, setHistory] = useState(() => getHistory())
  const [hoveredId, setHoveredId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const filterRef = useRef(null)

  // ⌘H (and the menu's History) jump straight to searching your history.
  useEffect(() => {
    const open = () => setSearchOpen(true)
    window.addEventListener('promptly:search-history', open)
    return () => window.removeEventListener('promptly:search-history', open)
  }, [])

  // Refresh the list when a new result arrives.
  useEffect(() => {
    setHistory(query ? searchHistory(query) : getHistory())
  }, [currentState])

  // Keep bookmark/rating marks in step with the detail panel.
  useEffect(() => {
    if (!selected) return
    setHistory((prev) => prev.map((e) => (e.id === selected.id ? { ...e, bookmarked: selected.bookmarked, rating: selected.rating, ratingTag: selected.ratingTag } : e)))
  }, [selected])

  // The filter menu closes on a click outside it or Escape.
  useEffect(() => {
    if (!filterOpen) return undefined
    const onDown = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey) }
  }, [filterOpen])

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
    setFilterOpen(false)
    onSelect(null)
  }

  function handleEntryDelete(entry, e) {
    e.stopPropagation()
    deleteHistoryItem(entry.id)
    if (entry.fromDictation) deleteHistoryItem(entry.fromDictation)
    const updated = getHistory()
    setHistory(query ? searchHistory(query) : updated)
    if (selected?.id === entry.id) onSelect(null)
  }

  const tabFiltered = activeTab === 'saved' ? history.filter((e) => e.bookmarked) : history
  const filteredEntries = pairDictations(tabFiltered.filter((e) => {
    if (activeFilter === 'up') return e.rating === 'up'
    if (activeFilter === 'down') return e.rating === 'down'
    if (activeFilter === 'unrated') return !e.rating
    return true
  }))
  const filtered = activeTab !== 'all' || activeFilter !== 'all'

  return (
    <div style={{ width: '260px', flexShrink: 0, borderRight: '0.5px solid rgba(var(--ink),0.08)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header: one row */}
      <div style={{ padding: '14px 16px 12px 18px', flexShrink: 0, borderBottom: '0.5px solid rgba(var(--ink),0.08)', position: 'relative' }}>
        {searchOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', height: '28px', background: 'rgba(var(--ink),0.07)', border: '0.5px solid rgba(10,132,255,0.35)', borderRadius: '8px', padding: '0 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(100,180,255,0.7)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              autoFocus
              value={query}
              onChange={handleSearch}
              placeholder="Search history"
              aria-label="Search history"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'rgba(var(--ink),0.95)', fontFamily: 'inherit' }}
            />
            <button type="button" onClick={handleClearSearch} aria-label="Close search" style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em', color: 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              History
              <span style={{ fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontWeight: 500, letterSpacing: 0, marginLeft: '8px' }}>{history.length}</span>
            </span>
            <div style={{ display: 'flex', gap: '6px' }} ref={filterRef}>
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search history" style={iconBtn(false)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </button>
              <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-label="Filter history" aria-haspopup="menu" aria-expanded={filterOpen} style={iconBtn(filtered || filterOpen)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              </button>
              {filterOpen && (
                <div role="menu" aria-label="Filter history" style={{
                  position: 'absolute', zIndex: 30, top: '44px', left: '12px', width: '236px', boxSizing: 'border-box',
                  padding: '12px', borderRadius: '12px', background: 'var(--surface-raised)', boxShadow: 'var(--popover-shadow)',
                  display: 'flex', flexDirection: 'column', gap: '12px',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Show</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Choice on={activeTab === 'all'} onClick={() => setActiveTab('all')}>All</Choice>
                      <Choice on={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>Saved</Choice>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Rating</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Choice on={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>Any</Choice>
                      <Choice on={activeFilter === 'up'} onClick={() => setActiveFilter('up')}>👍</Choice>
                      <Choice on={activeFilter === 'down'} onClick={() => setActiveFilter('down')}>👎</Choice>
                      <Choice on={activeFilter === 'unrated'} onClick={() => setActiveFilter('unrated')}>Unrated</Choice>
                    </div>
                  </div>
                  <div style={{ height: '0.5px', background: 'rgba(var(--ink),0.1)' }} />
                  <button type="button" role="menuitem" onClick={handleClearAll} style={{ alignSelf: 'flex-start', fontSize: '12px', color: 'color-mix(in oklab, rgb(255,59,48) var(--accent-text-strength), rgb(var(--ink)))', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 0' }}>
                    Clear history
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Entries */}
      {/* Behind an open filter menu, the list can't be clicked or tabbed into. */}
      <div inert={filterOpen ? true : undefined} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filteredEntries.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 16px' }}>
            {activeFilter !== 'all' ? 'No prompts match this filter'
              : activeTab === 'saved' ? 'No saved prompts yet'
              : query ? 'No results found'
              : 'No history yet'}
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isActive = selected?.id === entry.id
            const isEntryPolish = entry.mode === 'polish'
            const ts = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            const tagStyle = getModeTagStyle(entry.mode)
            const ratingTagStyle = entry.ratingTag
              ? POSITIVE_TAGS.includes(entry.ratingTag)
                ? { bg: 'rgba(48,209,88,0.10)', border: 'rgba(48,209,88,0.25)', color: 'color-mix(in oklab, rgb(100,220,130) var(--accent-text-strength), rgb(var(--ink)))' }
                : { bg: 'rgba(255,59,48,0.09)', border: 'rgba(255,59,48,0.25)', color: 'color-mix(in oklab, rgb(255,100,90) var(--accent-text-strength), rgb(var(--ink)))' }
              : null
            const hovered = hoveredId === entry.id
            return (
              <div
                key={entry.id}
                data-history-entry
                onClick={() => onSelect(entry)}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: '11px 18px 11px 16px',
                  borderBottom: '0.5px solid rgba(var(--ink),0.05)',
                  borderLeft: isActive ? (isEntryPolish ? '2px solid rgba(48,209,88,0.55)' : '2px solid rgba(10,132,255,0.6)') : '2px solid transparent',
                  background: isActive ? (isEntryPolish ? 'rgba(48,209,88,0.08)' : 'rgba(10,132,255,0.1)') : hovered ? 'rgba(var(--ink),0.03)' : 'transparent',
                  cursor: 'pointer', position: 'relative', transition: 'background 100ms',
                  animation: 'history-in 380ms cubic-bezier(0.32, 0.72, 0, 1) both',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'SF Mono', ui-monospace, Menlo, monospace", fontSize: '11px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {ts}
                    {entry.isIteration && <span style={{ color: 'color-mix(in oklab, rgb(10,132,255) var(--accent-text-strength), rgb(var(--ink)))' }}>↻</span>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: hovered ? 0 : 1, transition: 'opacity 120ms' }}>
                    {ratingTagStyle && (
                      <span style={{ fontSize: '11px', fontWeight: 500, padding: '1px 6px', borderRadius: '4px', background: ratingTagStyle.bg, border: `0.5px solid ${ratingTagStyle.border}`, color: readableColor(ratingTagStyle.color) }}>
                        {entry.ratingTag}
                      </span>
                    )}
                    {entry.fromDictation && (
                      <span title="Made from a dictation" aria-label="Made from a dictation" style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(var(--ink),0.07)', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: '5px', background: tagStyle.background, color: readableColor(tagStyle.color), whiteSpace: 'nowrap' }}>
                      {modeLabel(entry.mode) || entry.mode}
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                  <span style={{ fontSize: '13px', color: isActive ? 'rgba(var(--ink),0.92)' : 'var(--text-secondary)', fontWeight: isActive ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {entry.title || entry.transcript}
                  </span>
                  {entry.bookmarked && (
                    <svg width="8" height="10" viewBox="0 0 10 13" fill="rgba(255,189,46,0.8)" style={{ flexShrink: 0 }} aria-label="Saved">
                      <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke="rgba(255,189,46,0.8)" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                  )}
                  {entry.rating && <span style={{ fontSize: '11px', flexShrink: 0 }}>{entry.rating === 'up' ? '👍' : '👎'}</span>}
                </div>

                {/* Delete: shown on hover, in the badge's place. */}
                <button
                  type="button"
                  onClick={(e) => handleEntryDelete(entry, e)}
                  aria-label="Delete from history"
                  tabIndex={hovered ? 0 : -1}
                  style={{
                    position: 'absolute', top: '9px', right: '14px', height: '22px', padding: '0 8px', borderRadius: '6px',
                    fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(var(--ink),0.07)', border: 'none', cursor: 'pointer',
                    opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'auto' : 'none', transition: 'opacity 120ms', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
