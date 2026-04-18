# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-18 (Phase 2 review fixes: BL-013/014/015/016/021/022/023)

---

## Current state

**Phase:** Phase 3 in progress — Phase 2 complete (reviewed 2026-04-18, score 6.4/10, 0 P0)
**Files written:** 7 source files + eslint.config.js

---

## File map

| File | Purpose | Key exports / functions |
|------|---------|------------------------|
| `package.json` | Electron + electron-builder config, npm scripts, devDeps only | scripts: start, dist, lint |
| `entitlements.plist` | Mic + JIT + hardened runtime entitlements for macOS distribution | — |
| `eslint.config.js` | ESLint 9 flat config for main.js and preload.js | — |
| `main.js` | Electron main: window + splashWin lifecycle, IPC handlers, PATH resolution, global shortcut | `createWindow()`, `resolveClaudePath()`, `registerShortcut()`, `claudePath`, `whisperPath`, `win`, `splashWin`, `SHORTCUT_PRIMARY`, `SHORTCUT_FALLBACK`, `PROMPT_TEMPLATE`, `MODE_CONFIG` |
| `preload.js` | contextBridge — exposes window.electronAPI to renderer and splash | `window.electronAPI` |
| `splash.html` | Launch-time CLI + mic checks before main bar shows — separate splashWin BrowserWindow | `runChecks()`, `setCheck()`, `showReady()`, `openInstall()` |
| `index.html` | Full UI: CSS tokens, all 5 state panels, state machine, boot sequence, IPC wire-up, action handlers (Copy flash, Edit/Done contenteditable, Regenerate), waveform animations | `setState()`, `getMode()`, `setMode()`, `getModeLabel()`, `startRecording()`, `stopRecording()`, `renderPromptOutput()`, `drawMorphWave()`, `stopMorphAnim()`, `drawRecordingWave()`, `startRecTimer()`, `stopRecTimer()`, `setRecordingTranscript()`, `STATE_HEIGHTS`, `STATES`, `MODES`, `state`, `originalTranscript`, `generatedPrompt`, `mediaRecorder`, `audioChunks`, `isProcessing`, `morphAnimFrame` |

---

## IPC channels (registered in main.js)

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | ✅ registered — spawn(claudePath, ['-p', systemPrompt]), transcript embedded in system prompt via PROMPT_TEMPLATE, returns { success, prompt, error } |
| `copy-to-clipboard` | renderer → main | ✅ registered — clipboard.writeText({ text }) → { success: true } |
| `check-claude-path` | renderer → main | ✅ registered — returns { found, path } or { found: false, error } |
| `resize-window` | renderer → main | ✅ registered — win.setSize(520, height, true) |
| `transcribe-audio` | renderer → main | ✅ registered — writes audio to tmpdir, runs Whisper CLI, returns { success, transcript, error } |
| `show-mode-menu` | renderer → main | ✅ registered — builds native Electron radio menu from MODE_CONFIG keys |
| `set-window-buttons-visible` | renderer → main | ✅ registered — win.setWindowButtonVisibility(visible); hidden during RECORDING |
| `splash-done` | renderer → main | ✅ registered — hides splashWin, shows win, calls registerShortcut() |
| `splash-check-cli` | renderer → main | ✅ registered — returns { ok: !!claudePath, path: claudePath } |
| `splash-open-url` | renderer → main | ✅ registered — shell.openExternal(url) if url starts with https:// |
| `request-mic` | renderer → main | ✅ registered — returns { ok: true } (no-op; mic checked in splash renderer) |
| `shortcut-triggered` | main → renderer | ✅ registered — fires on ⌥Space (or fallback) |
| `shortcut-conflict` | main → renderer | ✅ registered — fires if fallback used, sends { fallback } |
| `mode-selected` | main → renderer | ✅ registered — sent from show-mode-menu click handler with mode key |

---

## State machine (in index.html)

