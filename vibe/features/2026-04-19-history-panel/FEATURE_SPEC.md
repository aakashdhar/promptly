# FEATURE_SPEC.md — FEATURE-009: History Panel (Split View)
> Folder: vibe/features/2026-04-19-history-panel/
> Created: 2026-04-19

---

## Feature overview

Adds a ⌘H-triggered split-panel history view. Left panel: scrollable list of past prompts
with inline search, mode/time tags, per-entry delete. Right panel: full structured prompt
preview with "Copy prompt" and "Reuse" actions. Window expands to 680px wide when active.
Saving to history already happens on every PROMPT_READY transition (FCR-013) — this feature
adds the UI to browse, search, and act on that data.

---

## User stories

1. As a user, I press ⌘H to open my prompt history from any non-RECORDING state
2. As a user, I see all past prompts in a scrollable list, most recent first, auto-selected
3. As a user, I click an entry to preview the full structured prompt on the right
4. As a user, I search history in real time by transcript, prompt text, or mode
5. As a user, I can delete a single entry with a ✕ button on each row
6. As a user, I can copy a past prompt to clipboard or reuse it in PROMPT_READY
7. As a user, I can clear all history with a single button at the bottom
8. As a user, Done / Escape returns me to where I was before opening history

---

## Acceptance criteria

- [ ] ⌘H opens HISTORY state from any non-RECORDING state
- [ ] Context menu item "History ⌘H" also opens HISTORY state via IPC
- [ ] Window expands to 680px wide + 420px tall on HISTORY entry
- [ ] Window returns to 520px wide on all HISTORY exit paths (Done, Reuse, Escape)
- [ ] Left panel: scrollable list of entries, most recent first, first entry auto-selected
- [ ] Each entry shows: 5-word title, mode tag (uppercase pill), relative timestamp
- [ ] Each entry has a ✕ delete button (visible on hover or always visible — agent choice)
- [ ] Deleting an entry removes it from localStorage and re-renders the list
- [ ] If deleted entry was selected, next entry (or null) becomes selected
- [ ] Active entry: blue left border + blue-tinted background
- [ ] Right panel: "You said" transcript + structured prompt with section labels rendered
- [ ] Section labels (e.g. ROLE:, TASK:) styled differently from body lines
- [ ] Search icon click → inline search input replaces list header
- [ ] Search filters by transcript, prompt body, or mode in real time
- [ ] ✕ on search clears query and restores full list
- [ ] "No results" shown when search returns empty
- [ ] "Copy prompt" copies selected.prompt to clipboard, flashes green 1.8s
- [ ] "Reuse" sets originalTranscript.current + generatedPrompt, closes HISTORY, transitions to PROMPT_READY
- [ ] "Clear all" empties promptly_history from localStorage, clears list and selection
- [ ] "Done" closes history → prevState, window width returns to 520px
- [ ] Escape from HISTORY → prevState (same as Done)
- [ ] Empty state: human message in both panels when no history
- [ ] 28px traffic-light spacer div at top of HISTORY panel (WebkitAppRegion: drag)

---

## Scope boundaries

**In scope:**
- `src/renderer/utils/history.js` — new file: saveToHistory, getHistory, deleteHistoryItem, clearHistory, searchHistory, formatTime
- `src/renderer/components/HistoryPanel.jsx` — new file: full split-panel component
- `App.jsx` — add HISTORY to STATES + STATE_HEIGHTS, import HistoryPanel, ⌘H keydown, onShowHistory IPC, switch saveToHistory import to utils
- `main.js` — resize-window-width IPC + "History ⌘H" context menu + show-history push event
- `preload.js` — resizeWindowWidth + onShowHistory

**Explicitly out of scope:**
- Pagination (100-entry cap sufficient)
- Export from history panel
- History cloud sync
- Per-entry editing
- Sorting options other than most-recent-first

---

## Integration points

| File | Change type | Detail |
|------|-------------|--------|
| `src/renderer/utils/history.js` | New | All localStorage history operations |
| `src/renderer/components/HistoryPanel.jsx` | New | Split-panel UI component |
| `src/renderer/App.jsx` | Modify | HISTORY state + HEIGHT, ⌘H, onShowHistory, import switch |
| `main.js` | Modify | resize-window-width handler + show-history context menu item |
| `preload.js` | Modify | resizeWindowWidth + onShowHistory |

---

## New data

**No schema changes.** `promptly_history` key already exists. Each saved entry is:
```js
{ id: Date.now(), title: string, transcript: string, prompt: string, mode: string, timestamp: ISO string }
```
`title` field added by `saveToHistory()` — first 5 words of transcript + "..." if longer.
Old entries without `title` degrade gracefully (HistoryPanel falls back to truncated transcript).

---

## New IPC channel: resize-window-width

| Property | Value |
|----------|-------|
| Direction | renderer → main |
| Channel | `resize-window-width` |
| Payload | `width` (number) |
| Handler | `win.setResizable(true); const [, h] = win.getSize(); win.setSize(width, h, true); win.setResizable(false)` |
| Preload | `resizeWindowWidth: (w) => ipcRenderer.invoke('resize-window-width', w)` |

Requires DECISIONS.md entry — new channel not in original IPC surface.

---

## Edge cases and error states

- `getHistory()` catches JSON parse errors — returns `[]`
- Empty history → "No history yet" in list, "Select a prompt to view" in right panel
- Search returns 0 results → "No results" in list
- Deleting selected entry → select `updated[0] || null`; if null, right panel shows empty state
- "Reuse" with null selected → button disabled (only rendered when selected !== null)
- "Copy" with null selected → no-op guard

---

## Non-functional requirements

- `win.setSize(width, h, true)` — animated resize on macOS (third arg = animate)
- All dynamic text via JSX text nodes only — no dangerouslySetInnerHTML
- localStorage accessed only via functions in utils/history.js
- RAF loops / timers: none expected in this component — no cleanup needed beyond event listeners

---

## Conformance checklist

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` clean (0 errors, 0 warnings)
- [ ] No dangerouslySetInnerHTML anywhere in new/modified files
- [ ] No direct localStorage.* outside utils/history.js
- [ ] Window width returns to 520px on every exit path
- [ ] CODEBASE.md updated (new files, new state, new IPC channel)
- [ ] DECISIONS.md entry for resize-window-width
- [ ] Smoke checklist from user spec fully ticked
