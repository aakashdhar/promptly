# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-18 (FST-005 — boot sequence, IPC wire-up, setState resize call)

---

## Current state

**Phase:** Phase 2 in progress — F-STATE (4/5 tasks done)
**Files written:** 6 source files + eslint.config.js

---

## File map

| File | Purpose | Key exports / functions |
|------|---------|------------------------|
| `package.json` | Electron + electron-builder config, npm scripts, devDeps only | scripts: start, dist, lint |
| `entitlements.plist` | Mic + JIT + hardened runtime entitlements for macOS distribution | — |
| `eslint.config.js` | ESLint 9 flat config for main.js and preload.js | — |
| `main.js` | Electron main: window, IPC handlers, PATH resolution, global shortcut | `createWindow()`, `claudePath`, `win`, `SHORTCUT_PRIMARY`, `SHORTCUT_FALLBACK` |
| `preload.js` | contextBridge — exposes window.electronAPI to renderer | `window.electronAPI` |
| `index.html` | Full UI: CSS tokens, all 6 state panels, state machine, boot sequence, IPC wire-up | `setState()`, `getMode()`, `setMode()`, `getFirstRunComplete()`, `setFirstRunComplete()`, `STATE_HEIGHTS`, `currentState`, `transcript`, `originalTranscript`, `generatedPrompt` |

---

## IPC channels (registered in main.js)

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | ✅ stubbed — returns placeholder string |
| `copy-to-clipboard` | renderer → main | ✅ stubbed — uses clipboard.writeText |
| `check-claude-path` | renderer → main | ✅ stubbed — returns claudePath or error |
| `resize-window` | renderer → main | ✅ registered — resizes BrowserWindow to given height |
| `shortcut-triggered` | main → renderer | ✅ registered — fires on ⌥Space (or fallback) |
| `shortcut-conflict` | main → renderer | ✅ registered — fires on did-finish-load if fallback used |

---

## State machine (in index.html)

**Function:** `setState(newState, payload = {})`
- Guards against unknown states via `STATE_HEIGHTS` lookup
- Sets `currentState`
- Hides all panels, shows active panel by ID
- Handles payload: `ERROR` → sets `error-message` textContent; `PROMPT_READY` → sets `prompt-output` textContent
- Calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` if available

| State | Panel ID | Height | Notes |
|-------|----------|--------|-------|
| `FIRST_RUN` | `state-first-run` | 120px | CLI check + mic button |
| `IDLE` | `state-idle` | 44px | Mode pill, shortcut hint, conflict notice |
| `RECORDING` | `state-recording` | 80px | Blinking dot, live transcript, stop hint |
| `THINKING` | `state-thinking` | 44px | Spinner + "Generating prompt…" |
| `PROMPT_READY` | `state-prompt-ready` | 200px | Prompt output + action buttons |
| `ERROR` | `state-error` | 44px | Error icon, message, dismiss hint (click to dismiss) |

---

## Module-scope variables (in index.html)

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `currentState` | string | `setState()` | all features |
| `transcript` | string | F-SPEECH (live updates) | F-CLAUDE |
| `originalTranscript` | string | F-SPEECH (captured once on stop) | F-CLAUDE, F-ACTIONS |
| `generatedPrompt` | string | F-CLAUDE | F-ACTIONS |

---

## Module-scope variables (in main.js)

| Variable | Set when | Value |
|----------|----------|-------|
| `claudePath` | app-ready PATH resolution via `exec('zsh -lc "which claude"')` | resolved at runtime |
| `win` | createWindow() called in whenReady | BrowserWindow instance |

---

## CSS design tokens (in index.html)

```css
:root {
  --color-action: #007AFF;
  --color-recording: #FF3B30;
  --color-success: #34C759;
  --bg-window: rgba(255, 255, 255, 0.85);
  --radius-window: 14px;
  --radius-inner: 8px;
}
```

---

## localStorage keys

| Key | Written by | Read by |
|-----|-----------|---------|
| `mode` | setMode() in F-CLAUDE | getMode() in F-CLAUDE, F-ACTIONS, boot sequence |
| `firstRunComplete` | F-FIRST-RUN | F-FIRST-RUN check at startup |

---

## DOM element IDs (in index.html)

| Element ID | Panel | Used by |
|------------|-------|---------|
| `idle-mode-label` | IDLE | FST-005 (boot label), F-CLAUDE (mode display) |
| `idle-shortcut-hint` | IDLE | display only |
| `idle-conflict-notice` | IDLE | FST-005 (shortcut conflict) |
| `recording-dot` | RECORDING | F-SPEECH (animation start/stop) |
| `recording-transcript` | RECORDING | F-SPEECH (live transcript) |
| `recording-stop-hint` | RECORDING | display only |
| `thinking-spinner` | THINKING | display only |
| `thinking-text` | THINKING | display only |
| `prompt-output` | PROMPT_READY | F-CLAUDE (set text), F-ACTIONS (edit mode) |
| `action-copy` | PROMPT_READY | F-ACTIONS |
| `action-edit` | PROMPT_READY | F-ACTIONS |
| `action-done` | PROMPT_READY | F-ACTIONS |
| `action-regenerate` | PROMPT_READY | F-ACTIONS |
| `error-message` | ERROR | setState() (set via payload.message) |
| `firstrun-cli-status` | FIRST_RUN | F-FIRST-RUN |
| `firstrun-mic-btn` | FIRST_RUN | F-FIRST-RUN |

---

## Smoke test results (P1-009)

- `npm start` opens frameless 480px window ✅
- `claudePath` resolved to `/Users/aakash-anon/.local/bin/claude` and logged ✅
- `Alt+Space` shortcut registered and logged ✅
- No console errors ✅

---

## Known issues / watch items

- `eslint main.js preload.js` produces warnings for `console.log` (expected dev logs — clean before release)
- `index.html` is not included in the lint script (ESLint 9 cannot parse HTML without a plugin — inline JS reviewed manually)
