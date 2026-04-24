# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-23

---

## Current state

**Phase:** All features complete — React migration mainlined, deploy gate unlocked (2026-04-24)
**Files written:** 7 source files + eslint.config.js + 19 React renderer files

---

## File map

| File | Purpose | Key exports / functions |
|------|---------|------------------------|
| `package.json` | Electron + electron-builder config, npm scripts (start, dev, build:renderer, start:react, dist, lint), devDeps only | — |
| `entitlements.plist` | Mic + JIT + hardened runtime entitlements for macOS distribution | — |
| `eslint.config.js` | ESLint 9 flat config for main.js and preload.js | — |
| `vite.config.js` | Vite build config — root: src/renderer, outDir: dist-renderer/, base: './', plugins: react() + tailwindcss() | — |
| `main.js` | Electron main: window + splashWin lifecycle, IPC handlers, PATH resolution, global shortcut, menu bar icon. Loads React build (NODE_ENV=development → localhost:5173, else dist-renderer/index.html). Both BrowserWindows use `transparent:false, backgroundColor:'#0A0A14'` — no vibrancy. MODE_CONFIG has 8 modes total (adds polish). | `createWindow()`, `resolveClaudePath()`, `resolveWhisperPath()`, `registerShortcut()`, `buildTrayMenu()`, `updateTrayMenu()`, `handleUninstall()`, `crc32()`, `pngEncode()`, `createMicIcon()`, `createMenuBarIcon()`, `claudePath`, `whisperPath`, `win`, `splashWin`, `tray`, `menuBarTray`, `pulseInterval`, `lastGeneratedPrompt`, `SHORTCUT_PRIMARY`, `SHORTCUT_FALLBACK`, `PROMPT_TEMPLATE`, `MODE_CONFIG` |
| `preload.js` | contextBridge — exposes window.electronAPI to renderer and splash | `window.electronAPI` — includes `generatePrompt(transcript, mode, options?)`, `generateRaw`, `copyToClipboard`, `checkClaudePath`, `resizeWindow`, `transcribeAudio`, `showModeMenu`, `setWindowButtonsVisible`, `saveFile`, `resizeWindowWidth`, `setWindowSize`, `onShortcutTriggered`, `onModeSelected`, `getTheme`, `onThemeChanged`, `onShowShortcuts`, `onShowHistory`, `onShortcutPause`, `updateMenuBarState(state)`, `setLastPrompt(prompt)` |
| `splash.html` | Launch-time CLI + mic checks before main bar shows — separate splashWin BrowserWindow (vanilla HTML, independent of React). Background: `linear-gradient(135deg, #0A0A14 → #0D0A18 → #0A0A14)` + blue/purple ambient glow divs. | `runChecks()`, `setCheck()`, `showReady()`, `openInstall()` |
| `index.html` | Legacy vanilla JS renderer — stays on main branch; replaced by React build on feat/react-migration | (see pre-migration codebase) |
| `src/renderer/index.html` | Vite HTML entry point — `<div id="root">` + module script | — |
| `src/renderer/index.css` | Tailwind v4 entry — `@import "tailwindcss"`, @theme (color/font/animation tokens), @keyframes, body reset (`background: #0A0A14`), scrollbar utilities | — |
| `src/renderer/main.jsx` | React root — imports index.css, `ReactDOM.createRoot().render(<App />)` | — |
| `src/renderer/App.jsx` | State machine root — all states, IPC wiring, theme, iteration flow, history, polish mode. Recording and keyboard concerns delegated to hooks. Bar container: `linear-gradient(135deg, #0A0A14 → #0D0A18)`. | `STATES`, `STATE_HEIGHTS`, `transition()`, `handleGenerateResult()` (unified polish/non-polish result handler — called by handleTypingSubmit, handleRegenerate, and via `handleGenerateResultRef` by useRecording), `handleRegenerate()`, `handleIterate()`, `stopIterating()`, `dismissIterating()`, `openHistory()` / `closeHistory()` (call setWindowSize + setWindowButtonsVisible + updateMenuBarState + animateToState directly — bypass transition() to allow non-standard window width). Refs: `transitionRef`, `handleGenerateResultRef`, `iterationBase`, `isIterated`, `iterRecorderRef`, `iterChunksRef`, `iterIsProcessingRef`. Theme: getTheme + onThemeChanged useEffect with cleanup. |
| `src/renderer/hooks/useMode.js` | Mode localStorage wrapper hook | `useMode()` → `{ mode, setMode, modeLabel }` |
| `src/renderer/hooks/useTone.js` | Polish tone localStorage wrapper — `promptly_polish_tone` key, default `'formal'` | `getPolishTone()`, `setPolishTone()`, `usePolishTone()` → `{ tone, setTone }` |
| `src/renderer/hooks/usePolishMode.js` | Polish flow hook — owns polishResult, copied, tone state, polishToneRef, handlePolishToneChange | `parsePolishOutput(raw)` (named export), `usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES })` → `{ polishResult, setPolishResult, copied, setCopied, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange }` |
| `src/renderer/hooks/useWindowResize.js` | resizeWindow IPC wrapper hook | `useWindowResize()` → `{ resizeWindow }` |
| `src/renderer/hooks/useRecording.js` | Recording state + callbacks hook — owns mediaRecorderRef, audioChunksRef, isProcessingRef, isPausedRef, recTimerRef, recSecs. Params: `{ STATES, transitionRef, modeRef, polishToneRef, setThinkTranscript, onGenerateResult, isIterated, originalTranscript }` — `onGenerateResult` is a ref to App.jsx's `handleGenerateResult(genResult, transcript)` callback (replaces old `setGeneratedPrompt` + `setPolishResult` params) | Returns: `{ recSecs, startRecording, stopRecording, handleDismiss, pauseRecording, resumeRecording, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, startTimer, stopTimer }` |
| `src/renderer/hooks/useKeyboardShortcuts.js` | IPC shortcut listeners + keydown handler hook. Params: `{ STATES, stateRef, prevStateRef, generatedPromptRef, modeRef, transitionRef, setMode, setPolishToneValue, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, openHistory, closeHistory, openSettings, closeSettings }` | Returns nothing (side-effects only) |
| `src/renderer/components/IdleState.jsx` | IDLE panel — pulse ring, mode pill, click-to-record | — |
| `src/renderer/components/RecordingState.jsx` | RECORDING panel — dismiss, waveform, timer, pause (amber ⏸), stop | props: onStop, onDismiss, onPause, duration |
| `src/renderer/components/PausedState.jsx` | PAUSED panel — dismiss, flat amber line, amber timer, resume (▶), stop, status text | props: duration, onResume, onStop, onDismiss |
| `src/renderer/components/IteratingState.jsx` | ITERATING state panel — blue context banner showing previous transcript, blue animated waveform (RAF loop with cleanup), timer, blue glow stop button (iterGlow). All styles inline. | props: contextText, duration, onStop, onDismiss |
| `src/renderer/components/TypingState.jsx` | TYPING state panel — textarea, ⌘↵ submit, × dismiss, switch-to-voice, dynamic height 220–320px. All styles inline. | props: onDismiss, onSubmit, resizeWindow |
| `src/renderer/components/PolishReadyState.jsx` | POLISH mode PROMPT_READY panel — polished text + change notes + tone toggle + copy. All styles inline. | props: `polished`, `changes`, `transcript`, `tone`, `onReset`, `onCopy`, `copied`, `onToneChange` |
| `src/renderer/components/WaveformCanvas.jsx` | Red sine-wave canvas — RAF loop with cleanup | — |
| `src/renderer/components/ThinkingState.jsx` | THINKING panel — status badge, morph wave, YOU SAID | — |
| `src/renderer/components/MorphCanvas.jsx` | Blue breathing-wave canvas — RAF loop with cleanup | — |
| `src/renderer/components/PromptReadyState.jsx` | PROMPT_READY panel — copy flash, edit/done, regenerate, reset, direct .md export (handleExport), ⌘E via export-prompt event | `renderPromptOutput()`, `handleExport()` |
| `src/renderer/components/ErrorState.jsx` | ERROR panel — error badge + tap-to-dismiss | — |
| `src/renderer/components/ShortcutsPanel.jsx` | SHORTCUTS panel — 8 shortcut rows with key chips, Done button (returns to prevState). px-[28px] padding, WebkitAppRegion: no-drag | — |
| `src/renderer/components/SettingsPanel.jsx` | SETTINGS panel — path configuration UI for Claude + Whisper binary paths; browse (file picker), recheck (re-resolve), save; 128 lines, all styles inline | props: `onClose` |
| `src/renderer/utils/history.js` | History localStorage utilities — all history access goes through this module | `saveToHistory`, `getHistory`, `deleteHistoryItem`, `clearHistory`, `searchHistory`, `formatTime` |
| `src/renderer/components/HistoryPanel.jsx` | HISTORY state panel — split-panel history UI; full inline styles (no Tailwind); left 240px scrollable list with search + per-entry delete, right flex:1 scrollable prompt detail with copy + reuse actions | props: `onClose`, `onReuse` |
| ~~`src/renderer/styles/tokens.css`~~ | ~~CSS custom properties (:root) + body.light overrides~~ | deleted — FEATURE-005 |
| ~~`src/renderer/styles/bar.css`~~ | ~~.bar glass container + ::before tint + ::after accent~~ | deleted — FEATURE-005 |
| ~~`src/renderer/styles/states.css`~~ | ~~All per-state layout CSS + @keyframes~~ | deleted — FEATURE-005 |
| `dist-renderer/` | Built React renderer output — loaded by Electron in production | — |

