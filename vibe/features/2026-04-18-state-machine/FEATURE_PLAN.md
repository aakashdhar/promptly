# FEATURE_PLAN — F-STATE: State machine + full UI skeleton
> Feature: F-STATE | Date: 2026-04-18 | Folder: vibe/features/2026-04-18-state-machine/

---

## 1. Impact map

### Files to modify

| File | Change type | Scope |
|------|------------|-------|
| `index.html` | Major rewrite | All JS (vars, wrappers, setState, listeners, boot) + full DOM + full CSS |
| `main.js` | Minor addition | Add `ipcMain.handle('resize-window', ...)` alongside existing handlers |
| `preload.js` | Minor addition | Add `resizeWindow: (height) => ipcRenderer.invoke('resize-window', { height })` |

### New files
None — all changes go into existing files per ARCHITECTURE.md single-file rule.

### Files explicitly out of scope (do not touch)

| File | Reason |
|------|--------|
| `package.json` | No new deps; no script changes |
| `entitlements.plist` | No new permissions |
| `eslint.config.js` | No linting changes |

---

## 2. Conventions to follow

From ARCHITECTURE.md:
- All elements accessed by `id` — no querySelector chains
- Event listeners set once at `DOMContentLoaded`
- No `innerHTML` with untrusted data — `textContent` for all user-supplied content
- All styles inline in `<style>` block inside `index.html` — no external stylesheets
- Design tokens via CSS custom properties only — no hardcoded hex values
- Transitions: `opacity 150ms ease` only — no transforms, bounces, slides
- `setState()` is the **only** function that mutates DOM state
- localStorage accessed only via `getMode()` / `setMode()` / `getFirstRunComplete()` / `setFirstRunComplete()`
- IPC channel names: kebab-case strings (`'resize-window'`)
- Constants: SCREAMING_SNAKE_CASE (`STATE_HEIGHTS`)
- Functions: camelCase (`setState`, `getMode`)

---

## 3. Task breakdown

**Build order:** JS foundation → DOM → CSS → resize IPC → boot + wire-up

### FST-001 · JS foundation (S)
Scope: JS block in index.html only
- Declare all 4 module-scope vars at top: `currentState`, `transcript`, `originalTranscript`, `generatedPrompt`
- Implement `getMode()`, `setMode()`, `getFirstRunComplete()`, `setFirstRunComplete()` wrappers
- Implement `STATE_HEIGHTS` constant
- Implement `setState(newState, payload)` — stub: sets `currentState`, console.logs state name
- No DOM manipulation yet (panels don't exist yet)

### FST-002 · DOM structure (M)
Scope: `<body>` in index.html only
- Write all 6 state panels inside `#app`, each with `hidden` attribute by default
- Apply all required IDs per FEATURE_SPEC.md §3 (DOM structure)
- setState() now hides all panels, shows active panel by id

### FST-003 · CSS styling (M)
Scope: `<style>` block in index.html only
- Full CSS for all 6 states
- Recording dot blink animation
- Thinking spinner animation
- Button styles (Copy, Edit, Regenerate, Done)
- Mode label pill
- Shortcut hint text
- Error icon + row layout
- FIRST_RUN checklist row layout
- All height values match STATE_HEIGHTS constants

### FST-004 · resize-window IPC (S)
Scope: main.js + preload.js only
- Add `ipcMain.handle('resize-window', (_event, { height }) => { win.setContentSize(480, height); return { ok: true }; })` in main.js
- Add `resizeWindow: (height) => ipcRenderer.invoke('resize-window', { height })` in preload.js contextBridge
- setState() updated to call `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` after DOM switch

### FST-005 · Boot + IPC wire-up + CODEBASE.md (S)
Scope: index.html script block + vibe/CODEBASE.md
- Wire `window.electronAPI.onShortcutTriggered()` listener: IDLE→RECORDING→THINKING→IDLE stub cycle
- Wire `window.electronAPI.onShortcutConflict()` listener: remove hidden from `#idle-conflict-notice`
- DOMContentLoaded → `setState('IDLE')` as default boot
- `#idle-mode-label` textContent set to `getMode()` on boot
- Manual smoke test all 6 states from console
- Update CODEBASE.md: new DOM IDs, new functions, new IPC channel

---

## 4. Rollback plan

All changes are additive to existing Phase 1 skeleton files. To rollback:
```bash
git revert HEAD~N  # revert individual FST-00x commits
```
Phase 1 code in main.js and preload.js is unaffected by this feature (only additions made).

---

## 5. Testing strategy

**Manual smoke test (per-task):**
1. `npm start` — app opens in IDLE state (44px)
2. DevTools console: `setState('RECORDING')` — bar expands to 80px, red dot visible
3. DevTools console: `setState('THINKING')` — spinner + text, bar at 44px
4. DevTools console: `setState('PROMPT_READY', { prompt: 'test' })` — bar expands to 200px, prompt visible
5. DevTools console: `setState('ERROR', { message: 'test error' })` — bar at 44px, error message shows
6. DevTools console: `setState('FIRST_RUN')` — bar at 120px, checklist structure visible
7. Press ⌥Space (or ⌃\`) — IDLE → RECORDING → THINKING → IDLE cycle
8. Mode label visible in IDLE shows 'Balanced' (default)

**Lint:** `npm run lint` — main.js + preload.js must pass clean.

**No unit tests needed** — pure DOM/CSS; manual smoke test is the v1 test suite per ARCHITECTURE.md.

---

## 6. CODEBASE.md sections to update

After FST-005 completes, update:
- **State machine** section: populate setState() description, list all 6 states
- **Module-scope variables (index.html)**: fill in the table (currentState, transcript, originalTranscript, generatedPrompt)
- **IPC channels**: add `resize-window` row (renderer → main)
- **DOM element IDs**: new section listing all key IDs and which feature they belong to
