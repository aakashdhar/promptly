import { useState } from 'react'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory, formatTime, bookmarkHistoryItem } from '../utils/history'

function renderPromptSections(prompt) {
  if (!prompt) return null
  const lines = prompt.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const isLabel = /^[A-Z][A-Z\s\/]+:/.test(line)
    if (isLabel) {
      elements.push(
        <div key={`label-${i}`} style={{
          fontSize:'10px', fontWeight:700, letterSpacing:'.12em',
          textTransform:'uppercase',
          // POLISH-009 blue: 0.7 stays above threshold
          color:'rgba(100,170,255,0.7)',
          marginBottom:'6px', marginTop: elements.length ? '18px' : 0,
          display:'block'
        }}>
          {line.replace(':','').trim()}
        </div>
      )
    } else {
      elements.push(
        <div key={`text-${i}`} style={{
          fontSize:'13.5px', color:'rgba(255,255,255,0.88)',
          lineHeight:1.75, marginBottom:'4px'
        }}>
          {line}
        </div>
      )
    }
    i++
  }
  return elements
}

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
  const [copied, setCopied] = useState(false)
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

  function handleDelete(id, e) {
    e.stopPropagation()
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
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleBookmark() {
    if (!selected) return
    bookmarkHistoryItem(selected.id)
    const updated = { ...selected, bookmarked: !selected.bookmarked }
    setSelected(updated)
    setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  const tabFiltered = activeTab === 'saved'
    ? entries.filter(e => e.bookmarked)
    : entries

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
              const colors = {
                all:     { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' },
                up:      { bg:'rgba(48,209,88,0.10)',   border:'rgba(48,209,88,0.25)',   text:'rgba(100,220,130,0.8)' },
                down:    { bg:'rgba(255,59,48,0.10)',   border:'rgba(255,59,48,0.25)',   text:'rgba(255,100,90,0.75)' },
                unrated: { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' }
              }
              const inactive = { bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.08)', text:'rgba(255,255,255,0.3)' }
              const c = isActive ? colors[f.id] : inactive
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
          {activeTab === 'all' && (() => {
            const allHistory = getHistory()
            const ratedEntries = allHistory.filter(e => e.rating)
            const upCount = allHistory.filter(e => e.rating === 'up').length
            const upPct = ratedEntries.length > 0 ? Math.round(upCount / ratedEntries.length * 100) : 0
            const downPct = 100 - upPct
            return (
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
                {ratedEntries.length > 0 && (
                  <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                    <span style={{fontSize:'10px', color:'rgba(100,220,130,0.7)'}}>👍 {upPct}%</span>
                    <div style={{width:'0.5px', height:'10px', background:'rgba(255,255,255,0.1)'}}/>
                    <span style={{fontSize:'10px', color:'rgba(255,100,90,0.65)'}}>👎 {downPct}%</span>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Entry list */}
          <div style={{flex:1, overflowY:'auto', minHeight:0}}>
            {filteredEntries.length === 0 && (
              <div style={{
                padding:'40px 20px', textAlign:'center',
                fontSize:'12px', color:'rgba(255,255,255,0.55)'
              }}>
                {activeTab === 'saved' ? 'No saved prompts yet' : (query ? 'No results found' : 'No history yet')}
              </div>
            )}
            {filteredEntries.map(entry => {
              const isSelected = selected?.id === entry.id
              const isPolish = entry.mode === 'polish'
              return (
                <div
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  onMouseEnter={() => setHoveredEntry(entry.id)}
                  onMouseLeave={() => setHoveredEntry(null)}
                  style={{
                    padding:'12px 16px',
                    borderBottom:'0.5px solid rgba(255,255,255,0.05)',
                    borderLeft: isSelected
                      ? isPolish ? '2px solid rgba(48,209,88,0.5)' : '2px solid rgba(10,132,255,0.6)'
                      : '2px solid transparent',
                    background: isSelected
                      ? isPolish ? 'rgba(48,209,88,0.07)' : 'rgba(10,132,255,0.09)'
                      : 'transparent',
                    cursor:'pointer',
                    transition:'all 150ms',
                    position:'relative'
                  }}>
                  {/* Title */}
                  <div style={{
                    fontSize:'12px',
                    fontWeight: isSelected ? 500 : 400,
                    color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)',
                    marginBottom:'6px',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    paddingRight:'20px'
                  }}>
                    {entry.title || entry.transcript?.split(' ').slice(0,6).join(' ')}
                  </div>
                  {/* Meta row */}
                  <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                    <span style={{
                      fontSize:'10px', fontWeight:600, letterSpacing:'.06em',
                      textTransform:'uppercase', padding:'2px 7px',
                      borderRadius:'20px',
                      background: isSelected
                        ? isPolish ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.15)'
                        : 'rgba(255,255,255,0.07)',
                      color: isSelected
                        ? isPolish ? 'rgba(100,220,130,0.85)' : 'rgba(100,180,255,0.85)'
                        : 'rgba(255,255,255,0.70)'
                    }}>
                      {entry.mode}
                    </span>
                    {entry.isIteration && (
                      <span style={{fontSize:'9px', color:'rgba(10,132,255,0.72)', marginLeft:'4px'}}>↻</span>
                    )}
                    {/* POLISH-009: 0.28 → 0.58 */}
                    <span style={{fontSize:'10px', color:'rgba(255,255,255,0.58)'}}>
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  {/* Delete button — hover only */}
                  <button
                    onClick={(e) => handleDelete(entry.id, e)}
                    style={{
                      position:'absolute', top:'12px', right:'12px',
                      fontSize:'11px', color:'rgba(255,255,255,0.50)',
                      background:'none', border:'none', cursor:'pointer', padding:0,
                      lineHeight:1,
                      opacity: hoveredEntry === entry.id ? 1 : 0,
                      transition:'opacity 120ms ease'
                    }}>
                    ✕
                  </button>
                  {/* Bookmark/rating indicator — shows when not hovering */}
                  {(entry.bookmarked || entry.rating) && hoveredEntry !== entry.id && (
                    <div style={{
                      position:'absolute', top:'10px', right:'12px',
                      display:'flex', gap:'4px', alignItems:'center'
                    }}>
                      {entry.bookmarked && (
                        <svg width="9" height="11" viewBox="0 0 10 13" fill="rgba(255,189,46,0.8)">
                          <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke="rgba(255,189,46,0.8)" strokeWidth="1.2" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {entry.rating && (
                        <span style={{fontSize:'10px'}}>
                          {entry.rating === 'up' ? '👍' : '👎'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Count footer */}
          <div style={{
            padding:'12px 16px',
            borderTop:'0.5px solid rgba(255,255,255,0.06)',
            flexShrink:0
          }}>
            {/* POLISH-009: 0.25 → 0.55 */}
            <span style={{fontSize:'11px', color:'rgba(255,255,255,0.55)'}}>
              {entries.length} prompt{entries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          overflow:'hidden', minWidth:0, minHeight:0
        }}>
          {!selected ? (
            <div style={{
              flex:1, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:'13px',
              // POLISH-009: 0.25 → 0.55
              color:'rgba(255,255,255,0.55)'
            }}>
              Select a prompt to view
            </div>
          ) : (
            <>
              {/* You said */}
              <div style={{padding:'20px 24px 16px', flexShrink:0}}>
                {/* POLISH-009: 0.30 → 0.60 */}
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  marginBottom:'8px'
                }}>
                  <div style={{
                    fontSize:'10px', fontWeight:700, letterSpacing:'.12em',
                    textTransform:'uppercase', color:'rgba(255,255,255,0.60)'
                  }}>
                    You said
                  </div>
                  <button onClick={handleBookmark} style={{
                    display:'flex', alignItems:'center', gap:'5px',
                    padding:'3px 8px', borderRadius:'6px', cursor:'pointer',
                    fontFamily:'inherit',
                    background: selected.bookmarked ? 'rgba(255,189,46,0.10)' : 'rgba(255,255,255,0.04)',
                    border: `0.5px solid ${selected.bookmarked ? 'rgba(255,189,46,0.25)' : 'rgba(255,255,255,0.08)'}`
                  }}>
                    <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                      <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                        fill={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'none'}
                        stroke={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.3)'}
                        strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                    <span style={{
                      fontSize:'10px', fontWeight: selected.bookmarked ? 500 : 400,
                      color: selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.35)'
                    }}>
                      {selected.bookmarked ? 'Saved' : 'Save'}
                    </span>
                  </button>
                </div>
                {/* 0.60 stays above threshold */}
                <div style={{
                  fontSize:'13px', color:'rgba(255,255,255,0.70)',
                  lineHeight:1.65
                }}>
                  {selected.transcript}
                </div>
              </div>

              {/* Divider */}
              <div style={{
                height:'0.5px',
                background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)',
                margin:'0 24px 16px', flexShrink:0
              }}/>

              {/* Prompt content */}
              <div style={{
                flex:1, overflowY:'auto', padding:'0 24px',
                minHeight:0
              }}>
                {renderPromptSections(selected.prompt)}
                {selected.polishChanges && selected.polishChanges.length > 0 && (
                  <div style={{margin:'12px 0 20px', padding:'10px 12px', background:'rgba(48,209,88,0.04)', border:'0.5px solid rgba(48,209,88,0.12)', borderRadius:'10px'}}>
                    <div style={{fontSize:'9px', fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(48,209,88,0.5)', marginBottom:'6px'}}>Changes made</div>
                    {selected.polishChanges.map((note, i) => (
                      <div key={i} style={{fontSize:'11.5px', color:'rgba(255,255,255,0.45)', lineHeight:1.5}}>{note}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{
                display:'flex', gap:'10px',
                padding:'16px 24px 20px',
                borderTop:'0.5px solid rgba(255,255,255,0.06)',
                marginTop:'8px', flexShrink:0
              }}>
                <button
                  onClick={handleCopy}
                  style={{
                    flex:1, height:'38px', borderRadius:'10px',
                    fontSize:'13px', fontFamily:'inherit', cursor:'pointer',
                    background: copied ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
                    border: copied ? '0.5px solid rgba(48,209,88,0.3)' : '0.5px solid rgba(255,255,255,0.12)',
                    color: copied ? 'rgba(48,209,88,0.9)' : 'rgba(255,255,255,0.72)',
                    transition:'all 200ms'
                  }}>
                  {copied ? 'Copied ✓' : 'Copy prompt'}
                </button>
                <button
                  onClick={() => onReuse(selected)}
                  style={{
                    flex:1, height:'38px', borderRadius:'10px',
                    fontSize:'13px', fontWeight:600, fontFamily:'inherit',
                    cursor:'pointer',
                    background:'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))',
                    border:'none', color:'white',
                    boxShadow:'0 2px 14px rgba(10,132,255,0.35)'
                  }}>
                  Reuse
                </button>
              </div>
            </>
          )}
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