---

## IPC channels (registered in main.js)

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | ✅ registered — spawn(claudePath, ['-p', systemPrompt]), transcript embedded in system prompt via PROMPT_TEMPLATE, returns { success, prompt, error }. Accepts optional `options.tone` for polish mode — used to replace `{TONE}` placeholder in polish system prompt. |
| `generate-raw` | renderer → main | ✅ registered — spawn(claudePath, ['-p', systemPrompt]), full system prompt passed from renderer (no MODE_CONFIG); used by iteration flow. Returns { success, prompt, error } |
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
| `get-theme` | renderer → main | ✅ registered — returns { dark: boolean } for current macOS appearance |
| `theme-changed` | main → renderer | ✅ registered — sent by nativeTheme.on('updated') with { dark: boolean } |
| `show-shortcuts` | main → renderer | ✅ registered — sent by CommandOrControl+Shift+/ global shortcut or "Keyboard shortcuts ⌘?" context menu item |
| `shortcut-pause` | main → renderer | ✅ registered — sent by Alt+P global shortcut; wired in App.jsx via onShortcutPause — toggles pause/resume |
| `save-file` | renderer → main | ✅ registered — dialog.showSaveDialog + fs.writeFileSync; returns `{ ok, filePath }` or `{ ok: false }` |
| `resize-window-width` | renderer → main | ✅ registered — win.setSize(width, h, true) with setResizable guards |
| `set-window-size` | renderer → main | ✅ registered — win.setMinimumSize + setMaximumSize + setSize(width, height) atomically; used by openHistory/closeHistory to avoid race condition between separate width/height calls |
| `show-history` | main → renderer | ✅ registered — sent by "History ⌘H" context menu item |
| `uninstall-promptly` | renderer → main | ✅ registered — shows native confirmation dialog, removes all data dirs + TCC, quits app; also called from tray menu via handleUninstall() |
| `get-stored-paths` | renderer → main | ✅ registered — returns { claudePath, whisperPath } from config.json (userData) |
| `save-paths` | renderer → main | ✅ registered — saves { claudePath, whisperPath } to config.json and updates runtime vars |
| `browse-for-binary` | renderer → main | ✅ registered — opens macOS file picker (openFile), returns { path } or { path: null } |
| `recheck-paths` | renderer → main | ✅ registered — reruns resolveClaudePath + resolveWhisperPath, returns { claude: { ok, path }, whisper: { ok, path } } |
| `open-settings` | main → renderer | ✅ registered — sent by tray "Path configuration..." item and ⌘, shortcut; stub console.log in App.jsx |
| `update-menubar-state` | renderer → main | ✅ registered — maps STATES enum string → icon state (idle/recording/thinking/ready); calls `updateMenuBarIcon()` which sets tooltip + pulse interval (600ms) for recording/thinking, steady image for idle/ready |
| `set-last-prompt` | renderer → main | ✅ registered — stores prompt string in `lastGeneratedPrompt` module var; called after every successful generation; used by "Copy last prompt" tray menu item (FEATURE-018) |

