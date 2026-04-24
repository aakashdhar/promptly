# FEATURE-020 Tasks

> **Estimated effort:** 9 tasks — S: 4 (<2hrs each), M: 4 (2-4hrs each) — approx. 14-18 hours total

---

### HSTV2-001 · history.js utility functions
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#solution
- **Dependencies**: None
- **Touches**: `src/renderer/utils/history.js`

**What to do**:
Add two exported functions to history.js:

```js
export function bookmarkHistoryItem(id) {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === id)
  if (idx === -1) return
  history[idx].bookmarked = !history[idx].bookmarked
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history[idx].bookmarked
}

export function rateHistoryItem(id, rating, tag) {
  const history = getHistory()
  const idx = history.findIndex(h => h.id === id)
  if (idx === -1) return
  history[idx].rating = rating
  history[idx].ratingTag = tag || null
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
```

History entry shape after this task:
```
{
  id, title, transcript, prompt, mode, timestamp,
  bookmarked: boolean,
  rating: 'up' | 'down' | null,
  ratingTag: 'Perfect' | 'Clear' | 'Detailed' | 'Too long' | null
}
```

**Acceptance criteria**:
- [ ] `bookmarkHistoryItem(id)` toggles `bookmarked` boolean on matching entry
- [ ] `bookmarkHistoryItem(id)` returns the new `bookmarked` value
- [ ] `rateHistoryItem(id, rating, tag)` sets `rating` and `ratingTag` on matching entry
- [ ] `rateHistoryItem(id, null, null)` clears rating (passing null rating works)
- [ ] Both functions persist changes to `promptly_history` localStorage key via JSON.stringify
- [ ] Both functions are no-ops if id not found (no throw)
- [ ] Both functions are exported

**Self-verify**: Re-read FEATURE_SPEC.md#solution. Tick every criterion.
**Test requirement**: Manual — open history panel, bookmark an entry, reload app, confirm bookmark persists.
**⚠️ Boundaries**: Never access `localStorage` directly — use `HISTORY_KEY` constant and existing pattern. Do NOT touch HistoryPanel.jsx in this task.
**CODEBASE.md update?**: Yes — add `bookmarkHistoryItem`, `rateHistoryItem` to history.js exports section (defer to HSTV2-009).
**Architecture compliance**: localStorage access via HISTORY_KEY constant only. Pure functions — no side effects beyond storage.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-002 · Tab switcher
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#tab-switcher
- **Dependencies**: HSTV2-001
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add `activeTab` state and tab switcher UI to HistoryPanel.jsx.

Add state:
```js
const [activeTab, setActiveTab] = useState('all')
```

Tab switcher JSX — add as first child inside left panel after traf spacer:
```jsx
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
```

Filter entries by tab in the render:
```js
const tabFiltered = activeTab === 'saved'
  ? entries.filter(e => e.bookmarked)
  : entries
```

Use `tabFiltered` (not `entries`) in the entry map render. Also add empty state for Saved tab:
```jsx
{activeTab === 'saved' && tabFiltered.length === 0 && (
  <div style={{padding:'20px', textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'11px'}}>
    No saved prompts yet
  </div>
)}
```

**Acceptance criteria**:
- [ ] Tab switcher renders with All and Saved tabs
- [ ] Clicking All tab sets activeTab to 'all', applies All active styles
- [ ] Clicking Saved tab sets activeTab to 'saved', applies Saved active styles (amber)
- [ ] Switching tabs resets activeFilter to 'all' (prevents confusing empty-looking Saved tab)
- [ ] Saved tab shows bookmark SVG icon in both active and inactive states
- [ ] Saved tab filters to only bookmarked entries
- [ ] Saved tab empty state shows "No saved prompts yet" when no bookmarks
- [ ] All tab shows all entries regardless of bookmark state
- [ ] Import of `bookmarkHistoryItem` added (will be used in HSTV2-005)

**Self-verify**: Re-read FEATURE_SPEC.md#tab-switcher. Tick every criterion.
**Test requirement**: Manual — add a bookmark (once HSTV2-005 is done), switch to Saved tab, confirm only bookmarked entries appear.
**⚠️ Boundaries**: All styles inline. No Tailwind classes for new elements. No dangerouslySetInnerHTML.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: useState for activeTab. tabFiltered derived from entries + activeTab — no extra state.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-003 · Filter chips
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#filter-chips
- **Dependencies**: HSTV2-002
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add `activeFilter` state and filter chips UI below tab switcher.

