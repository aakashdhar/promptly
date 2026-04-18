# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-18 (P1-009 — Phase 1 complete, smoke test passed)

---

## Current state

**Phase:** Phase 1 — complete (all P1-001 through P1-009 done)
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
| `index.html` | Entire UI: CSS tokens, #app container, DOMContentLoaded stub | `#app` |

---

## IPC channels (registered in main.js)

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | ✅ stubbed — returns placeholder string |
| `copy-to-clipboard` | renderer → main | ✅ stubbed — uses clipboard.writeText |
| `check-claude-path` | renderer → main | ✅ stubbed — returns claudePath or error |
| `shortcut-triggered` | main → renderer | ✅ registered — fires on ⌥Space (or fallback) |
| `shortcut-conflict` | main → renderer | ✅ registered — fires on did-finish-load if fallback used |

---

## State machine (in index.html)

*Populated when F-STATE feature completes.*

States: FIRST_RUN · IDLE · RECORDING · THINKING · PROMPT_READY · ERROR
setState() function: — not yet written —

---

## Module-scope variables (in index.html)

*Populated when F-STATE feature completes.*

| Variable | Set by | Read by |
|----------|--------|---------|
| `currentState` | setState() | all features |
| `transcript` | F-SPEECH | F-CLAUDE |
| `originalTranscript` | F-SPEECH | F-CLAUDE, F-ACTIONS |
| `generatedPrompt` | F-CLAUDE | F-ACTIONS |

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
| `mode` | setMode() in F-CLAUDE | getMode() in F-CLAUDE, F-ACTIONS |
| `firstRunComplete` | F-FIRST-RUN | F-FIRST-RUN check at startup |

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
