import { useState } from 'react'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory, bookmarkHistoryItem, rateHistoryItem } from '../utils/history'
import HistoryEntryItem from './HistoryEntryItem.jsx'
import HistoryDetailPanel from './HistoryDetailPanel.jsx'

const FILTER_CHIP_COLORS = {
  all:     { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' },
  up:      { bg:'rgba(48,209,88,0.10)',   border:'rgba(48,209,88,0.25)',   text:'rgba(100,220,130,0.8)' },
  down:    { bg:'rgba(255,59,48,0.10)',   border:'rgba(255,59,48,0.25)',   text:'rgba(255,100,90,0.75)' },
  unrated: { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' }
}
const FILTER_CHIP_INACTIVE = { bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.08)', text:'rgba(255,255,255,0.3)' }

export default function HistoryPanel({ onClose, onReuse }) {
  const [entries, setEntries] = useState(() => {
    const h = getHistory()
    return h
  })
  const [selected, setSelected] = useState(() => {
    const h = getHistory()
    return h.length > 0 ? h[0] : null
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clearHovered, setClearHovered] = useState(false)
  const [doneHovered, setDoneHovered] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [hoveredEntry, setHoveredEntry] = useState(null)

  function handleSearch(e) {
    setQuery(e.target.value)
    setEntries(searchHistory(e.target.value))
  }

  function handleClearSearch() {
    setQuery('')
    setSearchOpen(false)
    setEntries(getHistory())
  }

  function handleDelete(id) {
    deleteHistoryItem(id)
    const updated = getHistory()
    setEntries(query ? searchHistory(query) : updated)
    if (selected?.id === id) setSelected(updated[0] || null)
  }

  function handleClearAll() {
    clearHistory()
    setEntries([])
    setSelected(null)
  }

  function handleCopy() {
    if (!selected) return
    if (window.electronAPI) window.electronAPI.copyToClipboard(selected.prompt)
  }

  function handleRate(rating) {
    if (!selected) return
    const newRating = selected.rating === rating ? null : rating
    const newTag = null
    rateHistoryItem(selected.id, newRating, newTag)
    const updated = { ...selected, rating: newRating, ratingTag: newTag }
    setSelected(updated)
    setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  function handleTag(tag) {
    if (!selected || !selected.rating) return
    const newTag = selected.ratingTag === tag ? null : tag
    rateHistoryItem(selected.id, selected.rating, newTag)
    const updated = { ...selected, ratingTag: newTag }
    setSelected(updated)
    setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  function handleBookmark() {
    if (!selected) return
    const newBookmarked = bookmarkHistoryItem(selected.id)
    const updated = { ...selected, bookmarked: newBookmarked }
    setSelected(updated)
    setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  const tabFiltered = activeTab === 'saved'
    ? entries.filter(e => e.bookmarked)
    : entries

  const savedCount = entries.filter(e => e.bookmarked).length
  const footerText = savedCount > 0
    ? `${entries.length} prompt${entries.length !== 1 ? 's' : ''} · ${savedCount} saved`
    : `${entries.length} prompt${entries.length !== 1 ? 's' : ''}`

  const allHistory = getHistory()
  const statsRated = allHistory.reduce((acc, e) => {
    if (e.rating) { acc.total++; if (e.rating === 'up') acc.up++ }
    return acc
  }, { total: 0, up: 0 })
  const upPct = statsRated.total > 0 ? Math.round(statsRated.up / statsRated.total * 100) : 0
  const downPct = 100 - upPct

  const filteredEntries = tabFiltered.filter(e => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'up') return e.rating === 'up'
    if (activeFilter === 'down') return e.rating === 'down'
    if (activeFilter === 'unrated') return !e.rating
    return true
  })

  return (
    <div style={{
      position:'relative', zIndex:1,
      display:'flex', flexDirection:'column',
      height:'100%', overflow:'hidden'
    }}>

      {/* SPLIT BODY */}
      <div style={{display:'flex', flex:1, overflow:'hidden', minHeight:0}}>

        {/* LEFT PANEL */}
        <div style={{
          width:'240px', flexShrink:0,
          borderRight:'0.5px solid rgba(255,255,255,0.07)',
          display:'flex', flexDirection:'column',
          overflow:'hidden'
        }}>

          {/* Left header */}
          <div style={{padding:'16px 16px 12px', flexShrink:0}}>
            {searchOpen ? (
              <div style={{
                display:'flex', alignItems:'center', gap:'8px',
                height:'34px', background:'rgba(255,255,255,0.07)',
                border:'0.5px solid rgba(10,132,255,0.35)',
                borderRadius:'9px', padding:'0 12px'
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="rgba(100,180,255,0.6)" strokeWidth="1.2"/>
                  <path d="M8.5 8.5L11 11" stroke="rgba(100,180,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  autoFocus
                  value={query}
                  onChange={handleSearch}
                  placeholder="Search prompts..."
                  style={{
                    flex:1, background:'transparent', border:'none',
                    outline:'none', fontSize:'12px',
                    color:'rgba(255,255,255,0.8)', fontFamily:'inherit'
                  }}
                />
                {/* POLISH-009: 0.30 → 0.60 */}
                <button onClick={handleClearSearch} style={{
                  fontSize:'11px', color:'rgba(255,255,255,0.60)',
                  background:'none', border:'none', cursor:'pointer', padding:0
                }}>✕</button>
              </div>
            ) : (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                {/* 0.55 stays above threshold */}
                <span style={{fontSize:'12px', fontWeight:500, color:'rgba(255,255,255,0.55)'}}>
                  Recent
                </span>
                <button
                  onClick={() => setSearchOpen(true)}
                  style={{
                    width:'28px', height:'28px', borderRadius:'7px',
                    background:'rgba(255,255,255,0.06)',
                    border:'0.5px solid rgba(255,255,255,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer'
                  }}>
                  {/* POLISH-009: stroke 0.40 → 0.70 */}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="5" cy="5" r="4" stroke="rgba(255,255,255,0.70)" strokeWidth="1.2"/>
                    <path d="M8.5 8.5L11 11" stroke="rgba(255,255,255,0.70)" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Tab switcher */}
          <div style={{display:'flex', padding:'12px 12px 0', gap:'4px'}}>
            {['all', 'saved'].map(tab => {
              const isActive = activeTab === tab
              const isSaved = tab === 'saved'
              return (
                <div
                  key={tab}
                  onClick={() => { setActiveTab(tab); setActiveFilter('all') }}
                  style={{
                    flex:1, height:'28px', borderRadius:'8px', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'4px',
                    background: isActive
                      ? (isSaved ? 'rgba(255,189,46,0.12)' : 'rgba(10,132,255,0.12)')
                      : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${isActive
                      ? (isSaved ? 'rgba(255,189,46,0.28)' : 'rgba(10,132,255,0.25)')
                      : 'rgba(255,255,255,0.08)'}`
                  }}>
                  {isSaved && (
                    <svg width="10" height="12" viewBox="0 0 10 13" fill="none">
                      <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                        fill={isActive ? 'rgba(255,189,46,0.85)' : 'none'}
                        stroke={isActive ? 'rgba(255,189,46,0.85)' : 'rgba(255,255,255,0.3)'}
                        strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                  )}
                  <span style={{
                    fontSize:'11px',
                    fontWeight: isActive ? 500 : 400,
                    color: isActive
                      ? (isSaved ? 'rgba(255,189,46,0.9)' : 'rgba(100,180,255,0.9)')
                      : 'rgba(255,255,255,0.35)'
                  }}>
                    {tab === 'all' ? 'All' : 'Saved'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Filter chips */}
          <div style={{display:'flex', gap:'4px', padding:'10px 12px', flexWrap:'wrap'}}>
            {[
              { id: 'all', label: 'All' },
              { id: 'up', label: '👍' },
              { id: 'down', label: '👎' },
              { id: 'unrated', label: 'Unrated' }
            ].map(f => {
              const isActive = activeFilter === f.id
              const c = isActive ? FILTER_CHIP_COLORS[f.id] : FILTER_CHIP_INACTIVE
              return (
                <span key={f.id} onClick={() => setActiveFilter(f.id)} style={{
                  padding:'2px 8px', borderRadius:'20px', fontSize:'9px',
                  fontWeight:600, cursor:'pointer',
                  background:c.bg, border:`0.5px solid ${c.border}`, color:c.text
                }}>
                  {f.label}
                </span>
              )
            })}
          </div>

          {/* Stats bar */}
          {activeTab === 'all' && (
            <div style={{
              margin:'0 12px 10px', padding:'8px 10px',
              background:'rgba(255,255,255,0.03)',
              border:'0.5px solid rgba(255,255,255,0.06)',
              borderRadius:'8px', display:'flex',
              justifyContent:'space-between', alignItems:'center'
            }}>
              <span style={{fontSize:'10px', color:'rgba(255,255,255,0.3)'}}>
                {allHistory.length} prompt{allHistory.length !== 1 ? 's' : ''}
              </span>
              {statsRated.total > 0 && (
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <span style={{fontSize:'10px', color:'rgba(100,220,130,0.7)'}}>👍 {upPct}%</span>
                  <div style={{width:'0.5px', height:'10px', background:'rgba(255,255,255,0.1)'}}/>
                  <span style={{fontSize:'10px', color:'rgba(255,100,90,0.65)'}}>👎 {downPct}%</span>
                </div>
              )}
            </div>
          )}

          {/* Entry list */}
          <div style={{flex:1, overflowY:'auto', minHeight:0}}>
            {filteredEntries.length === 0 && (
              <div style={{
                padding:'40px 20px', textAlign:'center',
                fontSize:'12px', color:'rgba(255,255,255,0.55)'
              }}>
                {activeFilter !== 'all' ? 'No prompts match this filter' : activeTab === 'saved' ? 'No saved prompts yet' : (query ? 'No results found' : 'No history yet')}
              </div>
            )}
            {filteredEntries.map(entry => (
              <HistoryEntryItem
                key={entry.id}
                entry={entry}
                isSelected={selected?.id === entry.id}
                isHovered={hoveredEntry === entry.id}
                onSelect={setSelected}
                onHoverEnter={setHoveredEntry}
                onHoverLeave={() => setHoveredEntry(null)}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Count footer */}
          <div style={{
            padding:'12px 16px',
            borderTop:'0.5px solid rgba(255,255,255,0.06)',
            flexShrink:0
          }}>
            <span style={{fontSize:'10px', color:'rgba(255,255,255,0.45)'}}>
              {activeTab === 'saved'
                ? `${tabFiltered.length} saved prompt${tabFiltered.length !== 1 ? 's' : ''}`
                : footerText}
            </span>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          overflow:'hidden', minWidth:0, minHeight:0
        }}>
          <HistoryDetailPanel
            selected={selected}
            onCopy={handleCopy}
            onReuse={() => onReuse(selected)}
            onBookmark={handleBookmark}
            onRate={handleRate}
            onTag={handleTag}
          />
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'12px 20px',
        borderTop:'0.5px solid rgba(255,255,255,0.06)',
        flexShrink:0
      }}>
        {/* POLISH-004: Clear all hover */}
        <button
          onClick={handleClearAll}
          onMouseEnter={() => setClearHovered(true)}
          onMouseLeave={() => setClearHovered(false)}
          style={{
            fontSize:'12px',
            color: clearHovered ? 'rgba(255,59,48,0.75)' : 'rgba(255,59,48,0.55)',
            background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
            transition: 'color 120ms ease',
          }}
        >
          Clear all
        </button>
        {/* POLISH-004: Done button hover; POLISH-009: 0.40 → 0.70 */}
        <button
          onClick={onClose}
          onMouseEnter={() => setDoneHovered(true)}
          onMouseLeave={() => setDoneHovered(false)}
          style={{
            fontSize:'12px',
            color: doneHovered ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.70)',
            background:'none', border:'none', cursor:'pointer', fontFamily:'inherit',
            transition: 'color 120ms ease',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
