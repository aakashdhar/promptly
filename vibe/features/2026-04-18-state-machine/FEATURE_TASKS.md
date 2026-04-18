# FEATURE_TASKS — F-STATE: State machine + full UI skeleton
> Feature: F-STATE | Date: 2026-04-18 | Spec: FEATURE_SPEC.md | Plan: FEATURE_PLAN.md

> **Estimated effort:** 5 tasks — S: 3 (<2hrs each), M: 2 (2-4hrs each) — approx. 7 hours total

---

### FST-001 · JS foundation: module vars, localStorage wrappers, setState() skeleton
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (state machine criteria) + FEATURE_SPEC.md#6 (data model)
- **Dependencies**: None
- **Touches**: `index.html` only

**What to do**:

Inside the `<script>` block in index.html, replace the empty DOMContentLoaded stub with:

1. **Module-scope variables** (declared before DOMContentLoaded):
```js
let currentState = null;
let transcript = '';
let originalTranscript = '';
let generatedPrompt = '';
```

2. **STATE_HEIGHTS constant**:
```js
const STATE_HEIGHTS = {
  FIRST_RUN: 120,
  IDLE: 44,
  RECORDING: 80,
  THINKING: 44,
  PROMPT_READY: 200,
  ERROR: 44,
};
```

3. **localStorage wrappers** — these 4 functions are the ONLY localStorage access allowed:
```js
function getMode() {
  try { return localStorage.getItem('mode') || 'balanced'; } catch { return 'balanced'; }
}
function setMode(value) {
  try { localStorage.setItem('mode', value); } catch { /* silent */ }
}
function getFirstRunComplete() {
  try { return localStorage.getItem('firstRunComplete') === 'true'; } catch { return false; }
}
function setFirstRunComplete(value) {
  try { localStorage.setItem('firstRunComplete', String(value)); } catch { /* silent */ }
}
```

4. **setState() skeleton** — stub (DOM panels not yet built):
```js
function setState(newState, payload = {}) {
  if (!STATE_HEIGHTS[newState]) {
    console.error('setState: unknown state', newState);
    return;
  }
  currentState = newState;
  console.log('setState →', newState, payload);
  // DOM switching and resize added in FST-002 and FST-004
}
```

**Acceptance criteria**:
- [ ] All 4 module-scope vars declared at top of script block
- [ ] STATE_HEIGHTS has all 6 keys
- [ ] `getMode()` returns `'balanced'` when localStorage is empty
- [ ] `setMode('code')` + `getMode()` round-trips correctly (test in console)
- [ ] `setState('IDLE')` logs correctly, `setState('BADSTATE')` logs error and returns
- [ ] No `localStorage.*` direct access anywhere outside the 4 wrapper functions

**Self-verify**: Re-read FEATURE_SPEC.md#3 state machine criteria. Tick every criterion that applies to this task.
**Test requirement**: Manual console test — call getMode(), setMode('code'), getMode() in sequence; call setState('IDLE') and setState('UNKNOWN').
**⚠️ Boundaries**: Never write `localStorage.getItem` or `localStorage.setItem` outside the 4 wrapper functions.
**CODEBASE.md update?**: No — defer to FST-005 when all pieces exist.
**Architecture compliance**: localStorage wrapper pattern from ARCHITECTURE.md; camelCase functions; SCREAMING_SNAKE_CASE constants.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FST-002 · DOM structure: all 6 state panels in #app
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (DOM structure criteria)
- **Dependencies**: FST-001
- **Touches**: `index.html` only

**What to do**:

Replace `<div id="app"></div>` with the full DOM structure. All 6 state panels are inside `#app`. All panels have `hidden` by default — only setState() removes `hidden`.