Add state:
```js
const [activeFilter, setActiveFilter] = useState('all')
```

Filter chips JSX — add below tab switcher:
```jsx
<div style={{display:'flex', gap:'4px', padding:'10px 12px', flexWrap:'wrap'}}>
  {[
    { id: 'all', label: 'All' },
    { id: 'up', label: '👍' },
    { id: 'down', label: '👎' },
    { id: 'unrated', label: 'Unrated' }
  ].map(f => {
    const isActive = activeFilter === f.id
    const colors = {
      all: { bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' },
      up:  { bg:'rgba(48,209,88,0.10)',   border:'rgba(48,209,88,0.25)',   text:'rgba(100,220,130,0.8)' },
      down:{ bg:'rgba(255,59,48,0.10)',    border:'rgba(255,59,48,0.25)',   text:'rgba(255,100,90,0.75)' },
      unrated:{ bg:'rgba(255,255,255,0.08)', border:'rgba(255,255,255,0.14)', text:'rgba(255,255,255,0.55)' }
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
```

Filter logic — apply after tabFiltered:
```js
const filteredEntries = tabFiltered.filter(e => {
  if (activeFilter === 'all') return true
  if (activeFilter === 'up') return e.rating === 'up'
  if (activeFilter === 'down') return e.rating === 'down'
  if (activeFilter === 'unrated') return !e.rating
  return true
})
```

Use `filteredEntries` in the entry map render (replacing `tabFiltered`).

**Acceptance criteria**:
- [x] Filter chips render: All, 👍, 👎, Unrated
- [x] All chip is active by default with correct styles
- [x] Clicking a chip sets it active with correct colour styling
- [x] 👍 chip active: green background/border/text
- [x] 👎 chip active: red background/border/text
- [x] Filter correctly shows only rated-up / rated-down / unrated entries
- [x] filteredEntries is used in the entry list render

**Self-verify**: Re-read FEATURE_SPEC.md#filter-chips. Tick every criterion.
**Test requirement**: Manual — rate entries, switch filters, confirm list updates in real time.
**⚠️ Boundaries**: All styles inline. No Tailwind for new elements.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: Derived `filteredEntries` from `tabFiltered` + `activeFilter` — no redundant state.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-004 · Stats bar
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#stats-bar
- **Dependencies**: HSTV2-003
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add stats bar below filter chips. Only show when `activeTab === 'all'`.

Use `getHistory()` directly (not `entries` state) so stats always reflect total history
regardless of active search. Import `getHistory` is already available from the existing import.

```jsx
const allHistory = getHistory()
const ratedEntries = allHistory.filter(e => e.rating)
const upCount = allHistory.filter(e => e.rating === 'up').length
const upPct = ratedEntries.length > 0 ? Math.round(upCount / ratedEntries.length * 100) : 0
const downPct = 100 - upPct

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
    {ratedEntries.length > 0 && (
      <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
        <span style={{fontSize:'10px', color:'rgba(100,220,130,0.7)'}}>👍 {upPct}%</span>
        <div style={{width:'0.5px', height:'10px', background:'rgba(255,255,255,0.1)'}}/>
        <span style={{fontSize:'10px', color:'rgba(255,100,90,0.65)'}}>👎 {downPct}%</span>
      </div>
    )}
  </div>
)}
```

**Acceptance criteria**:
- [x] Stats bar renders below filter chips on All tab
- [x] Shows correct total prompt count from full history (not search-filtered count)
- [x] Shows 👍 and 👎 percentages when at least 1 rated prompt exists
- [x] Percentages reflect full history — do not change when search is active
- [x] Percentages sum to 100%
- [x] Rating percentages hidden when no rated prompts (count only)
- [x] Stats bar not rendered on Saved tab

**Self-verify**: Re-read FEATURE_SPEC.md#stats-bar. Tick every criterion.
**Test requirement**: Manual — type a search query, confirm stats bar count doesn't change.
**⚠️ Boundaries**: Stats computed from `getHistory()` (full list), NOT from `entries` or `filteredEntries`.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: Derived computation only — no new state. `getHistory()` already imported.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-005 · Bookmark toggle
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#bookmark-toggle
- **Dependencies**: HSTV2-004
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add import for `bookmarkHistoryItem`, implement `handleBookmark`, add bookmark toggle button to right panel YOU SAID header row, and add bookmark icon to entry list.

Import:
```js
import { bookmarkHistoryItem } from '../utils/history'
```

