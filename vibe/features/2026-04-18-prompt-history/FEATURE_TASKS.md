# FEATURE_TASKS.md — F-HISTORY: Prompt History
> Folder: vibe/features/2026-04-18-prompt-history/
> Created: 2026-04-18

> **Estimated effort:** 4 tasks — S: 2, M: 2 — approx. 4-5 hours total

Persist the last 20 generated prompts to localStorage. Add a HISTORY state that shows a
scrollable list. Clicking a history item restores originalTranscript + generatedPrompt
and transitions to PROMPT_READY.

---

### FHI-001 · History storage module — save, load, cap at 20
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

Add to the module-scope vars section (after `generatedPrompt`):

```js
const HISTORY_KEY = 'promptHistory';
const HISTORY_MAX = 20;
```

Add four wrapper functions (after `getModeLabel()`):

```js
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}
function saveToHistory(transcript, prompt, mode) {
  const entry = { id: Date.now(), transcript, prompt, mode, date: new Date().toISOString() };
  const h = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
```

Call `saveToHistory(originalTranscript, generatedPrompt, getMode())` at the point where
`setState(STATES.PROMPT_READY)` is called after a successful generate — both in the
`mediaRecorder.onstop` handler and in the Regenerate handler. Do NOT save on Regenerate
if the output is identical (optional — can skip this optimisation for v1).

**Acceptance criteria**:
- [ ] `loadHistory()` returns array, never throws (catches JSON parse errors)
- [ ] `saveToHistory()` prepends new entry, caps at 20, persists to localStorage
- [ ] `clearHistory()` removes the key entirely
- [ ] `saveToHistory()` called after every successful generate AND regenerate
- [ ] No direct `localStorage.*` access outside these wrappers
- [ ] `HISTORY_KEY` constant defined — no string literals elsewhere

**Self-verify**: `npm start` → speak → generate → open DevTools → Application → localStorage → `promptHistory` shows 1 entry with correct shape `{ id, transcript, prompt, mode, date }`.
**⚠️ Boundaries**: No new IPC channels. No new state yet — just storage.
**CODEBASE.md update?**: No — wait for FHI-004.

---

### FHI-002 · HISTORY state panel + CSS
- **Status**: `[ ]`
- **Size**: M
- **Dependencies**: None (parallel with FHI-001)
- **Touches**: `index.html`

**What to do**:

1. Add `HISTORY` to STATES and STATE_HEIGHTS:
```js
const STATES = { IDLE:'IDLE', RECORDING:'RECORDING', THINKING:'THINKING',
                 PROMPT_READY:'PROMPT_READY', ERROR:'ERROR', HISTORY:'HISTORY' };
const STATE_HEIGHTS = { ..., HISTORY: 420 };
```

2. Add `#panel-history` to the DOM (before `#panel-error`):
```html
<!-- HISTORY -->
<div id="panel-history" style="display:none">
  <div class="traf"></div>
  <div class="top-row">
    <div class="pr-status">
      <span style="color:rgba(255,255,255,0.4);font-size:13px">Recent prompts</span>
    </div>
    <div class="pr-actions">
      <button class="pr-btn" id="btn-history-clear">Clear</button>
      <button class="pr-btn" id="btn-history-close">Close</button>
    </div>
  </div>
  <div class="div-line"></div>
  <div class="history-list" id="history-list"></div>
</div>
```

3. Add CSS for history list:
```css
.history-list {
  overflow-y: auto; max-height: 340px;
  padding: 8px 0;
}
.history-list::-webkit-scrollbar { width: 3px; }
.history-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.history-item {
  padding: 12px 22px;
  cursor: pointer;
  border-bottom: 0.5px solid rgba(255,255,255,0.04);
  transition: background 150ms;
}
.history-item:hover { background: rgba(255,255,255,0.04); }
.history-meta {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.2);
  margin-bottom: 5px;
}
.history-transcript {
  font-size: 12px; color: rgba(255,255,255,0.5);
  line-height: 1.5; letter-spacing: 0.01em;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
```

4. Add `HISTORY` case to `setState()`:
```js
if (newState === STATES.HISTORY) {
  bar.style.display = '';
  document.getElementById('panel-history').style.display = '';
  renderHistoryList();
  requestAnimationFrame(() => window.electronAPI.resizeWindow(STATE_HEIGHTS.HISTORY));
}
```

5. Add `renderHistoryList()` function:
```js
function renderHistoryList() {
  const list = document.getElementById('history-list');
  list.textContent = '';
  const entries = loadHistory();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:20px 22px;font-size:12px;color:rgba(255,255,255,0.2)';
    empty.textContent = 'No prompts yet — speak one to get started';
    list.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const d = new Date(entry.date);
    meta.textContent = d.toLocaleDateString() + ' · ' + entry.mode;
    const text = document.createElement('div');
    text.className = 'history-transcript';
    text.textContent = entry.transcript;
    item.appendChild(meta);
    item.appendChild(text);
    item.addEventListener('click', () => {
      originalTranscript = entry.transcript;
      generatedPrompt = entry.prompt;
      setState(STATES.PROMPT_READY);
    });
    list.appendChild(item);
  }
}
```

