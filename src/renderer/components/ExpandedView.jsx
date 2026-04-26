import { useState, useEffect, useRef } from 'react'
import WaveformCanvas from './WaveformCanvas.jsx'
import MorphCanvas from './MorphCanvas.jsx'
import { getHistory, deleteHistoryItem, clearHistory, searchHistory, bookmarkHistoryItem, rateHistoryItem, formatTime } from '../utils/history.js'

const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',
}

const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
const ALL_TAGS = ['Perfect', 'Clear', 'Detailed', 'Too long']

function parseSections(text) {
  if (!text) return []
  const lines = text.split('\n')
  const sections = []
  let current = null
  let bodyLines = []

  function flush() {
    if (current !== null) {
      sections.push({ label: current, body: bodyLines.join('\n').trim() })
      bodyLines = []
      current = null
    }
  }

  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      current = m[1].trim()
    } else {
      bodyLines.push(line)
    }
  }
  flush()

  if (sections.length === 0 && text.trim()) {
    sections.push({ label: null, body: text.trim() })
  }
  return sections
}

function renderPromptSections(prompt, labelColor) {
  if (!prompt) return null
  const lines = prompt.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }
    const isLabel = /^[A-Z][A-Z\s/]+:/.test(line)
    if (isLabel) {
      elements.push(
        <div key={`label-${i}`} style={{
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: labelColor || 'rgba(100,170,255,0.7)',
          marginBottom: '6px', marginTop: elements.length ? '18px' : 0,
          display: 'block',
        }}>
          {line.replace(':', '').trim()}
        </div>
      )
    } else {
      elements.push(
        <div key={`text-${i}`} style={{
          fontSize: '14px', color: 'rgba(255,255,255,0.82)',
          lineHeight: 1.8, marginBottom: '4px',
        }}>
          {line}
        </div>
      )
    }
    i++
  }
  return elements
}

function getModeTagStyle(mode) {
  if (mode === 'polish') return { background: 'rgba(48,209,88,0.08)', color: 'rgba(100,220,130,0.6)' }
  if (mode === 'refine') return { background: 'rgba(168,85,247,0.1)', color: 'rgba(200,150,255,0.65)' }
  return { background: 'rgba(10,132,255,0.1)', color: 'rgba(100,170,255,0.65)' }
}