---

## State machine (in index.html)

**Function:** `setState(newState, payload = {})`
- Calls `stopMorphAnim()` at entry — cancels any live morph RAF loop
- Hides all panels, shows active panel by ID
- Handles payload: `ERROR` → sets `error-message` textContent; `PROMPT_READY` → calls `renderPromptOutput(generatedPrompt)`
- Calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` wrapped in `requestAnimationFrame`

| State | Panel ID | Height | Notes |
|-------|----------|--------|-------|
| `IDLE` | `panel-idle` | 101px | Mode pill, shortcut hint, ⌘? hint |
| `RECORDING` | `panel-recording` | 89px | Waveform canvas, timer, dismiss/pause/stop buttons; traffic lights hidden |
| `PAUSED` | PausedState | 89px | Flat amber line, amber timer, resume+stop buttons; traffic lights hidden; status "Paused — tap resume to continue" |
| `ITERATING` | IteratingState | 200px | Blue context banner + blue waveform + timer + blue stop; traffic lights hidden; separate iter MediaRecorder from main recording |
| `TYPING` | TypingState | 244–320px | h-[28px] traffic light spacer; textarea + submit button; dynamic height: 244 + floor(lines/4)×40, max 320; traffic lights visible |
| `THINKING` | `panel-thinking` | 220–320px | Morph wave canvas, YOU SAID transcript; height clamped to transcript length |
| `PROMPT_READY` | `panel-ready` | 560px | Prompt output + action buttons (Edit, Copy prompt). Export button in top row → direct .md save |
| `ERROR` | `panel-error` | 101px | Error icon, message, tap-to-dismiss |
| `HISTORY` | HistoryPanel | 720px | Split-panel history; window width 746px; setWindowSize(746,720) + updateMenuBarState(HISTORY) called in openHistory; closeHistory → setWindowSize(520, IDLE height) + updateMenuBarState(IDLE) → IDLE |
| `SHORTCUTS` | ShortcutsPanel | 380px | 8 shortcuts with key chips; Done → previous state; triggered via ⌘? or context menu |
| `SETTINGS` | SettingsPanel | 322px | Path configuration panel — Claude + Whisper binary paths, browse + recheck; triggered via ⌘, or tray "Path configuration..." |

> Note: FIRST_RUN state removed from index.html — replaced by splash.html (D-007, FEATURE-001)

---

## React state + refs (in App.jsx) — FEATURE-004

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `currentState` | useState string | `transition()` | all components (conditional render) |
| `generatedPrompt` | useState string | stopRecording onstop, handleRegenerate | PromptReadyState |
| `errorMessage` | useState string | `transition(ERROR, {message})` | ErrorState |
| `thinkTranscript` | useState string | stopRecording, handleRegenerate | ThinkingState |
| `originalTranscript` | useRef string | stopRecording onstop — set ONCE, never mutated | PromptReadyState, handleRegenerate |
| `stateRef` | useRef string | mirrors currentState — stale-closure-safe for IPC handlers | onShortcutTriggered callback, onShowShortcuts callback, keydown listener |
| `prevStateRef` | useRef string | state before SHORTCUTS or HISTORY transition — for Done/Close button return | ShortcutsPanel onClose handler, HistoryPanel onClose handler |
| `generatedPromptRef` | useRef string | mirrors generatedPrompt — stale-closure-safe for keydown listener | ⌘C handler |
| `mediaRecorderRef` | useRef MediaRecorder\|null | startRecording, handleDismiss | stopRecording, handleDismiss, pauseRecording, resumeRecording |
| `audioChunksRef` | useRef Blob[] | startRecording ondataavailable | stopRecording onstop |
| `isProcessingRef` | useRef boolean | stopRecording start/end guard | stopRecording early-exit guard |
| `isPausedRef` | useRef boolean | pauseRecording/resumeRecording/handleDismiss | guard |
| `recTimerRef` | useRef interval\|null | startTimer/pauseTimer/stopTimer | cleared on pause/stop/dismiss |
| `recSecs` | useState number | startTimer interval | duration formatting for RecordingState + PausedState |
| `iterationBase` | useRef {transcript,prompt,mode}\|null | handleIterate — set when user taps ↻ Iterate | stopIterating — reads .prompt and .mode for system prompt |
| `isIterated` | useRef boolean | stopIterating (true on success); stopRecording onstop (reset false) | PromptReadyState isIterated prop — controls badge |
| `iterRecorderRef` | useRef MediaRecorder\|null | handleIterate | stopIterating, dismissIterating |
| `iterChunksRef` | useRef Blob[] | handleIterate ondataavailable | stopIterating onstop |
| `iterIsProcessingRef` | useRef boolean | stopIterating start/end guard | stopIterating early-exit guard |
| `polishResult` | useState (in usePolishMode) `{polished,changes}|null` | stopRecording/handleTypingSubmit/handleRegenerate/handlePolishToneChange | PolishReadyState |
| `polishTone` | hook (usePolishMode→useTone) string | usePolishMode() | IdleState, PolishReadyState, generate calls |
| `polishToneRef` | useRef (in usePolishMode) string | mirrors polishTone — stale-closure-safe for generate calls | stopRecording, handleTypingSubmit, handleRegenerate |
| `transitionRef` | useRef (in App.jsx) function | updated every render: `transitionRef.current = transition` | usePolishMode.handlePolishToneChange — calls transitionRef.current() to avoid stale closure |
| `copied` | useState (in usePolishMode) boolean | onCopy in PolishReadyState render | PolishReadyState copied prop |

## Module-scope variables (in index.html — legacy, main branch only)

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
| `LANGUAGES` | array constant | module top | `getLanguageLabel()`, language pill |
| `LANGUAGE_KEY` | string constant | module top | `getLanguage()`, `setLanguage()` |

---

## Module-scope variables (in main.js)

| Variable | Set when | Value |
|----------|----------|-------|
| `claudePath` | app-ready — `resolveClaudePath()` Promise | resolved binary path or null |
| `whisperPath` | app-ready — `resolveWhisperPath()` Promise (awaited) | resolved binary path, `'python3 -m whisper'`, or null |
| `win` | `createWindow()` called after `resolveClaudePath()` resolves | BrowserWindow instance |
| `splashWin` | `app.whenReady()` — created before `win`, destroyed after `splash-done` | BrowserWindow instance (null after splash) |
| `PROMPT_TEMPLATE` | module constant | Multi-line template string with `{MODE_NAME}`, `{MODE_INSTRUCTION}`, `{TRANSCRIPT}` placeholders — bypassed for standalone modes |
| `MODE_CONFIG` | module constant | `{ balanced, detailed, concise, chain, code, refine, design, polish }` — 8 modes total; each `{ name, instruction }`; `refine`, `design`, and `polish` have `standalone: true` which causes generate-prompt to use instruction directly instead of wrapping in PROMPT_TEMPLATE |
| `tray` | `updateTrayMenu()` reference — null after FEATURE-017 removed `createTray()` | null (menuBarTray is the sole Tray instance) |
| `menuBarTray` | `createMenuBarIcon()` called from splash-done (FEATURE-017) | Tray instance — 44×44 PNG @2x mic icon; click=show/hide, right-click=context menu |
| `pulseInterval` | MBAR-002 IPC handler (interval ID) or null | interval handle for dot-pulse animation; cleared on every state change and win hide/show |
| `lastGeneratedPrompt` | `set-last-prompt` IPC handler | Last successfully generated prompt string — session memory only, null until first generation; used by "Copy last prompt" tray menu item (FEATURE-018) |
| `configPath` | module constant | `path.join(app.getPath('userData'), 'config.json')` — path to persisted path config file |
| `readConfig()` | called on-demand | reads + parses config.json; returns `{}` on any error |
| `writeConfig(data)` | called on-demand | JSON.stringify(data, null, 2) → config.json |

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

> `body.light` override block applies the light-mode palette when macOS is in Light Mode.
> Applied via `classList.toggle('light', !dark)` — orthogonal to app state, never routed through `setState()`.

---

## localStorage keys

| Key | Written by | Read by | Notes |
|-----|-----------|---------|-------|
| `mode` | `useMode.setMode()` | `useMode.mode` — in boot, generate-prompt, regenerate | Default: `'balanced'` |
| `promptly_history` | `saveToHistory()` in App.jsx / `utils/history.js` | HistoryPanel, App.jsx | JSON array of up to 100 entries `{ id, transcript, prompt, mode, timestamp, title }` — `title` is first 5 words of transcript. Iteration entries also include optional fields: `isIteration: true` and `basedOn: string` (first 100 chars of original prompt). Polish entries also include optional `polishChanges: string[]` field. |
| `promptly_polish_tone` | `useTone.setPolishTone()` | `useTone.getPolishTone()` | Default: `'formal'`. Persists Formal/Casual tone preference for polish mode. |

> `firstRunComplete` key removed — splash screen replaced in-bar first-run flow (D-007)
> `promptHistory` (old key, 20-entry cap) — replaced by `promptly_history` (100-entry cap) in FEATURE-004
> `promptLanguage` removed — F-LANGUAGE removed (D-LANGUAGE-REMOVE)

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
| `panel-history` | HISTORY | `setState()` |
| `history-list` | HISTORY | `renderHistoryList()` |
| `btn-history-close` | HISTORY | click → IDLE |
| `btn-history-clear` | HISTORY | click → `clearHistory()` + re-render |
| `history-btn` | IDLE | click → HISTORY state |
| `btn-history` | PROMPT_READY | click → HISTORY state |

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

- `eslint main.js preload.js` — 0 errors, 0 warnings (the intentional `console.error` in uncaughtException has `// eslint-disable-next-line no-console`)
- `npm audit` — 0 vulnerabilities. 2 low-severity devDep vulns in `@eslint/plugin-kit` (BL-024) — devDep only, not in .dmg, awaiting manual decision on `npm audit fix --force`
- `src/renderer/index.html` is not included in the lint script (ESLint 9 cannot parse HTML without a plugin — inline JS reviewed manually; see D-001)