Structure pattern:
```html
<div id="app">
  <!-- FIRST_RUN -->
  <div id="state-first-run" class="state-panel" hidden>
    <div class="firstrun-row" id="firstrun-cli-row">
      <span id="firstrun-cli-status" class="firstrun-status"></span>
      <span class="firstrun-label">Claude CLI installed</span>
    </div>
    <div class="firstrun-row" id="firstrun-mic-row">
      <span class="firstrun-status">○</span>
      <span class="firstrun-label">Microphone access granted</span>
      <button id="firstrun-mic-btn" class="btn-action">Grant Access</button>
    </div>
  </div>

  <!-- IDLE -->
  <div id="state-idle" class="state-panel" hidden>
    <span id="idle-mode-label" class="mode-pill">Balanced</span>
    <span id="idle-shortcut-hint" class="shortcut-hint">⌥Space</span>
    <span id="idle-conflict-notice" class="conflict-notice" hidden>Shortcut ⌥Space taken — using ⌃`</span>
  </div>

  <!-- RECORDING -->
  <div id="state-recording" class="state-panel" hidden>
    <div class="recording-row">
      <span id="recording-dot" class="recording-dot"></span>
      <span id="recording-transcript" class="recording-transcript">Listening…</span>
      <span id="recording-stop-hint" class="stop-hint">⌥Space to stop</span>
    </div>
  </div>

  <!-- THINKING -->
  <div id="state-thinking" class="state-panel" hidden>
    <div id="thinking-spinner" class="spinner"></div>
    <span id="thinking-text" class="thinking-text">Generating prompt…</span>
  </div>

  <!-- PROMPT_READY -->
  <div id="state-prompt-ready" class="state-panel" hidden>
    <div id="prompt-output" class="prompt-output"></div>
    <div class="action-row">
      <button id="action-copy" class="btn-action">Copy</button>
      <button id="action-edit" class="btn-action">Edit</button>
      <button id="action-done" class="btn-action btn-done" hidden>Done</button>
      <button id="action-regenerate" class="btn-secondary">Regenerate</button>
    </div>
  </div>

  <!-- ERROR -->
  <div id="state-error" class="state-panel" hidden>
    <span class="error-icon">⚠</span>
    <span id="error-message" class="error-message">An error occurred.</span>
    <span class="error-dismiss">Tap to dismiss</span>
  </div>
</div>
```

Also update **setState()** to switch panels:
```js
function setState(newState, payload = {}) {
  if (!STATE_HEIGHTS[newState]) {
    console.error('setState: unknown state', newState);
    return;
  }
  currentState = newState;

  // Hide all panels; show active
  const panels = ['FIRST_RUN', 'IDLE', 'RECORDING', 'THINKING', 'PROMPT_READY', 'ERROR'];
  panels.forEach(s => {
    const id = 'state-' + s.toLowerCase().replace('_', '-');
    document.getElementById(id).hidden = (s !== newState);
  });

  // Payload handling (expands as features are added)
  if (newState === 'ERROR' && payload.message) {
    document.getElementById('error-message').textContent = payload.message;
  }
  if (newState === 'PROMPT_READY' && payload.prompt) {
    document.getElementById('prompt-output').textContent = payload.prompt;
  }

  // Resize added in FST-004
}
```

**Acceptance criteria**:
- [ ] All 6 state panels exist with correct IDs
- [ ] All interactive element IDs match FEATURE_SPEC.md§3 exactly
- [ ] `setState('ERROR', { message: 'fail' })` → `#error-message` shows "fail" via textContent (not innerHTML)
- [ ] `setState('PROMPT_READY', { prompt: 'test' })` → `#prompt-output` shows "test" via textContent
- [ ] Only one state panel visible at a time (verify by checking DOM after setState calls)
- [ ] No `innerHTML` used with any dynamic content — `textContent` only