handleBookmark function:
```js
function handleBookmark() {
  if (!selected) return
  bookmarkHistoryItem(selected.id)
  const updated = { ...selected, bookmarked: !selected.bookmarked }
  setSelected(updated)
  setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
}
```

Bookmark toggle button — add to right panel YOU SAID header row (next to "YOU SAID" label):
```jsx
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
```

Bookmark icon in entry list — the existing entry container already has `position:'relative'`.
The existing delete ✕ button is at `position:absolute, top:12px, right:12px`.
**Fix collision (P1-001):** Make delete button hover-only via a `hoveredEntry` state so it does
not visually conflict with the bookmark/rating indicator at the same position.

Add state:
```js
const [hoveredEntry, setHoveredEntry] = useState(null)
```

Update each entry container to set hover:
```jsx
<div
  key={entry.id}
  onClick={() => setSelected(entry)}
  onMouseEnter={() => setHoveredEntry(entry.id)}
  onMouseLeave={() => setHoveredEntry(null)}
  style={{ ...existing styles... }}>
```

Update delete button to only show on hover:
```jsx
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
```

Bookmark/rating indicator — add after the delete button (right:12px, no collision when delete is hidden):
```jsx
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
```

The indicator hides when hovering (delete takes over right:12px); shows when not hovering.
This gives a clean, non-overlapping UX.

**Acceptance criteria**:
- [x] `bookmarkHistoryItem` imported from utils/history
- [x] `hoveredEntry` state added to HistoryPanel
- [x] Entry containers have onMouseEnter/onMouseLeave to track hoveredEntry
- [x] Delete button visible only on entry hover (opacity:0 → opacity:1 on hover)
- [x] Bookmark/rating indicator hidden during hover (delete takes the slot)
- [x] Save button appears in right panel YOU SAID header row
- [x] Unsaved state: light background, stroke-only SVG, "Save" label
- [x] Saved state: amber background, filled SVG, "Saved" label, font-weight 500
- [x] Clicking Save button toggles bookmark and updates both selected + entries state
- [x] Bookmarked entries show filled amber bookmark SVG top-right in list (when not hovering)
- [x] Rated entries show emoji top-right in list (when not hovering)
- [x] Bookmark state persists after toggling (checked via Saved tab showing entry)

**Self-verify**: Re-read FEATURE_SPEC.md#bookmark-toggle. Tick every criterion.
**Test requirement**: Manual — bookmark an entry, confirm indicator shows; hover the entry, confirm delete ✕ shows and indicator hides.
**⚠️ Boundaries**: No new IPC. Bookmark stored in localStorage only via `bookmarkHistoryItem`. Entry list indicators must NOT break existing entry delete or click-to-select behaviour.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: handleBookmark mutates local state optimistically. `hoveredEntry` is UI-only state (no persistence needed).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-006 · Rating section
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#rating-section
- **Dependencies**: HSTV2-005
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add import for `rateHistoryItem`, implement `handleRate` and `handleTag`, add rating section JSX between prompt content and action buttons.

Import:
```js
import { rateHistoryItem } from '../utils/history'
```

Constants (module-level, outside component):
```js
const POSITIVE_TAGS = ['Perfect', 'Clear', 'Detailed']
const ALL_TAGS = ['Perfect', 'Clear', 'Detailed', 'Too long']
```

handleRate:
```js
function handleRate(rating) {
  if (!selected) return
  const newRating = selected.rating === rating ? null : rating
  const newTag = null
  rateHistoryItem(selected.id, newRating, newTag)
  const updated = { ...selected, rating: newRating, ratingTag: newTag }
  setSelected(updated)
  setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
}
```

handleTag:
```js
function handleTag(tag) {
  if (!selected || !selected.rating) return
  const newTag = selected.ratingTag === tag ? null : tag
  rateHistoryItem(selected.id, selected.rating, newTag)
  const updated = { ...selected, ratingTag: newTag }
  setSelected(updated)
  setEntries(prev => prev.map(e => e.id === selected.id ? updated : e))
}
```

