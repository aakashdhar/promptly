# FEATURE-ONBOARDING-WIZARD — Plan

## Impact map

### Files to modify (existing)
- `splash.html` — full wizard rewrite (Screen 0-4, stepper, all check/download states)
- `main.js` — 7 new IPC handlers + lastTempAudioPath + lastTranscript vars + timeout logic
- `src/renderer/App.jsx` — TRANSCRIPTION_ERROR + GENERATION_ERROR states, retry handlers, timeout warnings
- `src/renderer/components/ExpandedView.jsx` — forward error props to ExpandedDetailPanel
- `src/renderer/components/ExpandedDetailPanel.jsx` — render ErrorStatePanel in right panel for error states
- `src/renderer/components/SettingsPanel.jsx` — "Recheck setup" button

### Files to create (new)
- `src/renderer/components/ErrorStatePanel.jsx` — shared error UI component

### Files explicitly out of scope — must NOT be touched
- preload.js (only add entries if new IPC methods are added — ask first)
- src/renderer/hooks/ (any hook)
- src/renderer/components/ImageBuilderState.jsx
- src/renderer/components/ImageBuilderDoneState.jsx
- src/renderer/components/VideoBuilderState.jsx
- src/renderer/components/VideoBuilderDoneState.jsx
- src/renderer/components/WorkflowBuilderState.jsx
- src/renderer/components/WorkflowBuilderDoneState.jsx
- src/renderer/index.css
- vite.config.js, eslint.config.js, package.json

---

## Task breakdown

### Group A — main.js IPC + state foundations

ONBD-001 (S) — main.js: check-claude IPC with test generation
  - resolveClaudePath() → execFile(claudePath, ['--version']) → execFile(claudePath, ['-p', 'respond with only the word READY'])
  - 15s timeout on test generation
  - Detect auth error: output contains 'not authenticated' | 'login' | 'unauthorized'
  - Return: { found, path, version, working, error, authError }
  - Register: ipcMain.handle('check-claude', ...)

ONBD-002 (S) — main.js: check-whisper + check-ffmpeg IPC
  - resolveWhisperPath() → execFile(whisperPath, ['--help'])
  - resolveFfmpegPath() new helper — checks /usr/local/bin/ffmpeg, /opt/homebrew/bin/ffmpeg, shell fallback
  - execFile(ffmpegPath, ['-version'])
  - Returns: { found, path, error } for each
  - Register: ipcMain.handle('check-whisper', ...) + ipcMain.handle('check-ffmpeg', ...)

ONBD-003 (S) — main.js: check-whisper-model IPC
  - Check ~/.cache/whisper/base.pt AND ~/Library/Caches/whisper/base.pt
  - fs.statSync to get file size — downloaded if > 100MB
  - Return: { downloaded, path, sizeMB }
  - Register: ipcMain.handle('check-whisper-model', ...)