6. Wire Close and Clear buttons (in the event listeners section):
```js
document.getElementById('btn-history-close').addEventListener('click', () => setState(STATES.IDLE));
document.getElementById('btn-history-clear').addEventListener('click', () => {
  clearHistory();
  renderHistoryList();
});
```

**Acceptance criteria**:
- [ ] HISTORY state panel renders with a scrollable list
- [ ] Each entry shows date + mode label (meta) and transcript snippet (2-line clamp)
- [ ] Clicking an entry sets `originalTranscript` + `generatedPrompt` and transitions to PROMPT_READY
- [ ] Empty state shows a human-readable message (no blank panel)
- [ ] Clear button removes all history and re-renders empty state
- [ ] Close button returns to IDLE
- [ ] All text via `textContent` — no `innerHTML` with dynamic content
- [ ] History panel missing from `setState()` panels-hide loop? Add `panel-history` to the forEach

**Self-verify**: `npm start` → generate 2 prompts → trigger HISTORY state → see both entries → click one → PROMPT_READY with correct content.
**⚠️ Boundaries**: `textContent` for all dynamic content. `originalTranscript` reassignment is allowed here — restoring from history is the one legitimate mutation. Add `panel-history` to the `forEach` in `setState()` that hides all panels.
**CODEBASE.md update?**: No — wait for FHI-004.

---

### FHI-003 · History trigger — button in IDLE + PROMPT_READY
- **Status**: `[ ]`
- **Size**: M
- **Dependencies**: FHI-001, FHI-002
- **Touches**: `index.html`

**What to do**:

1. Add a history button to the IDLE panel (in `.cr-idle`, after the mode pill):
```html
<button class="mode-pill" id="history-btn" style="-webkit-app-region:no-drag">History</button>
```

Style: same `.mode-pill` class is fine — it reads as a small pill button.

2. Add a "History" action to the PROMPT_READY top-row `.pr-actions` div (before Regenerate):
```html
<button class="pr-btn" id="btn-history">History</button>
```

3. Wire both buttons in event listeners:
```js
document.getElementById('history-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  setState(STATES.HISTORY);
});
document.getElementById('btn-history').addEventListener('click', () => setState(STATES.HISTORY));
```

4. Also wire the shortcut: in `onShortcutTriggered`, add HISTORY as a case that returns to IDLE:
```js
window.electronAPI.onShortcutTriggered(() => {
  if (state === STATES.IDLE) startRecording();
  else if (state === STATES.RECORDING) stopRecording();
  else if (state === STATES.HISTORY) setState(STATES.IDLE);
});
```

**Acceptance criteria**:
- [ ] History pill button visible in IDLE panel
- [ ] History button visible in PROMPT_READY top actions row
- [ ] Both buttons transition to HISTORY state
- [ ] ⌥Space from HISTORY returns to IDLE
- [ ] History button in IDLE stops click from propagating to `idle-area` (which would start recording)
- [ ] `saveToHistory()` called after both generate paths (onstop + regenerate)

**Self-verify**: IDLE → click History → HISTORY panel → Close → IDLE. Then: generate a prompt → PROMPT_READY → click History → see entry → click it → PROMPT_READY with restored content. Also: ⌥Space from HISTORY → IDLE.
**⚠️ Boundaries**: `e.stopPropagation()` on history-btn click is mandatory — without it, the click bubbles to `idle-area` and starts recording.
**CODEBASE.md update?**: No — wait for FHI-004.

---

### FHI-004 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: FHI-001, FHI-002, FHI-003
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

Update CODEBASE.md to reflect:
- New `HISTORY` state in state machine table (panel-history, 420px)
- New localStorage key `promptHistory` in localStorage keys table
- New functions: `loadHistory()`, `saveToHistory()`, `clearHistory()`, `renderHistoryList()`
- New constants: `HISTORY_KEY`, `HISTORY_MAX`
- New DOM element IDs: `panel-history`, `history-list`, `btn-history-close`, `btn-history-clear`, `history-btn`, `btn-history`
- Update "Last updated" line

**Acceptance criteria**:
- [ ] CODEBASE.md state machine table includes HISTORY row
- [ ] localStorage keys table includes `promptHistory`
- [ ] All new functions listed in index.html file map
- [ ] All new DOM IDs listed

**Self-verify**: Read CODEBASE.md — no mention of FHI functions or HISTORY state is missing.
**⚠️ Boundaries**: CODEBASE.md only.

---

#### Conformance: F-HISTORY
- [ ] `saveToHistory()` called after every successful generate and regenerate
- [ ] History capped at 20 entries — oldest dropped first
- [ ] HISTORY panel renders list with date/mode meta and transcript snippet
- [ ] Clicking history entry restores both `originalTranscript` and `generatedPrompt`
- [ ] Empty state shows a human message
- [ ] Clear button works
- [ ] Close and ⌥Space both return to IDLE from HISTORY
- [ ] No `innerHTML` with dynamic content
- [ ] No direct `localStorage.*` outside wrappers
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