Rating section JSX — add between prompt content scroll area and action buttons row:
```jsx
<div style={{
  borderTop:'0.5px solid rgba(255,255,255,0.06)',
  padding:'12px 22px', flexShrink:0
}}>
  <div style={{
    display:'flex', justifyContent:'space-between',
    alignItems:'center', marginBottom:'10px'
  }}>
    <span style={{
      fontSize:'10px', fontWeight:600, letterSpacing:'.06em',
      textTransform:'uppercase', color:'rgba(255,255,255,0.22)'
    }}>Rate this prompt</span>
    <div style={{display:'flex', gap:'6px'}}>
      {['up', 'down'].map(r => (
        <button key={r} onClick={() => handleRate(r)} style={{
          width:'30px', height:'30px', borderRadius:'8px',
          fontSize:'14px', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 150ms',
          fontFamily:'inherit',
          background: selected.rating === r
            ? (r === 'up' ? 'rgba(48,209,88,0.15)' : 'rgba(255,59,48,0.15)')
            : 'rgba(255,255,255,0.04)',
          border: `0.5px solid ${selected.rating === r
            ? (r === 'up' ? 'rgba(48,209,88,0.35)' : 'rgba(255,59,48,0.35)')
            : 'rgba(255,255,255,0.1)'}`
        }}>
          {r === 'up' ? '👍' : '👎'}
        </button>
      ))}
    </div>
  </div>

  {selected.rating && (
    <div style={{display:'flex', gap:'6px', flexWrap:'wrap'}}>
      {ALL_TAGS.map(tag => {
        const isActive = selected.ratingTag === tag
        const isPositive = POSITIVE_TAGS.includes(tag)
        const activeStyle = isPositive
          ? { bg:'rgba(48,209,88,0.12)', border:'rgba(48,209,88,0.3)', text:'rgba(100,220,130,0.85)' }
          : { bg:'rgba(255,59,48,0.10)', border:'rgba(255,59,48,0.3)', text:'rgba(255,100,90,0.85)' }
        const inactiveStyle = { bg:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.08)', text:'rgba(255,255,255,0.35)' }
        const s = isActive ? activeStyle : inactiveStyle
        return (
          <span key={tag} onClick={() => handleTag(tag)} style={{
            padding:'3px 10px', borderRadius:'6px',
            fontSize:'10px', fontWeight: isActive ? 500 : 400,
            cursor:'pointer', transition:'all 150ms',
            background:s.bg, border:`0.5px solid ${s.border}`, color:s.text
          }}>
            {tag}
          </span>
        )
      })}
    </div>
  )}
</div>
```

**Acceptance criteria**:
- [x] `rateHistoryItem` imported from utils/history
- [x] POSITIVE_TAGS and ALL_TAGS constants defined at module level
- [x] Rating section renders below prompt content, above action buttons
- [x] "RATE THIS PROMPT" label in uppercase, correct font-size and color
- [x] 👍 button: inactive state correct; active state green highlight
- [x] 👎 button: inactive state correct; active state red highlight
- [x] Tapping active thumb a second time toggles rating off (null)
- [x] Tapping opposite thumb switches rating + clears tag
- [x] Tag chips appear only when a rating is selected
- [x] Correct tags show: Perfect, Clear, Detailed, Too long
- [x] Active tag highlighted in correct colour (green for positive, red for "Too long")
- [x] Tapping active tag deselects it (sets ratingTag to null)
- [x] Single-select: only one tag active at a time
- [x] Rating + tag state persists (checked by closing/reopening history)

**Self-verify**: Re-read FEATURE_SPEC.md#rating-section. Tick every criterion.
**Test requirement**: Manual — rate a prompt, select a tag, close and reopen history, confirm rating persists.
**⚠️ Boundaries**: No new IPC. Rating stored via `rateHistoryItem` only. Do not reuse PromptReadyState or any other component for tag chips.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: handleRate and handleTag follow same optimistic update pattern as handleBookmark.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-007 · Entry indicators
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#entry-list
- **Dependencies**: HSTV2-006
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Add tag pill in each entry's meta row (date/mode row). This is separate from the top-right bookmark/emoji indicator added in HSTV2-005.

In the meta row of each entry (the row showing timestamp + mode), add:
```jsx
{entry.rating === 'down' && entry.ratingTag && (
  <span style={{
    fontSize:'9px', padding:'1px 5px', borderRadius:'4px',
    background:'rgba(255,59,48,0.08)',
    border:'0.5px solid rgba(255,59,48,0.2)',
    color:'rgba(255,100,90,0.7)'
  }}>
    {entry.ratingTag}
  </span>
)}
{entry.rating === 'up' && entry.ratingTag && (
  <span style={{
    fontSize:'9px', padding:'1px 5px', borderRadius:'4px',
    background:'rgba(48,209,88,0.08)',
    border:'0.5px solid rgba(48,209,88,0.2)',
    color:'rgba(100,220,130,0.7)'
  }}>
    {entry.ratingTag}
  </span>
)}
```

