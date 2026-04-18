# FEATURE_SPEC — F-STATE: State machine + full UI skeleton
> Feature: F-STATE | Date: 2026-04-18 | Folder: vibe/features/2026-04-18-state-machine/
> Dependencies: Phase 1 complete (✅) | Depended on by: ALL Phase 2 features

---

## 1. Feature overview

F-STATE establishes the complete in-memory state machine, all DOM structure, and all CSS styling for Promptly's 6-state floating bar. No actual speech, Claude, or clipboard logic is wired — this feature's job is to produce a correct, styled, navigable skeleton so that every subsequent feature has stable DOM targets, a working setState(), and the correct visual design from day one.

When F-STATE is complete, pressing shortcut toggles between IDLE and RECORDING (stub), and every state can be forced by calling `setState('STATE_NAME')` from the browser console. All 6 states look correct. Nothing is broken. No functionality from F-SPEECH, F-CLAUDE, or F-ACTIONS yet.

---

## 2. User stories

- **Dev verification:** As a developer, I can call `setState('PROMPT_READY')` in the DevTools console and see the fully styled prompt-ready bar, so I can verify each state's UI in isolation before wiring real functionality.
- **Initial render:** As a user launching the app for the first time (after first-run is complete), the bar appears in IDLE state immediately — compact, styled, with mode label and shortcut hint visible.
- **State identity:** As a user, every state looks visually distinct — I can immediately tell what the app is doing from the bar's appearance.

---

## 3. Acceptance criteria

### State machine
- [ ] `currentState` module-scope variable holds the active state name string
- [ ] `setState(newState, payload)` is the **only** function that mutates DOM state
- [ ] All 4 module-scope vars declared: `currentState`, `transcript`, `originalTranscript`, `generatedPrompt`
- [ ] `getMode()` / `setMode()` / `getFirstRunComplete()` / `setFirstRunComplete()` localStorage wrappers implemented — no direct `localStorage.*` calls outside these
- [ ] Calling `setState('IDLE')` in console → bar shows IDLE state correctly
- [ ] Calling `setState('RECORDING')` in console → bar shows RECORDING state correctly
- [ ] Calling `setState('THINKING')` in console → bar shows THINKING state correctly
- [ ] Calling `setState('PROMPT_READY', { prompt: 'test prompt' })` in console → bar shows PROMPT_READY with text
- [ ] Calling `setState('ERROR', { message: 'Test error' })` in console → bar shows ERROR with message
- [ ] Calling `setState('FIRST_RUN')` in console → bar shows FIRST_RUN checklist structure

### DOM structure
- [ ] All 6 state panels exist in `#app` with IDs: `state-idle`, `state-recording`, `state-thinking`, `state-prompt-ready`, `state-error`, `state-first-run`
- [ ] All state panels use `hidden` attribute — only active state's panel is visible at any time
- [ ] All interactive elements in PROMPT_READY have IDs: `#prompt-output`, `#action-copy`, `#action-edit`, `#action-regenerate`, `#action-done`
- [ ] All interactive elements in ERROR have IDs: `#error-message`
- [ ] All interactive elements in IDLE have IDs: `#idle-mode-label`, `#idle-shortcut-hint`, `#idle-conflict-notice`
- [ ] All interactive elements in RECORDING have IDs: `#recording-dot`, `#recording-transcript`, `#recording-stop-hint`
- [ ] All interactive elements in FIRST_RUN have IDs: `#firstrun-cli-status`, `#firstrun-mic-btn`