ONBD-004 (M) — main.js: download-whisper-model IPC
  - spawn(whisperPath, ['/dev/null', '--model', 'base'], { stdio: ['ignore', 'pipe', 'pipe'] })
  - Parse stderr lines for tqdm progress: regex /(\d+)%\|.*?\|\s*(\d+\.?\d*)M\/(\d+\.?\d*)M\s*\[(.+?)<(.+?),/
  - Extract: percent, mbDone, mbTotal, elapsed, remaining
  - Parse remaining time string (mm:ss) → secondsLeft integer
  - Send: win.webContents.send('whisper-download-progress', { percent, mbDone, mbTotal, secondsLeft })
  - On close: resolve { success: true } or { success: false, error }
  - Register: ipcMain.handle('download-whisper-model', ...)

ONBD-005 (S) — main.js: lastTempAudioPath + lastTranscript + retry IPC
  - Add module-scope: let lastTempAudioPath = null; let lastTranscript = null
  - In existing transcribe-audio handler: set lastTempAudioPath = tmpFilePath before whisper run; set lastTranscript = transcript on success
  - ipcMain.handle('retry-transcription'): if lastTempAudioPath exists, re-run same whisper command; return { success, transcript, error }
  - ipcMain.handle('retry-generation'): if lastTranscript + currentMode exist, re-run generate-prompt logic; return { success, prompt, error }
  - Add module-scope: let currentMode = 'balanced'; update in generate-prompt handler

ONBD-006 (S) — main.js: transcription timeout (30s) with kill + warning events
  - In transcribe-audio handler: set timer for 20s → send 'transcription-slow-warning' to renderer
  - At 30s: kill whisper process + send error result { success: false, error: 'timeout', timedOut: true }
  - Clear timer on process close
  - Register push channel: 'transcription-slow-warning'

ONBD-007 (S) — main.js: generation timeout (45s) with error type parsing
  - In generate-prompt + generate-raw handlers: set 30s timer → win.webContents.send('generation-slow-warning')
  - At 45s: kill claude process + return { success: false, error: stderr, timedOut: true }
  - Parse error type: authError (contains 'not authenticated'|'login'|'unauthorized'), empty (stdout empty), timeout
  - Clear timer on process close

### Group B — splash.html wizard

ONBD-008 (M) — splash.html: Screen 0 Welcome + electron-store setupComplete check
  - Add electron-store to main.js (use config.json pattern — no new deps, store 'setupComplete' in config.json via existing readConfig/writeConfig)
  - splash.html: on load, call check-setup-complete IPC; if true → call splash-done; if false → show welcome screen
  - Welcome HTML: logo block, body text, three step-preview cards (step number circle + title + subtitle + time estimate), CTA button
  - CTA onclick → show Screen 1

ONBD-009 (M) — splash.html: Screen 1 — Claude CLI wizard step
  - Stepper component (3 steps, current highlighted purple, done green, future grey)
  - Auto-runs check-claude IPC on screen load; show checking sub-states sequentially
  - WORKING: green dot, path + version + "Test generation passed ✓"; auto-advance 1.5s
  - NOT_FOUND: install block with 3 code+copy rows; "Check again ↺" button
  - NOT_LOGGED_IN: amber lock, claude login code+copy, note; "Check again ↺"
  - NOT_RESPONDING: monospace error box, 2 fix suggestions + copy; "Check again ↺"
  - "Skip setup (advanced)" link at bottom → confirmation → splash-done

ONBD-010 (M) — splash.html: Screen 2 — Whisper + ffmpeg wizard step
  - Auto-runs check-whisper + check-ffmpeg IPC on screen load
  - BOTH_FOUND: two green dots + paths; auto-advance 1s
  - WHISPER_NOT_FOUND: red dot + brew + pip3 install blocks + copy
  - FFMPEG_NOT_FOUND: green whisper dot + red ffmpeg dot + brew install ffmpeg + copy
  - BOTH_NOT_FOUND: combined install block (3 commands, one copy button)
  - "Skip setup (advanced)" link

ONBD-011 (M) — splash.html: Screen 3 — Model download with progress
  - Auto-runs check-whisper-model IPC on screen load
  - ALREADY_DOWNLOADED: green dot + "Voice model ready (base, 148MB)"; auto-advance 1s
  - NOT_DOWNLOADED: download arrow icon, title, body, info box, "Download now (148MB)" button
  - DOWNLOADING: spinner, progress bar (height 3px), "XX MB of 148 MB" + "~XX sec remaining"; listen to whisper-download-progress events
  - COMPLETE: green checkmark + "Voice model downloaded successfully"; auto-advance 1s
  - FAILED: red dot + error + "Try again" + "Download manually" note
  - "Skip setup (advanced)" link

ONBD-012 (S) — splash.html: Screen 4 — All done + launch
  - Large green checkmark circle (56px)
  - Three ✓ rows: Claude CLI, Whisper + model, ffmpeg
  - "Launch Promptly" button → calls set-setup-complete IPC → calls splash-done

ONBD-013 (S) — splash.html: Skip confirmation + settings recheck
  - Skip link on screens 1-3 triggers in-page confirmation dialog (overlay)
  - Confirm → set-setup-complete → splash-done
  - Cancel → hide overlay
  - SettingsPanel.jsx: add "Recheck setup ↺" button → calls reset-setup-complete IPC + triggers splash reopen

### Group C — Expanded view error handling

ONBD-014 (M) — App.jsx + ExpandedView.jsx: transcription error state
  - Add TRANSCRIPTION_ERROR to STATES + STATE_HEIGHTS (860 — stays expanded)
  - App.jsx: catch transcription error/timeout in useRecording → transition(TRANSCRIPTION_ERROR, { error, errorType })
  - transcriptionErrorRef: store { error, errorType, canRetry } — canRetry = lastTempAudioPath exists
  - handleRetryTranscription(): call retry-transcription IPC → on success, route to THINKING with transcript
  - onTranscriptionSlowWarning IPC listener (useEffect in App.jsx): set transcriptionSlow state
  - ExpandedView: forward transcriptionErrorProps to ExpandedDetailPanel
  - 20s warning: inline banner below spinner in ThinkingState (when transcriptionSlow=true)

ONBD-015 (M) — App.jsx + ExpandedView.jsx: generation error state
  - Add GENERATION_ERROR to STATES + STATE_HEIGHTS (860)
  - App.jsx: in handleGenerateResult — if !success, parse error type (authError, timeout, empty, unknown)
  - transition(GENERATION_ERROR, { error, errorType })
  - handleRetryGeneration(): call retry-generation IPC → on success, handle result normally
  - onGenerationSlowWarning IPC listener: set generationSlow state
  - ExpandedView: forward generationErrorProps to ExpandedDetailPanel
  - 30s warning: inline banner in ThinkingState (when generationSlow=true)

ONBD-016 (S) — ErrorStatePanel.jsx: shared error component
  - Props: { icon, title, body, errorDetails, fixLabel, fixCode, onCopy, onRetry, onOpenSettings }
  - icon: 'error' | 'lock' | 'clock' | 'warning'
  - Error details box: monospace, max-height 80px, scrollable
  - Fix box: amber tinted, label + code block + copy button
  - Action row: secondary "Open settings" (shown if onOpenSettings provided) + primary "Try again ↺"
  - Used by both transcription + generation error states in ExpandedDetailPanel

### Group D — Docs

ONBD-017 (S) — Docs: CODEBASE.md + DECISIONS.md + TASKS.md
  - CODEBASE.md: add ErrorStatePanel.jsx to file map; add 7 new IPC channels; add TRANSCRIPTION_ERROR + GENERATION_ERROR to state table; add lastTempAudioPath + lastTranscript to module-scope vars table
  - DECISIONS.md: add D-ONBD-001 feature start entry
  - TASKS.md: mark ONBD-001 through ONBD-017 complete

---

## Conventions to follow (from CODEBASE.md + ARCHITECTURE.md)

- One component per file in src/renderer/components/. Functional React only.
- All state transitions via transition() in App.jsx — never mutate state directly.
- Inline styles for dynamic/stateful values; Tailwind only for static layout classes.
- No dangerouslySetInnerHTML with user/Claude content — use JSX text nodes.
- IPC via window.electronAPI only — never ipcRenderer directly.
- localStorage only via useMode() / useTone() / utils/history.js wrappers.
- splash.html is vanilla HTML/JS — no React. IPC via window.electronAPI (preload loaded via webPreferences).
- PATH resolution pattern: static paths → nvm scan → shell fallback (see ARCHITECTURE.md).
- Use execFile (not exec) for binary calls — avoids shell injection.
- All new IPC channels must be registered in both main.js (ipcMain.handle) and preload.js (contextBridge).

---

## Rollback plan

All changes are additive:
- splash.html: keep existing runChecks() behind setupComplete guard — no existing code removed
- main.js: new IPC handlers only + 2 new module vars — no existing handlers modified
- App.jsx: 2 new states + 2 error transition paths — existing happy path unchanged
- ErrorStatePanel.jsx: new file — delete to rollback
- To fully revert: git revert feat(onboarding) commits

---

## Testing strategy

Manual smoke test per task:
- ONBD-001: run splash, check Claude CLI tab, verify all 4 states appear
- ONBD-002: temporarily rename whisper/ffmpeg to test NOT FOUND states
- ONBD-003: check with model present + absent
- ONBD-004: run download, watch progress bar update
- ONBD-005: test retry after artificial transcription failure
- ONBD-006/007: test timeout with a very slow/offline machine
- ONBD-008-012: full wizard run on clean install (or config reset)
- ONBD-013: test skip link + settings recheck button
- ONBD-014/015: inject errors to trigger TRANSCRIPTION_ERROR and GENERATION_ERROR
- ONBD-016: review ErrorStatePanel visually in all icon variants

Lint: npm run lint — must pass before every commit.

---

## CODEBASE.md sections to update
- File map: add ErrorStatePanel.jsx
- IPC channels: 7 new channels
- State machine table: TRANSCRIPTION_ERROR, GENERATION_ERROR
- Module-scope variables (main.js): lastTempAudioPath, lastTranscript, currentMode