**Function:** `setState(newState, payload = {})`
- Calls `stopMorphAnim()` at entry — cancels any live morph RAF loop
- Hides all panels, shows active panel by ID
- Handles payload: `ERROR` → sets `error-message` textContent; `PROMPT_READY` → calls `renderPromptOutput(generatedPrompt)`
- Calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` wrapped in `requestAnimationFrame`

| State | Panel ID | Height | Notes |
|-------|----------|--------|-------|
| `IDLE` | `panel-idle` | 101px | Mode pill, shortcut hint |
| `RECORDING` | `panel-recording` | 89px | Waveform canvas, timer, dismiss/stop buttons; traffic lights hidden |
| `THINKING` | `panel-thinking` | 220–320px | Morph wave canvas, YOU SAID transcript; height clamped to transcript length |
| `PROMPT_READY` | `panel-ready` | 480px | Prompt output + action buttons |
| `ERROR` | `panel-error` | 101px | Error icon, message, tap-to-dismiss |

> Note: FIRST_RUN state removed from index.html — replaced by splash.html (D-007, FEATURE-001)

---

## Module-scope variables (in index.html)

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `state` | string | `setState()` | all features |
| `originalTranscript` | string | `stopRecording()` onstop handler — captured once, never mutated | `setState(THINKING)`, `setState(PROMPT_READY)`, Regenerate, Copy, Edit |
| `generatedPrompt` | string | `generate-prompt` IPC result; Edit Done handler | `renderPromptOutput()`, Copy, Regenerate display |
| `mediaRecorder` | MediaRecorder\|null | `startRecording()` | `stopRecording()`, dismiss handler |
| `audioChunks` | Blob[] | `startRecording()`, `ondataavailable` | `stopRecording()` onstop handler |
| `isProcessing` | boolean | `stopRecording()` start/end guard | `stopRecording()` early-exit guard |
| `morphAnimFrame` | number\|null | `setState(THINKING)` inline animMorph | `stopMorphAnim()` — cancelled at every setState() |
| `recSecs` | number | `startRecTimer()` / `stopRecTimer()` | timer display |
| `recTimer` | interval | `startRecTimer()` | `stopRecTimer()` |
| `waveT` | number | `startRecTimer()` animateWave | wave animation |
| `waveRAF` | number | `startRecTimer()` animateWave | `stopRecTimer()` |

---

## Module-scope variables (in main.js)

| Variable | Set when | Value |
|----------|----------|-------|
| `claudePath` | app-ready — `resolveClaudePath()` Promise | resolved binary path or null |
| `whisperPath` | app-ready — `exec('zsh -lc "which whisper"')` | resolved binary path or null |
| `win` | `createWindow()` called after `resolveClaudePath()` resolves | BrowserWindow instance |
| `splashWin` | `app.whenReady()` — created before `win`, destroyed after `splash-done` | BrowserWindow instance (null after splash) |
| `PROMPT_TEMPLATE` | module constant | Multi-line template string with `{MODE_NAME}`, `{MODE_INSTRUCTION}`, `{TRANSCRIPT}` placeholders — bypassed for standalone modes |
| `MODE_CONFIG` | module constant | `{ balanced, detailed, concise, chain, code, design }` — each `{ name, instruction }`; design has `standalone: true` which causes generate-prompt to use instruction directly instead of wrapping in PROMPT_TEMPLATE |

---

## CSS design tokens (in index.html)

```css
:root {
  --blue: #0A84FF;           /* action / interactive elements */
  --red: #FF3B30;            /* recording / stop */
  --green: #30D158;          /* success / copy flash */
  --font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  --bar-radius: 18px;
  --bar-backdrop: blur(40px) saturate(180%);
  --bar-shadow: 0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4);
  /* border tokens: --border-top, --border-left, --border-right, --border-bottom */
  /* gradient tokens: --highlight-top, --accent-bottom, --divider */
}
```

---

## localStorage keys

| Key | Written by | Read by | Notes |
|-----|-----------|---------|-------|
| `mode` | `setMode()` | `getMode()` — in boot, generate-prompt, regenerate | Default: `'balanced'` |

> `firstRunComplete` key removed — splash screen replaced in-bar first-run flow (D-007)

---

## DOM element IDs (in index.html)

| Element ID | Panel | Used by |
|------------|-------|---------|
| `bar` | root | `setState()` show/hide |
| `panel-idle` | IDLE | `setState()` |
| `panel-recording` | RECORDING | `setState()` |
| `panel-thinking` | THINKING | `setState()` |
| `panel-ready` | PROMPT_READY | `setState()` |
| `panel-error` | ERROR | `setState()` |
| `idle-area` | IDLE | click → `startRecording()` |
| `mode-pill` | IDLE | mode label display; click → `showModeMenu` |
| `recCanvas` | RECORDING | `drawRecordingWave()` |
| `recDur` | RECORDING | `startRecTimer()` |
| `dismissBtn` | RECORDING | click → cancel recording → IDLE |
| `stopBtn` | RECORDING | click → `stopRecording()` |
| `transcriptWrap` | RECORDING | `setRecordingTranscript()` |
| `transcriptText` | RECORDING | `setRecordingTranscript()` |
| `morph-canvas` | THINKING | `drawMorphWave()` RAF loop |
| `think-transcript` | THINKING | set in `stopRecording()` onstop + regenerate handler |
| `panel-thinking` | THINKING | `scrollHeight` measured for dynamic resize |
| `you-said-text` | PROMPT_READY | `setState(PROMPT_READY)` — sets `originalTranscript` |
| `prompt-output` | PROMPT_READY | `renderPromptOutput()`, Edit mode contenteditable |
| `btn-edit` | PROMPT_READY | Edit/Done toggle |
| `btn-copy` | PROMPT_READY | Copy + green flash |
| `btn-regenerate` | PROMPT_READY | → THINKING → PROMPT_READY |
| `btn-reset` | PROMPT_READY | → IDLE |
| `error-area` | ERROR | click → IDLE |
| `error-message` | ERROR | `setState(ERROR, { message })` |

---

## Smoke test results (Phase 2 complete)

- Full flow: speak → transcribe → generate → prompt ready ✅
- All 5 modes generate distinct structured prompts ✅
- Copy button: green flash 1.8s + clipboard ✅
- Edit: contenteditable, Escape cancels, Done saves ✅
- Regenerate: uses originalTranscript, not edited text ✅
- Splash screen: CLI check → mic check → auto-proceed ✅
- Vibrancy: frosted glass renders on macOS desktop ✅

---

## Known issues / watch items

- `eslint main.js preload.js` produces warnings for `console.log` (expected dev logs — clean before release)
- `index.html` is not included in the lint script (ESLint 9 cannot parse HTML without a plugin — inline JS reviewed manually; see D-001)