**Self-verify**: Re-read FEATURE_SPEC.md#3 DOM structure criteria. Check every element ID against the spec list.
**Test requirement**: In DevTools, call `setState('ERROR', { message: 'hello' })` — verify #error-message text and only ERROR panel visible.
**⚠️ Boundaries**: Use `textContent` for ALL dynamic text. Never use `innerHTML` for payload content.
**CODEBASE.md update?**: No — defer to FST-005.
**Architecture compliance**: All elements by ID (no querySelector chains). textContent for all user-provided content. Elements access via getElementById only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FST-003 · CSS: all 6 states fully styled
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (CSS/visual criteria) + SPEC.md#ui-specification
- **Dependencies**: FST-002
- **Touches**: `index.html` only (the `<style>` block)

**What to do**:

Replace the minimal CSS in `<style>` with complete styles for all states. Key rules:

**Base structure:**
```css
:root {
  --color-action: #007AFF;
  --color-recording: #FF3B30;
  --color-success: #34C759;
  --bg-window: rgba(255, 255, 255, 0.85);
  --radius-window: 14px;
  --radius-inner: 8px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  background: var(--bg-window);
  border-radius: var(--radius-window);
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
}

#app {
  width: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-panel {
  width: 100%;
  padding: 0 16px;
  display: flex;
  align-items: center;
}
```

**IDLE state:**
```css
#state-idle {
  height: 44px;
  justify-content: center;
  gap: 8px;
  position: relative;
}
.mode-pill {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-action);
  background: rgba(0, 122, 255, 0.08);
  padding: 2px 8px;
  border-radius: var(--radius-inner);
}
.shortcut-hint {
  font-size: 13px;
  color: rgba(0,0,0,0.4);
}
.conflict-notice {
  font-size: 11px;
  color: rgba(0,0,0,0.5);
  position: absolute;
  bottom: 4px;
  left: 0; right: 0;
  text-align: center;
}
```

**RECORDING state:**
```css
#state-recording {
  height: 80px;
  flex-direction: column;
  padding: 8px 16px;
  gap: 6px;
}
.recording-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}
.recording-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-recording);
  flex-shrink: 0;
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
.recording-transcript {
  flex: 1;
  font-size: 13px;
  color: rgba(0,0,0,0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stop-hint {
  font-size: 11px;
  color: rgba(0,0,0,0.35);
  flex-shrink: 0;
}
```

**THINKING state:**
```css
#state-thinking {
  height: 44px;
  gap: 8px;
  justify-content: center;
}
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0,0,0,0.15);
  border-top-color: var(--color-action);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.thinking-text {
  font-size: 13px;
  color: rgba(0,0,0,0.5);
}
```

**PROMPT_READY state:**
```css
#state-prompt-ready {
  height: 200px;
  flex-direction: column;
  padding: 12px 16px;
  gap: 10px;
  align-items: stretch;
  justify-content: flex-start;
}
.prompt-output {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: rgba(0,0,0,0.85);
  overflow-y: auto;
  border-radius: var(--radius-inner);
  background: rgba(0,0,0,0.03);
  padding: 8px 10px;
  -webkit-user-select: text;
  user-select: text;
}
.prompt-output:focus {
  outline: 2px solid var(--color-action);
  outline-offset: -1px;
}
.action-row {
  display: flex;
  gap: 6px;
  justify-content: flex-start;
}
.btn-action {
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: var(--radius-inner);
  border: none;
  cursor: pointer;
  background: var(--color-action);
  color: #fff;
  transition: opacity 150ms ease;
}
.btn-action:hover { opacity: 0.85; }
.btn-secondary {
  font-family: inherit;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: var(--radius-inner);
  border: none;
  cursor: pointer;
  background: rgba(0,0,0,0.06);
  color: rgba(0,0,0,0.6);
  transition: opacity 150ms ease;
  margin-left: auto;
}
.btn-secondary:hover { opacity: 0.75; }
```

**ERROR state:**
```css
#state-error {
  height: 44px;
  gap: 8px;
  cursor: pointer;
}
.error-icon {
  font-size: 14px;
  flex-shrink: 0;
}
.error-message {
  flex: 1;
  font-size: 12px;
  color: rgba(0,0,0,0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-dismiss {
  font-size: 11px;
  color: rgba(0,0,0,0.35);
  flex-shrink: 0;
}
```