export default function ExpandedView({
  currentState,
  mode,
  modeLabel,
  duration,
  generatedPrompt,
  originalTranscript,
  thinkTranscript,
  onStart,
  onCollapse,
  onPause,
  onStop,
  onRegenerate,
  onReset,
  onIterate,
  isIterated,
  setGeneratedPrompt,
  isPolishMode,
  polishResult,
  polishTone,
  onPolishToneChange,
  onPolishCopy,
  polishCopied,
  onReuse,
}) {
  const [history, setHistory] = useState(() => getHistory())
  const [selected, setSelected] = useState(() => { const h = getHistory(); return h.length > 0 ? h[0] : null })
  const [hoveredId, setHoveredId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [entryCopied, setEntryCopied] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editHovered, setEditHovered] = useState(false)
  const [isViewingHistory, setIsViewingHistory] = useState(false)
  const promptRef = useRef(null)
  const preEditValue = useRef('')

  // Refresh history list when state changes (new entries arrive after PROMPT_READY)
  useEffect(() => {
    const h = getHistory()
    setHistory(h)
    // When a new prompt arrives or recording starts, return right panel to current state content
    if (currentState === STATES.RECORDING || currentState === STATES.THINKING || currentState === STATES.PROMPT_READY) {
      setIsViewingHistory(false)
    }
  }, [currentState])

  useEffect(() => {
    if (currentState === STATES.PROMPT_READY) {
      setIsEditing(false)
      setIsCopied(false)
    }
  }, [currentState])

  useEffect(() => {
    if (isEditing && promptRef.current) {
      promptRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(promptRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [isEditing])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && isEditing) {
        if (promptRef.current) promptRef.current.textContent = preEditValue.current
        setIsEditing(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditing])

  // ── history entry handlers ──

  function handleEntrySelect(entry) {
    setSelected(entry)
    setEntryCopied(false)
    setIsViewingHistory(true)
  }

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
    setSelected(null)
  }

  function handleEntryDelete(id, e) {
    e.stopPropagation()
    deleteHistoryItem(id)
    const updated = getHistory()
    setHistory(query ? searchHistory(query) : updated)
    if (selected?.id === id) setSelected(updated[0] || null)
  }

  function handleEntryCopy() {
    if (!selected) return
    if (window.electronAPI) window.electronAPI.copyToClipboard(selected.prompt)
    setEntryCopied(true)
    setTimeout(() => setEntryCopied(false), 1800)
  }

  function handleEntryReuse() {
    if (!selected || !onReuse) return
    onReuse(selected)
  }

  function handleBookmark() {
    if (!selected) return
    const newBookmarked = bookmarkHistoryItem(selected.id)
    const updated = { ...selected, bookmarked: newBookmarked }
    setSelected(updated)
    setHistory(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  function handleRate(rating) {
    if (!selected) return
    const newRating = selected.rating === rating ? null : rating
    rateHistoryItem(selected.id, newRating, null)
    const updated = { ...selected, rating: newRating, ratingTag: null }
    setSelected(updated)
    setHistory(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  function handleTag(tag) {
    if (!selected || !selected.rating) return
    const newTag = selected.ratingTag === tag ? null : tag
    rateHistoryItem(selected.id, selected.rating, newTag)
    const updated = { ...selected, ratingTag: newTag }
    setSelected(updated)
    setHistory(prev => prev.map(e => e.id === selected.id ? updated : e))
  }

  // ── prompt ready handlers ──

  function handleCopy() {
    const text = isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt
    if (window.electronAPI) window.electronAPI.copyToClipboard(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 1800)
  }

  function handleEdit() {
    if (!isEditing) {
      preEditValue.current = generatedPrompt
      setIsEditing(true)
    } else {
      if (promptRef.current) setGeneratedPrompt(promptRef.current.textContent)
      setIsEditing(false)
    }
  }

  // ── derived state ──

  const isRecording = currentState === STATES.RECORDING
  const isThinking = currentState === STATES.THINKING
  const showEntryDetail = (currentState === STATES.IDLE || isViewingHistory) && selected !== null

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

  const isRefine = mode === 'refine'
  const isPolish = mode === 'polish'
  const pillBg = isPolish ? 'rgba(48,209,88,0.12)' : isRefine ? 'rgba(168,85,247,0.12)' : 'rgba(10,132,255,0.12)'
  const pillBorder = isPolish ? '0.5px solid rgba(48,209,88,0.3)' : isRefine ? '0.5px solid rgba(168,85,247,0.3)' : '0.5px solid rgba(10,132,255,0.25)'
  const pillColor = isPolish ? 'rgba(100,220,130,0.9)' : isRefine ? 'rgba(200,160,255,1.0)' : 'rgba(100,180,255,0.85)'

  const sections = parseSections(generatedPrompt)
  const mid = Math.ceil(sections.length / 2)
  const leftSections = sections.slice(0, mid)
  const rightSections = sections.slice(mid)
  const labelColor = isRefine ? 'rgba(168,85,247,0.85)' : 'rgba(100,170,255,0.55)'

  const pauseBtnBg = isRecording ? 'rgba(255,189,46,0.12)' : 'rgba(255,255,255,0.06)'
  const pauseBtnBorder = isRecording ? '0.5px solid rgba(255,189,46,0.3)' : '0.5px solid rgba(255,255,255,0.1)'
  const pauseBtnAnim = isRecording ? 'pauseGlow 2s ease-in-out infinite' : 'none'
  const pauseIconFill = isRecording ? 'rgba(255,189,46,0.9)' : 'rgba(255,255,255,0.5)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0e0e0f', position: 'relative' }}>

      {/* ── ZONE 1: TOP BAR ── */}
      <div style={{
        background: '#111113',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        position: 'relative',
      }}>

        {/* Collapse button — absolutely positioned, does not affect transport layout */}
        <button
          onClick={onCollapse}
          title="Collapse"
          style={{
            position: 'absolute', top: '16px', right: '18px',
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 20,
            WebkitAppRegion: 'no-drag', padding: 0,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <svg width="13" height="10" viewBox="0 0 14 10" fill="none">
            <rect x="0" y="1" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
            <rect x="0" y="7" width="14" height="2" rx="1" fill="rgba(255,255,255,0.45)" />
          </svg>
        </button>

        {/* Traffic light spacer — drag region */}
        <div style={{ height: '36px', WebkitAppRegion: 'drag' }} />

        {/* Transport row — symmetric flanking */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '0 20px 12px' }}>

          {/* Left flank: pause button + timer */}
          <div style={{ width: '140px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            <div
              onClick={onPause}
              style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: pauseBtnBg,
                border: pauseBtnBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', WebkitAppRegion: 'no-drag',
                animation: pauseBtnAnim,
                transition: 'background 200ms, border 200ms',
              }}
            >
              <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                <rect x="1" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
                <rect x="6" y="1" width="3" height="10" rx="1" fill={pauseIconFill} />
              </svg>
            </div>
            <span style={{
              fontFamily: 'monospace', fontSize: '14px',
              color: 'rgba(255,255,255,0.4)', minWidth: '32px', textAlign: 'right',
              letterSpacing: '0.06em',
              WebkitAppRegion: 'no-drag',
            }}>
              {duration}
            </span>
          </div>

          {/* Centre: mic / stop / thinking button */}
          <div style={{ position: 'relative', flexShrink: 0, WebkitAppRegion: 'no-drag' }}>
            {isRecording && (
              <>
                <div style={{
                  position: 'absolute', inset: '-8px', borderRadius: '50%',
                  border: '1px solid rgba(200,50,35,0.3)',
                  animation: 'pulse-ring 2.2s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  position: 'absolute', inset: '-16px', borderRadius: '50%',
                  border: '1px solid rgba(200,50,35,0.15)',
                  animation: 'pulse-ring 2.2s ease-out infinite 0.7s',
                  pointerEvents: 'none',
                }} />
              </>
            )}
            {isThinking ? (
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
                  style={{ animation: 'spin 1s linear infinite', position: 'absolute' }}>
                  <circle cx="20" cy="20" r="17" stroke="rgba(10,132,255,0.12)" strokeWidth="2" />
                  <path d="M20 3 A17 17 0 0 1 37 20" stroke="rgba(10,132,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                }} />
              </div>
            ) : (
              <div
                onClick={isRecording ? onStop : onStart}
                style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: isRecording ? 'rgba(200,50,35,0.95)' : 'rgba(255,255,255,0.06)',
                  border: isRecording ? 'none' : '0.5px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', position: 'relative',
                  boxShadow: isRecording ? '0 0 24px rgba(200,50,35,0.4)' : 'none',
                  transition: 'background 200ms, box-shadow 200ms',
                  animation: isRecording ? 'stop-glow 2s ease-in-out infinite' : 'none',
                }}
              >
                {!isRecording && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.06)',
                    animation: 'breathe 3s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                )}
                {isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 10 10" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white" />
                  </svg>
                ) : (
                  <svg width="14" height="16" viewBox="0 0 12 16" fill="none">
                    <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
                    <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
                    <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Right flank: mode pill + settings button */}
          <div style={{ width: '140px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px' }}>
            <span
              onClick={() => { if (window.electronAPI) window.electronAPI.showModeMenu(mode) }}
              style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                background: pillBg, border: pillBorder, color: pillColor,
                cursor: 'pointer', WebkitAppRegion: 'no-drag', whiteSpace: 'nowrap',
              }}
            >
              {modeLabel}
            </span>
            <div
              style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', WebkitAppRegion: 'no-drag',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
                <line x1="0" y1="2.5" x2="14" y2="2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeLinecap="round" />
                <circle cx="4" cy="2.5" r="1.5" fill="#111113" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
                <line x1="0" y1="9.5" x2="14" y2="9.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1" strokeLinecap="round" />
                <circle cx="10" cy="9.5" r="1.5" fill="#111113" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Waveform zone — 60% centre, 20% breathing room each side */}
        <div style={{
          height: '44px', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20%', overflow: 'hidden',
        }}>
          {isRecording ? (
            <WaveformCanvas />
          ) : isThinking ? (
            <MorphCanvas />
          ) : (
            <div style={{ height: '1px', width: '100%', background: 'rgba(255,255,255,0.08)' }} />
          )}
        </div>
      </div>

      {/* ── ZONES 2 + 3: BODY ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0 }}>

        {/* ── ZONE 2: LEFT PANEL — session history list ── */}
        <div style={{
          width: '300px', flexShrink: 0,
          background: '#0e0e0f',
          borderRight: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
        }}>

          {/* Header: label or search input */}
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

          {/* Filter chips: All / 👍 / 👎 / Unrated */}
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
                return (
                  <div
                    key={entry.id}
                    onClick={() => handleEntrySelect(entry)}
                    onMouseEnter={() => setHoveredId(entry.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: isActive ? '12px 18px 12px 16px' : '12px 18px',
                      borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                      borderLeft: isActive
                        ? (isEntryPolish ? '2px solid rgba(48,209,88,0.5)' : '2px solid rgba(10,132,255,0.5)')
                        : '2px solid transparent',
                      background: isActive
                        ? (isEntryPolish ? 'rgba(48,209,88,0.07)' : 'rgba(10,132,255,0.07)')
                        : hoveredId === entry.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 100ms',
                    }}
                  >
                    {/* Row 1: timestamp + iteration badge + mode tag */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>
                          {ts}
                        </span>
                        {entry.isIteration && (
                          <span style={{ fontSize: '9px', color: 'rgba(10,132,255,0.6)' }}>↻</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                        textTransform: 'uppercase', padding: '2px 7px', borderRadius: '3px',
                        background: tagStyle.background, color: tagStyle.color,
                      }}>
                        {entry.mode}
                      </span>
                    </div>
                    {/* Row 2: title */}
                    <div style={{
                      fontSize: '13.5px',
                      color: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.48)',
                      fontWeight: isActive ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginTop: '3px',
                      paddingRight: '16px',
                    }}>
                      {entry.title || entry.transcript?.split(' ').slice(0, 6).join(' ')}
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
                    {/* Bookmark / rating indicators */}
                    {(entry.bookmarked || entry.rating) && hoveredId !== entry.id && (
                      <div style={{
                        position: 'absolute', top: '10px', right: '10px',
                        display: 'flex', gap: '3px', alignItems: 'center',
                      }}>
                        {entry.bookmarked && (
                          <svg width="8" height="10" viewBox="0 0 10 13" fill="rgba(255,189,46,0.8)">
                            <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z" stroke="rgba(255,189,46,0.8)" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                        )}
                        {entry.rating && (
                          <span style={{ fontSize: '9px' }}>{entry.rating === 'up' ? '👍' : '👎'}</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Count footer + Clear all */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '9px 14px',
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
              {activeTab === 'saved'
                ? `${tabFiltered.length} saved`
                : footerText}
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

        {/* ── ZONE 3: RIGHT PANEL ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#0e0e0f', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* IDLE + entry selected → show entry detail */}
          {showEntryDetail && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* You said row + bookmark */}
              <div style={{ padding: '22px 28px 14px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
                  }}>
                    You said · {formatTime(selected.timestamp)}
                  </div>
                  <button
                    onClick={handleBookmark}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: selected.bookmarked ? 'rgba(255,189,46,0.10)' : 'rgba(255,255,255,0.04)',
                      border: `0.5px solid ${selected.bookmarked ? 'rgba(255,189,46,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
                      <path d="M1 1h8v9.5L5 8.5 1 10.5V1Z"
                        fill={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'none'}
                        stroke={selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.3)'}
                        strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: selected.bookmarked ? 500 : 400,
                      color: selected.bookmarked ? 'rgba(255,189,46,0.8)' : 'rgba(255,255,255,0.35)',
                    }}>
                      {selected.bookmarked ? 'Saved' : 'Save'}
                    </span>
                  </button>
                </div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                  {selected.transcript}
                </div>
              </div>

              <div style={{ height: '0.5px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin: '0 28px', flexShrink: 0 }} />

              {/* Prompt content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px', minHeight: 0 }}>
                {renderPromptSections(selected.prompt, labelColor)}
                {selected.polishChanges && selected.polishChanges.length > 0 && (
                  <div style={{ marginTop: '14px', padding: '10px 12px', background: 'rgba(48,209,88,0.04)', border: '0.5px solid rgba(48,209,88,0.12)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(48,209,88,0.5)', marginBottom: '6px' }}>Changes made</div>
                    {selected.polishChanges.map((note, i) => (
                      <div key={i} style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{note}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rating section */}
              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '12px 28px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selected.rating ? '10px' : 0 }}>
                  <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)' }}>
                    Rate this prompt
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['up', 'down'].map(r => (
                      <button key={r} onClick={() => handleRate(r)} style={{
                        width: '28px', height: '28px', borderRadius: '7px',
                        fontSize: '13px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'inherit', transition: 'all 150ms',
                        background: selected.rating === r
                          ? (r === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,59,48,0.15)')
                          : 'rgba(255,255,255,0.04)',
                        border: `0.5px solid ${selected.rating === r
                          ? (r === 'up' ? 'rgba(48,209,88,0.35)' : 'rgba(255,59,48,0.35)')
                          : 'rgba(255,255,255,0.1)'}`,
                      }}>
                        {r === 'up' ? '👍' : '👎'}
                      </button>
                    ))}
                  </div>
                </div>
                {selected.rating && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {ALL_TAGS.map(tag => {
                      const isActiveTag = selected.ratingTag === tag
                      const isPositive = POSITIVE_TAGS.includes(tag)
                      const activeStyle = isPositive
                        ? { bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.3)', text: 'rgba(100,220,130,0.85)' }
                        : { bg: 'rgba(255,59,48,0.10)', border: 'rgba(255,59,48,0.3)', text: 'rgba(255,100,90,0.85)' }
                      const inactiveStyle = { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.35)' }
                      const s = isActiveTag ? activeStyle : inactiveStyle
                      return (
                        <span key={tag} onClick={() => handleTag(tag)} style={{
                          padding: '3px 10px', borderRadius: '6px',
                          fontSize: '10px', fontWeight: isActiveTag ? 500 : 400,
                          cursor: 'pointer', transition: 'all 150ms',
                          background: s.bg, border: `0.5px solid ${s.border}`, color: s.text,
                        }}>
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', padding: '14px 24px 20px', borderTop: '0.5px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <button
                  onClick={handleEntryCopy}
                  style={{
                    flex: 1, height: '40px', borderRadius: '9px',
                    fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
                    background: entryCopied ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.06)',
                    border: entryCopied ? '0.5px solid rgba(48,209,88,0.3)' : '0.5px solid rgba(255,255,255,0.12)',
                    color: entryCopied ? 'rgba(48,209,88,0.9)' : 'rgba(255,255,255,0.72)',
                    transition: 'all 200ms',
                  }}
                >
                  {entryCopied ? 'Copied ✓' : 'Copy prompt'}
                </button>
                <button
                  onClick={handleEntryReuse}
                  style={{
                    flex: 1, height: '40px', borderRadius: '9px',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    background: 'linear-gradient(135deg,rgba(10,132,255,0.92),rgba(10,100,220,0.92))',
                    border: 'none', color: 'white',
                    boxShadow: '0 2px 14px rgba(10,132,255,0.35)',
                  }}
                >
                  Reuse
                </button>
              </div>
            </div>
          )}

          {/* IDLE + no history → centred prompt-to-start placeholder */}
          {currentState === STATES.IDLE && !selected && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <div style={{
                width: '68px', height: '68px', borderRadius: '50%',
                background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="22" viewBox="0 0 12 16" fill="none">
                  <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" />
                  <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" strokeLinecap="round" />
                  <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,170,255,0.7)" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 500, color: 'rgba(255,255,255,0.65)', letterSpacing: '-0.01em' }}>
                Speak your prompt
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)' }}>
                Press ⌥ Space or click the mic to start
              </div>
            </div>
          )}

          {currentState === STATES.RECORDING && (
            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '8px' }}>Listening...</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Speak now. Recording will stop when you tap the square.</div>
            </div>
          )}

          {currentState === STATES.PAUSED && (
            <div style={{ padding: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,189,46,0.75)', marginBottom: '8px' }}>Paused</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>Tap resume to continue recording.</div>
            </div>
          )}

          {currentState === STATES.THINKING && (
            <div style={{ padding: '24px 15%' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>Generating prompt...</div>
              {thinkTranscript && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '20px', fontStyle: 'italic', lineHeight: 1.5 }}>
                  &ldquo;{thinkTranscript}&rdquo;
                </div>
              )}
              {[
                { bars: ['88%', '72%'] },
                { bars: ['94%', '65%'] },
                { bars: ['80%', '55%'] },
              ].map((section, si) => (
                <div key={si}>
                  <div style={{
                    height: '8px', width: '30%', borderRadius: '4px',
                    background: 'rgba(100,170,255,0.08)',
                    marginBottom: '8px', marginTop: si === 0 ? 0 : '16px',
                    animation: 'skeleton-pulse 1.8s ease-in-out infinite',
                  }} />
                  {section.bars.map((w, bi) => (
                    <div key={bi} style={{
                      height: '10px', borderRadius: '5px',
                      background: 'rgba(255,255,255,0.05)', width: w,
                      marginBottom: '10px',
                      animation: `skeleton-pulse ${1.4 + (si * 2 + bi) * 0.15}s ease-in-out infinite`,
                    }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {currentState === STATES.PROMPT_READY && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 12px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
                  <span style={{ color: 'var(--color-green, #30D158)', fontSize: '17px', textShadow: '0 0 8px rgba(48,209,88,0.5)' }}>✓</span>
                  <span>Prompt ready</span>
                  {isIterated && (
                    <span style={{
                      fontSize: '10px', color: 'rgba(10,132,255,0.72)',
                      background: 'rgba(10,132,255,0.08)', border: '0.5px solid rgba(10,132,255,0.2)',
                      borderRadius: '20px', padding: '1px 8px', letterSpacing: '.04em',
                    }}>↻ iterated</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '18px' }}>
                  <button onClick={onIterate} style={{ fontSize: '12px', color: 'rgba(10,132,255,0.85)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↻ Iterate</button>
                  <button onClick={onRegenerate} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Regenerate</button>
                  <button onClick={onReset} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Reset</button>
                </div>
              </div>

              <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 28px', flexShrink: 0 }} />

              {/* Two-column prompt content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
                {isEditing ? (
                  <div
                    ref={promptRef}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      fontSize: '13px', lineHeight: '1.75', color: 'rgba(255,255,255,0.78)',
                      whiteSpace: 'pre-wrap', outline: '1.5px solid rgba(10,132,255,0.6)',
                      outlineOffset: '4px', borderRadius: '6px', minHeight: '100px',
                    }}
                  >
                    {generatedPrompt}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                    <div>
                      {leftSections.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < leftSections.length - 1 ? '18px' : 0 }}>
                          {s.label && (
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                              {s.label}
                            </div>
                          )}
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.8' }}>{s.body}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      {rightSections.map((s, i) => (
                        <div key={i} style={{ marginBottom: i < rightSections.length - 1 ? '18px' : 0 }}>
                          {s.label && (
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: labelColor, marginBottom: '6px' }}>
                              {s.label}
                            </div>
                          )}
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.78)', lineHeight: '1.8' }}>{s.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', margin: '0 28px' }} />
                <div style={{ display: 'flex', gap: '10px', padding: '14px 24px 20px', alignItems: 'center' }}>
                  <button
                    onClick={handleEdit}
                    onMouseEnter={() => setEditHovered(true)}
                    onMouseLeave={() => setEditHovered(false)}
                    style={{
                      height: '40px', padding: '0 20px',
                      border: editHovered ? '0.5px solid rgba(255,255,255,0.16)' : '0.5px solid rgba(255,255,255,0.1)',
                      background: editHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.70)', borderRadius: '8px',
                      fontSize: '13px', cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={handleCopy}
                    style={{
                      height: '40px', padding: '0 32px',
                      border: 'none', borderTop: '0.5px solid rgba(255,255,255,0.20)',
                      background: isCopied
                        ? 'linear-gradient(135deg, rgba(48,209,88,0.85), rgba(30,168,70,0.85))'
                        : 'linear-gradient(135deg, rgba(10,132,255,0.92), rgba(10,100,220,0.92))',
                      color: 'white', borderRadius: '8px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      boxShadow: isCopied ? '0 2px 16px rgba(48,209,88,0.35)' : '0 2px 20px rgba(10,132,255,0.4)',
                      transition: 'all 300ms ease',
                    }}
                  >
                    {isCopied ? '✓ Copied' : 'Copy prompt'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