**Acceptance criteria**:
- [x] Tag pill appears in meta row for entries with any rating + ratingTag
- [x] Thumbs down tag: red background/border/text
- [x] Thumbs up tag: green background/border/text
- [x] Tag pill not shown when no ratingTag (or no rating)
- [x] Tag pill shows correct tag text

**Self-verify**: Re-read FEATURE_SPEC.md#entry-list. Tick every criterion.
**Test requirement**: Manual — rate entries with tags, confirm pills appear in list.
**⚠️ Boundaries**: Tag pills go in meta row only — do not duplicate top-right emoji indicator.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: JSX text nodes only — no dangerouslySetInnerHTML.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-008 · Footer update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#footer
- **Dependencies**: HSTV2-007
- **Touches**: `src/renderer/components/HistoryPanel.jsx`

**What to do**:
Update the footer count text to show saved count when > 0, and adapt for Saved tab.

```js
const savedCount = entries.filter(e => e.bookmarked).length
const footerText = savedCount > 0
  ? `${entries.length} prompt${entries.length !== 1 ? 's' : ''} · ${savedCount} saved`
  : `${entries.length} prompt${entries.length !== 1 ? 's' : ''}`
```

Replace existing footer count span content:
```jsx
<span style={{fontSize:'10px', color:'rgba(255,255,255,0.2)'}}>
  {activeTab === 'saved'
    ? `${tabFiltered.length} saved prompt${tabFiltered.length !== 1 ? 's' : ''}`
    : footerText}
</span>
```

**Acceptance criteria**:
- [ ] Footer shows "{n} prompts · {m} saved" when saved count > 0
- [ ] Footer shows "{n} prompts" when no bookmarks
- [ ] On Saved tab, footer shows "{m} saved prompts"
- [ ] Singular/plural handled correctly (1 prompt vs 2 prompts)

**Self-verify**: Re-read FEATURE_SPEC.md#footer. Tick every criterion.
**Test requirement**: Manual — bookmark entries, confirm footer shows saved count.
**⚠️ Boundaries**: savedCount and footerText are derived values — no new state.
**CODEBASE.md update?**: No — defer to HSTV2-009.
**Architecture compliance**: Derived strings only. JSX text nodes.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HSTV2-009 · Docs
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md (all sections)
- **Dependencies**: HSTV2-008
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. CODEBASE.md: Add `bookmarkHistoryItem` and `rateHistoryItem` to the history.js row in the File map table. Update the `promptly_history` localStorage key entry to note that entries now include `bookmarked`, `rating`, and `ratingTag` fields.
2. DECISIONS.md: Append entry — FEATURE-020 history panel v2 — added tabs, filters, stats, bookmarks, ratings.
3. TASKS.md: Mark FEATURE-020 complete.

**Acceptance criteria**:
- [ ] CODEBASE.md history.js exports include bookmarkHistoryItem, rateHistoryItem
- [ ] CODEBASE.md promptly_history entry updated with new fields
- [ ] DECISIONS.md has FEATURE-020 entry
- [ ] TASKS.md shows FEATURE-020 complete

**Self-verify**: Check all three files updated correctly.
**Test requirement**: None — doc task.
**⚠️ Boundaries**: Doc changes only — do not touch source files.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: N/A.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-020 History Panel v2
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Tab switcher shows All and Saved tabs
- [ ] All tab shows all entries with filter chips and stats
- [ ] Saved tab shows only bookmarked entries
- [ ] Filter chips: All, 👍, 👎, Unrated — filter list in real time
- [ ] Stats bar shows prompt count + rating percentages
- [ ] Bookmark button in right panel toggles save state
- [ ] Bookmarked entries show filled amber bookmark icon in list
- [ ] Bookmark persists in localStorage
- [ ] Rating section shows at bottom of right panel
- [ ] 👍 tapped — green highlight, tag chips appear
- [ ] 👎 tapped — red highlight, tag chips appear
- [ ] Tag tapped — highlights in matching colour, single select
- [ ] Tapping active tag deselects it
- [ ] Tapping opposite thumb switches rating and clears tag
- [ ] Rating + tag + bookmark persist in localStorage
- [ ] Rated entries show emoji top-right in list
- [ ] Thumbs down entries show tag as pill in meta row
- [ ] Footer shows "{n} prompts · {m} saved"
- [ ] Clear all removes ratings, bookmarks and entries together
- [ ] Saved tab empty state: "No saved prompts yet"
- [ ] Linter clean
- [ ] No regressions in existing history browsing, search, delete, reuse flows
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