**FIRST_RUN state:**
```css
#state-first-run {
  height: 120px;
  flex-direction: column;
  padding: 12px 16px;
  gap: 10px;
  align-items: stretch;
  justify-content: center;
}
.firstrun-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.firstrun-status {
  font-size: 14px;
  flex-shrink: 0;
}
.firstrun-label {
  flex: 1;
  font-size: 13px;
  color: rgba(0,0,0,0.75);
}
```

**Acceptance criteria**:
- [ ] All 6 states are visually distinct and render at correct heights (44/80/44/200/44/120)
- [ ] No hardcoded hex values outside `:root` block
- [ ] Recording dot blinks via `blink` animation
- [ ] Spinner rotates via `spin` animation
- [ ] Buttons use design tokens for colors
- [ ] Mode pill has iOS-blue background tint
- [ ] Prompt output area is scrollable and allows text selection
- [ ] `transition: opacity 150ms ease` used for interactive hover states

**Self-verify**: Re-read FEATURE_SPEC.md#3 CSS/visual criteria. Open app and visually inspect each state.
**Test requirement**: `npm start`, then DevTools console — call setState() for each state and visually verify height and visual design.
**⚠️ Boundaries**: Never use hex values outside `:root`. No transforms in transitions. No external stylesheets.
**CODEBASE.md update?**: No — defer to FST-005.
**Architecture compliance**: All styles in `<style>` block. CSS custom properties for all colours. System font only. 150ms opacity transitions only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FST-004 · Window resize IPC channel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#7 (resize-window IPC)
- **Dependencies**: FST-001 (STATE_HEIGHTS constant)
- **Touches**: `main.js`, `preload.js`

**What to do**:

**main.js** — add alongside existing ipcMain.handle blocks:
```js
ipcMain.handle('resize-window', (_event, { height }) => {
  if (win) {
    win.setContentSize(480, height);
  }
  return { ok: true };
});
```

**preload.js** — add to contextBridge.exposeInMainWorld object:
```js
resizeWindow: (height) => ipcRenderer.invoke('resize-window', { height }),
```

**index.html** — update setState() to call resize after DOM switch:
```js
// At end of setState(), after panel switching:
if (window.electronAPI && window.electronAPI.resizeWindow) {
  window.electronAPI.resizeWindow(STATE_HEIGHTS[newState]);
}
```

Also update initial window height in `main.js` `createWindow()`:
- Change `windowHeight` from `80` to `44` (matches IDLE state height)

**Acceptance criteria**:
- [ ] `ipcMain.handle('resize-window', ...)` present in main.js
- [ ] `resizeWindow` exposed in preload.js contextBridge
- [ ] setState() calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])`
- [ ] Window height changes when setState() is called from DevTools console
- [ ] Initial window height in createWindow() is `44` (IDLE height)
- [ ] `npm run lint` passes on main.js and preload.js

**Self-verify**: Call `setState('PROMPT_READY', { prompt: 'test' })` in console — window should visibly grow to 200px.
**Test requirement**: Visual verification of window height change per state. Lint must pass.
**⚠️ Boundaries**: This adds one new IPC channel. No other IPC channels should be added or modified.
**CODEBASE.md update?**: No — defer to FST-005.
**Architecture compliance**: Follows exact IPC pattern from ARCHITECTURE.md. Channel name: kebab-case. handler: ipcMain.handle. Exposed via contextBridge only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FST-005 · Boot sequence, IPC wire-up, smoke test, CODEBASE.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (IPC listeners, boot) + FEATURE_SPEC.md#10 (conformance)
- **Dependencies**: FST-001 through FST-004
- **Touches**: `index.html`, `vibe/CODEBASE.md`

**What to do**:

**index.html** — inside DOMContentLoaded:

1. **Shortcut listener** (stub state cycle — no real speech/Claude logic yet):
```js
window.electronAPI.onShortcutTriggered(() => {
  if (currentState === 'IDLE') {
    setState('RECORDING');
  } else if (currentState === 'RECORDING') {
    setState('THINKING');
    // F-SPEECH will replace this stub — Claude stub timeout
    setTimeout(() => setState('IDLE'), 2000);
  }
});
```

2. **Conflict notice listener**:
```js
window.electronAPI.onShortcutConflict(() => {
  document.getElementById('idle-conflict-notice').hidden = false;
});
```

3. **Error dismiss listener**:
```js
document.getElementById('state-error').addEventListener('click', () => {
  setState('IDLE');
});
```

4. **Boot sequence**:
```js
// Set mode label
document.getElementById('idle-mode-label').textContent =
  getMode().charAt(0).toUpperCase() + getMode().slice(1);