### CSS and visual design
- [ ] Bar height is state-dependent: IDLE=44px, RECORDING=80px, THINKING=44px, PROMPT_READY=200px, ERROR=44px, FIRST_RUN=120px
- [ ] Design tokens only — no hardcoded hex values outside `:root` block
- [ ] System font applied to all elements: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif`
- [ ] IDLE: compact single row — mode label pill (left), shortcut hint text (centre)
- [ ] IDLE conflict notice: `#idle-conflict-notice` renders the text "Shortcut ⌥Space taken — using ⌃\`" (hidden by default, shown by IPC event)
- [ ] RECORDING: red dot (blinking animation) left, live transcript area centre, stop hint right
- [ ] THINKING: spinner centred with "Generating prompt…" text below
- [ ] PROMPT_READY: prompt text scrollable area, action row below (Copy / Edit / Regenerate)
- [ ] PROMPT_READY edit mode: `#action-done` button hidden by default; visible when editing
- [ ] ERROR: single row — error icon left, `#error-message` text, "Tap to dismiss" hint right
- [ ] FIRST_RUN: two-row checklist structure (CLI row + mic row), slightly taller than IDLE
- [ ] All opacity transitions: `150ms ease` — no transforms, bounces, or slides
- [ ] Recording dot blinks via CSS `animation: blink 1s ease-in-out infinite`
- [ ] Spinner uses CSS `animation: spin 0.8s linear infinite`

### Window resize
- [ ] A new `resize-window` IPC channel is registered in `main.js` — accepts `{ height }`, calls `win.setContentSize(480, height)`
- [ ] `window.electronAPI.resizeWindow(height)` exposed in `preload.js`
- [ ] `setState()` calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` after every transition
- [ ] `STATE_HEIGHTS` constant defined: `{ FIRST_RUN: 120, IDLE: 44, RECORDING: 80, THINKING: 44, PROMPT_READY: 200, ERROR: 44 }`

### IPC listeners
- [ ] `onShortcutTriggered` listener wired: IDLE → RECORDING (stub), RECORDING → THINKING (stub); shortcut during THINKING is ignored — THINKING exits only via a 2-second stub setTimeout per SPEC.md "no cancel in v1"
- [ ] `onShortcutConflict` listener wired: sets `#idle-conflict-notice` text and removes `hidden`

### Boot sequence
- [ ] On `DOMContentLoaded`, app calls `setState('IDLE')` as the default start state
- [ ] `getMode()` defaults to `'balanced'` if key absent in localStorage
- [ ] `#idle-mode-label` shows the current mode on boot

---

## 4. Scope boundaries

### Included
- All 6 state DOM panels and full CSS styling
- `setState()` function with state switching + window resize
- Module-scope variables (all 4)
- localStorage wrappers (all 4 functions)
- IPC listener wires for shortcut-triggered and shortcut-conflict
- Stub state transitions on shortcut (IDLE→RECORDING→THINKING→IDLE cycle, no real logic)
- Window resize IPC channel (new — see §7)
- Boot sequence: DOMContentLoaded → setState('IDLE')
- Mode label display in IDLE

### Explicitly deferred (belongs to later features)
- Real speech recording (F-SPEECH)
- Real Claude CLI call (F-CLAUDE)
- Mode right-click context menu (F-CLAUDE)
- Copy, Edit, Regenerate button functionality (F-ACTIONS)
- First-run checklist logic — CLI check, mic permission button (F-FIRST-RUN)
- Error messages from real failures (F-SPEECH, F-CLAUDE)
- Deciding FIRST_RUN vs IDLE on boot (F-FIRST-RUN)

---

## 5. Integration points

| Consumer | What it reads | Set by this feature |
|----------|--------------|-------------------|
| F-FIRST-RUN | `setState()`, `#state-first-run`, `#firstrun-cli-status`, `#firstrun-mic-btn`, `getFirstRunComplete()`, `setFirstRunComplete()` | ✅ all created here |
| F-SPEECH | `setState()`, `currentState`, `#recording-transcript`, `originalTranscript`, `transcript` | ✅ all created here |
| F-CLAUDE | `setState()`, `currentState`, `originalTranscript`, `generatedPrompt`, `getMode()`, `#prompt-output`, `#thinking-spinner` | ✅ all created here |
| F-ACTIONS | `setState()`, `generatedPrompt`, `originalTranscript`, `#prompt-output`, `#action-copy`, `#action-edit`, `#action-regenerate`, `#action-done` | ✅ all created here |