// Boot into IDLE (F-FIRST-RUN will later decide FIRST_RUN vs IDLE)
setState('IDLE');
```

**vibe/CODEBASE.md** — update all relevant sections:

- **State machine**: populate setState() description, list all 6 states with their IDs
- **Module-scope variables (in index.html)**: fill in the table
- **IPC channels**: add `resize-window` row
- **CSS design tokens**: verify still accurate
- Add **DOM element IDs** section: table of all key element IDs and which feature will use them
- Update "Last updated" date

**Acceptance criteria**:
- [ ] `npm start` → bar opens in IDLE state (44px), mode label shows "Balanced"
- [ ] ⌥Space (or ⌃\`) → IDLE→RECORDING state (red dot visible, bar 80px)
- [ ] ⌥Space again → RECORDING→THINKING state (spinner, bar 44px)
- [ ] After 2 seconds → THINKING→IDLE (stub timeout fires)
- [ ] DevTools: `setState('PROMPT_READY', { prompt: 'test prompt text' })` → bar 200px, text visible
- [ ] DevTools: `setState('ERROR', { message: 'test error' })` → bar 44px, error text visible, tap dismisses
- [ ] DevTools: `setState('FIRST_RUN')` → bar 120px, checklist structure visible
- [ ] CODEBASE.md updated with all new functions, IDs, IPC channel
- [ ] `npm run lint` passes

**Self-verify**: Run full manual smoke test from FEATURE_PLAN.md §5. Tick every conformance item in FEATURE_SPEC.md#10.
**Test requirement**: Full 8-step manual smoke test from FEATURE_PLAN.md. All must pass before commit.
**⚠️ Boundaries**: The shortcut listener stub MUST be replaced when F-SPEECH and F-CLAUDE are built. Log a comment `// F-SPEECH: replace stub` on the stub timeout line.
**CODEBASE.md update?**: Yes — update state machine, module vars, IPC, and add DOM IDs sections.
**Architecture compliance**: Event listeners set once at DOMContentLoaded. All DOM access by ID. setState() remains the only DOM mutation point.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: F-STATE (State machine + full UI skeleton)
> Tick after every task. All items ✅ before feature is shippable.

- [ ] All 6 states render correctly when called from DevTools console
- [ ] setState() is the only DOM mutation point — no other function sets visibility or classes
- [ ] All module-scope vars declared at top of script block
- [ ] All localStorage access goes through the 4 wrapper functions only
- [ ] Window resizes correctly on every state transition (verified by eye)
- [ ] IPC listeners for shortcut-triggered and shortcut-conflict wired and firing
- [ ] Mode label shows in IDLE on boot (correct mode from localStorage or default)
- [ ] `npm run lint` passes on main.js and preload.js
- [ ] Manual smoke test complete: launch → IDLE, shortcut → RECORDING, shortcut → THINKING, auto-idle, console states all verified
- [ ] CODEBASE.md updated: state machine section, module vars, IPC, DOM IDs
- [ ] ARCHITECTURE.md — no new patterns established (F-STATE follows existing)
- [ ] No `innerHTML` with dynamic content anywhere in this feature's code