**Files in scope:**
- `index.html` — primary: all JS + DOM + CSS
- `main.js` — minor: add `resize-window` IPC handler
- `preload.js` — minor: expose `resizeWindow` in contextBridge

**Spec references:**
- States: SPEC.md#ui-specification (screens/states section)
- Data model: SPEC.md#data-model
- IPC surface: SPEC.md#ipc-surface

---

## 6. New data model

No new persistent data. This feature establishes the in-memory model from SPEC.md:

| Variable | Scope | Initial value | Notes |
|----------|-------|--------------|-------|
| `currentState` | module (index.html) | `'IDLE'` (set by setState on boot) | Only written by setState() |
| `transcript` | module (index.html) | `''` | Written by F-SPEECH |
| `originalTranscript` | module (index.html) | `''` | Written once by F-SPEECH at stop |
| `generatedPrompt` | module (index.html) | `''` | Written by F-CLAUDE |

localStorage wrappers established (keys used by later features):

| Function | Key | Default |
|----------|-----|---------|
| `getMode()` | `mode` | `'balanced'` |
| `setMode(value)` | `mode` | — |
| `getFirstRunComplete()` | `firstRunComplete` | `false` |
| `setFirstRunComplete(value)` | `firstRunComplete` | — |

---

## 7. New IPC channel — resize-window

⚠️ **This adds one IPC channel not in the original spec.** Per ARCHITECTURE.md, this requires explicit flagging.

**Why it's needed:** The spec states bar height varies by state (44px idle, ~120px recording/prompt-ready). Electron windows cannot be resized from the renderer without a main-process call. There is no Web API equivalent for native window resizing. The window must call `win.setContentSize()` from main.

**Why not alternatives:**
- Fixed large height: leaves dead transparent space below the bar — looks broken, partially covers content beneath
- CSS-only clip: window bounds remain large even if content appears smaller — same problem
- Making window very tall + transparent: `transparent: true` in BrowserWindow has rendering side-effects and is a larger change

**Implementation:**

```js
// main.js — add alongside existing IPC handlers
ipcMain.handle('resize-window', (_event, { height }) => {
  win.setContentSize(480, height);
  return { ok: true };
});

// preload.js — add to contextBridge object
resizeWindow: (height) => ipcRenderer.invoke('resize-window', { height }),
```

---

## 8. Edge cases and error states

| Scenario | Handling |
|----------|----------|
| setState called with unknown state name | console.error, no DOM change (defensive guard) |
| getMode() — localStorage unavailable | catch and return `'balanced'` default |
| resizeWindow IPC fails | setState still completes; window stays at previous height |
| shortcut-triggered fires during THINKING | ignored (no transition — THINKING has no shortcut action) |
| shortcut-conflict fires after IDLE already shown | sets #idle-conflict-notice text; idempotent |

---

## 9. Non-functional requirements

- **Transition speed:** state switch (including window resize) must feel instant — < 50ms perceived
- **No jank:** opacity-only transitions (150ms ease); no layout thrash
- **Console-callable:** any developer can call setState() from DevTools during Phase 2 build
- **Linter:** index.html JS reviewed manually; main.js + preload.js must pass `npm run lint`

---

## 10. Conformance checklist

What must be true for F-STATE to be shippable:

- [ ] All 6 states render correctly when called from DevTools console
- [ ] setState() is the only DOM mutation point — no other function touches visibility or classes
- [ ] All module-scope vars declared at top of script block
- [ ] All localStorage access goes through wrapper functions
- [ ] Window resizes correctly for each state transition
- [ ] IPC listeners for shortcut-triggered and shortcut-conflict wired and firing
- [ ] `#idle-mode-label` shows mode capitalised on boot (first letter only): 'Balanced', 'Detailed', 'Concise', 'Chain', 'Code'
- [ ] Lint passes on main.js and preload.js
- [ ] Manual smoke test: launch → IDLE state, try shortcut → RECORDING state, try shortcut → THINKING → IDLE cycle
- [ ] CODEBASE.md updated to reflect new DOM IDs, functions, IPC channel
