# FEATURE-ONBOARDING-WIZARD Tasks

> **Estimated effort:** 17 tasks — S: 9 (<2hrs ea), M: 8 (2-4hrs ea) — approx. 22–30 hours total

---

### ONBD-001 · main.js — check-claude IPC with test generation
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#screen-1--claude-cli-check
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: Register `ipcMain.handle('check-claude', ...)`. Run the full 3-step verification: (1) resolveClaudePath() — find binary using existing pattern; (2) execFile(claudePath, ['--version']) — capture version string from stdout; (3) execFile(claudePath, ['-p', 'respond with only the word READY']) with 15-second timeout — check if stdout contains 'READY'. Auth error detection: stdout/stderr contains 'not authenticated' | 'login' | 'unauthorized'. Return structured object.

**Acceptance criteria**:
- [ ] IPC channel 'check-claude' registered and callable
- [ ] Returns `{ found: bool, path: string|null, version: string|null, working: bool, error: string|null, authError: bool }`
- [ ] Test generation uses `claude -p "respond with only the word READY"` with 15s timeout
- [ ] Auth error detected separately from not-found
- [ ] Not-responding (timeout) detected separately from auth error

**Self-verify**: Re-read FEATURE_SPEC.md#screen-1. Tick every criterion.
**Test requirement**: Manual: call IPC from splash devtools, verify all 4 result shapes.
**⚠️ Boundaries**: Use execFile not exec. Use cached resolveClaudePath pattern from ARCHITECTURE.md. Do NOT modify existing IPC channels.
**CODEBASE.md update?**: Yes — add 'check-claude' to IPC channels table
**Architecture compliance**: PATH resolution pattern (ARCHITECTURE.md), execFile not exec, ipcMain.handle pattern

**Decisions**:
- Used `spawn` for step 3 (consistent with generate-prompt/generate-raw pattern); `execFile` for step 2 (--version, small output). Both avoid shell wrapping.

---

### ONBD-002 · main.js — check-whisper + check-ffmpeg IPC
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#screen-2--whisper--ffmpeg-check
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: Add `resolveFfmpegPath()` helper following the existing resolveWhisperPath() pattern — check static common paths (/usr/local/bin/ffmpeg, /opt/homebrew/bin/ffmpeg), nvm scan not needed, shell fallback `zsh -lc 'which ffmpeg'`. Register `ipcMain.handle('check-whisper', ...)` — runs resolveWhisperPath() then execFile(whisperPath, ['--help']). Register `ipcMain.handle('check-ffmpeg', ...)` — runs resolveFfmpegPath() then execFile(ffmpegPath, ['-version']). Each returns `{ found: bool, path: string|null, error: string|null }`.

**Acceptance criteria**:
- [ ] resolveFfmpegPath() added using same static+shell fallback pattern as resolveWhisperPath
- [ ] 'check-whisper' IPC registered — runs --help to verify, not just path check
- [ ] 'check-ffmpeg' IPC registered — runs -version to verify
- [ ] Both return `{ found, path, error }` structure

**Self-verify**: Re-read FEATURE_SPEC.md#screen-2. Tick every criterion.
**Test requirement**: Manual: rename ffmpeg temporarily to test NOT FOUND state.
**⚠️ Boundaries**: Do NOT modify resolveWhisperPath or resolveClaudePath. Follow PATH resolution pattern exactly.
**CODEBASE.md update?**: Yes — add 'check-whisper' and 'check-ffmpeg' to IPC channels table; add resolveFfmpegPath to main.js exports
**Architecture compliance**: PATH resolution pattern (ARCHITECTURE.md)

**Decisions**:
- resolveFfmpegPath uses static paths + shell fallback only (no nvm scan — ffmpeg is not installed via nvm). exec used for 'python3 -m whisper' compound path check in check-whisper.

---

### ONBD-003 · main.js — check-whisper-model IPC
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#screen-3--voice-model-download
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: Register `ipcMain.handle('check-whisper-model', ...)`. Check two cache paths: `path.join(os.homedir(), '.cache', 'whisper', 'base.pt')` and `path.join(os.homedir(), 'Library', 'Caches', 'whisper', 'base.pt')`. Use fs.statSync to get file size. Downloaded if file exists AND size > 100MB (104857600 bytes). Return `{ downloaded: bool, path: string|null, sizeMB: number|null }`.

**Acceptance criteria**:
- [ ] Both cache paths checked
- [ ] Downloaded = file exists AND size > 100MB
- [ ] Returns `{ downloaded, path, sizeMB }`
- [ ] Gracefully handles missing file (no throw — return downloaded: false)

**Self-verify**: Re-read FEATURE_SPEC.md#screen-3 verification section. Tick every criterion.
**Test requirement**: Manual: check with model present and absent.
**⚠️ Boundaries**: No modification to existing IPC channels.
**CODEBASE.md update?**: Yes — add 'check-whisper-model' to IPC channels table
**Architecture compliance**: No shell needed for file check — fs.statSync is fine

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-004 · main.js — download-whisper-model IPC with progress streaming
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#downloading-state-after-button-click
- **Dependencies**: ONBD-002 (need whisperPath resolved)
- **Touches**: `main.js`

**What to do**: Register `ipcMain.handle('download-whisper-model', ...)`. Spawn whisper process: `spawn(whisperPath, ['/dev/null', '--model', 'base'], { stdio: ['ignore', 'pipe', 'pipe'] })`. Listen to stderr for tqdm progress lines. Parse regex: `/(\d+)%\|.*?\|\s*([\d.]+)M\/([\d.]+)M\s*\[(.+?)<(.+?),/` — groups: percent, mbDone, mbTotal, elapsed, remaining. Parse remaining time "mm:ss" or "s" → secondsLeft. Send progress: `win.webContents.send('whisper-download-progress', { percent, mbDone, mbTotal, secondsLeft })`. On close code 0: return `{ success: true }`. On error: return `{ success: false, error: stderr }`.

**Acceptance criteria**:
- [ ] Download spawned via whisper /dev/null --model base
- [ ] stderr parsed for tqdm progress lines
- [ ] 'whisper-download-progress' events sent with { percent, mbDone, mbTotal, secondsLeft }
- [ ] Returns { success: true } on completion or { success: false, error } on failure
- [ ] Process properly cleaned up on close

**Self-verify**: Re-read FEATURE_SPEC.md#downloading-state. Tick every criterion.
**Test requirement**: Manual: trigger download, watch progress events in devtools console.
**⚠️ Boundaries**: Do NOT block the IPC handler thread — use spawn (not execFile). win reference must be checked for isDestroyed before send.
**CODEBASE.md update?**: Yes — add 'download-whisper-model' and 'whisper-download-progress' to IPC channels table
**Architecture compliance**: Push event pattern (win.webContents.send) as per IPC pattern in ARCHITECTURE.md

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-005 · main.js — lastTempAudioPath + lastTranscript + retry IPC
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#manual-retry-button
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: Add module-scope vars: `let lastTempAudioPath = null; let lastTranscript = null; let currentMode = 'balanced'`. In existing `transcribe-audio` handler: capture the tmp file path before running whisper (set lastTempAudioPath = tmpFilePath). On success: set lastTranscript = transcript. In existing `generate-prompt` handler: set currentMode = mode (from event args). Register `ipcMain.handle('retry-transcription', ...)`: if lastTempAudioPath and file still exists, re-run the same whisper command; otherwise return { success: false, error: 'No audio available — please record again' }. Register `ipcMain.handle('retry-generation', ...)`: if lastTranscript, re-run generate-prompt logic with lastTranscript + currentMode.

**Acceptance criteria**:
- [ ] lastTempAudioPath set in transcribe-audio handler before whisper runs
- [ ] lastTranscript set on successful transcription
- [ ] currentMode updated in generate-prompt handler
- [ ] 'retry-transcription' IPC registered — reuses lastTempAudioPath, returns same shape as transcribe-audio
- [ ] 'retry-generation' IPC registered — reuses lastTranscript + currentMode, returns same shape as generate-prompt
- [ ] Graceful error if no audio/transcript available

**Self-verify**: Re-read FEATURE_SPEC.md#manual-retry-button. Tick every criterion.
**Test requirement**: Manual: trigger error then click retry — verify same audio/transcript reused.
**⚠️ Boundaries**: Do NOT reset lastTempAudioPath on error — keep for retry. Only reset when next recording starts (on transcribe-audio call).
**CODEBASE.md update?**: Yes — add lastTempAudioPath, lastTranscript, currentMode to module-scope vars table
**Architecture compliance**: ipcMain.handle pattern

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-006 · main.js — transcription timeout (30s) with kill + warning events
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#timeout-handling
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: In the `transcribe-audio` IPC handler, after spawning the whisper process: set a 20-second timer → `win.webContents.send('transcription-slow-warning')` (push event, no payload needed). Set a 30-second timer → kill the whisper process (process.kill(pid)) + resolve `{ success: false, error: 'Transcription timed out after 30 seconds', timedOut: true }`. On process close (before timeout), clear both timers. Guard win.isDestroyed() before webContents.send.

**Acceptance criteria**:
- [ ] 20s timer sends 'transcription-slow-warning' to renderer
- [ ] 30s timer kills whisper process + returns timeout error
- [ ] Both timers cleared on normal process close
- [ ] timedOut: true flag included in error response
- [ ] win.isDestroyed() guard on webContents.send

**Self-verify**: Re-read FEATURE_SPEC.md#timeout-handling transcription section. Tick every criterion.
**Test requirement**: Manual: test with artificially slow transcription (huge audio file or offline).
**⚠️ Boundaries**: Do not modify the shape of the existing transcribe-audio success response.
**CODEBASE.md update?**: Yes — add 'transcription-slow-warning' push channel to IPC table
**Architecture compliance**: Push event pattern (main → renderer)

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-007 · main.js — generation timeout (45s) with error type parsing
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#timeout-handling
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**: Apply to both `generate-prompt` and `generate-raw` handlers. Add 30s timer → `win.webContents.send('generation-slow-warning')`. Add 45s timer → kill claude process + resolve `{ success: false, error: stderr, timedOut: true }`. Parse error type helper: `parseGenerationError(stderr, stdout)` → returns errorType: 'auth' | 'timeout' | 'empty' | 'unknown'. Auth detected if stderr/stdout contains 'not authenticated' | 'login' | 'unauthorized'. Empty if process exits 0 but stdout is blank. Attach errorType to all failure responses: `{ success: false, error, timedOut?, errorType }`. Clear timers on process close.

**Acceptance criteria**:
- [ ] 30s timer sends 'generation-slow-warning' push event
- [ ] 45s timer kills claude process + returns timeout error
- [ ] Both timers cleared on normal process close
- [ ] errorType field attached to ALL failure responses (auth | timeout | empty | unknown)
- [ ] Auth detection covers 'not authenticated', 'login', 'unauthorized'
- [ ] Empty response detected when stdout is blank after successful exit

**Self-verify**: Re-read FEATURE_SPEC.md#timeout-handling + generation error state. Tick every criterion.
**Test requirement**: Manual: test auth error (claude logout), empty response (claude returning blank), timeout.
**⚠️ Boundaries**: Apply to both generate-prompt AND generate-raw. Existing success response shape unchanged.
**CODEBASE.md update?**: Yes — add 'generation-slow-warning' push channel to IPC table
**Architecture compliance**: Push event pattern

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-008 · splash.html — Screen 0 Welcome + setupComplete check
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#screen-0--welcome
- **Dependencies**: None
- **Touches**: `splash.html`, `main.js`

**What to do**: In main.js: add `'setupComplete'` to config.json read/write (use existing readConfig/writeConfig — no new npm deps). Register `ipcMain.handle('check-setup-complete', ...)` → returns `{ complete: bool }`. Register `ipcMain.handle('set-setup-complete', ...)` → writeConfig({ ...readConfig(), setupComplete: true }). Register `ipcMain.handle('reset-setup-complete', ...)` → writeConfig({ ...readConfig(), setupComplete: false }). In splash.html: on DOMContentLoaded, call check-setup-complete; if true → call splash-done immediately; if false → show #screen-welcome. Welcome screen HTML: Promptly logo + name + tagline, body paragraph, three step-preview cards (each: number circle + name + description + time), CTA "Let's set up Promptly →" button (purple gradient, 100% width, 44px). CTA click → show Screen 1.

**Acceptance criteria**:
- [ ] check-setup-complete IPC registered (reads config.json)
- [ ] set-setup-complete IPC registered (writes config.json)
- [ ] reset-setup-complete IPC registered
- [ ] If setupComplete=true on splash load → skip wizard, call splash-done
- [ ] Welcome screen shows logo, tagline, 3 step cards, CTA button
- [ ] CTA click shows Screen 1
- [ ] No new npm deps (uses existing config.json pattern)

**Self-verify**: Re-read FEATURE_SPEC.md#screen-0--welcome. Tick every criterion.
**Test requirement**: Manual: delete config.json → verify wizard shows; add setupComplete:true → verify wizard skipped.
**⚠️ Boundaries**: Use existing readConfig/writeConfig from main.js. No electron-store package. splash.html is vanilla JS only — no React.
**CODEBASE.md update?**: Yes — add 3 new IPC channels
**Architecture compliance**: Vanilla HTML/JS for splash (not React); config.json persistence pattern

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-009 · splash.html — Screen 1: Claude CLI wizard step
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#screen-1--claude-cli-check
- **Dependencies**: ONBD-001, ONBD-008
- **Touches**: `splash.html`

**What to do**: Add stepper component HTML/CSS (3 numbered circles with connecting progress bars; completed = green checkmark; current = purple; future = grey). Screen 1 HTML: stepper at top, checking state (spinner + sub-label cycling through 3 messages), working state, not-found state, not-logged-in state, not-responding state. Auto-call check-claude IPC on screen show. State transitions: on result, show the correct state. Working state: auto-advance to Screen 2 after 1.5s. Not-found/not-logged-in/not-responding states: show relevant install blocks + copy buttons. "Check again ↺" reruns check-claude IPC and resets state. "Skip setup (advanced)" link at bottom → JS confirm dialog → if confirmed → set-setup-complete + splash-done.

**Acceptance criteria**:
- [ ] Stepper shows 3 steps, current=purple, done=green, future=grey
- [ ] check-claude IPC auto-called on screen show
- [ ] Sub-states cycle: "Looking..." → "Verifying..." → "Testing..."
- [ ] WORKING: green dot + path + version + "passed ✓" → auto-advance 1.5s
- [ ] NOT_FOUND: install block with 3 code+copy rows (node, claude, claude login)
- [ ] NOT_LOGGED_IN: amber lock + claude login code + copy
- [ ] NOT_RESPONDING: monospace error box + 2 fix hints + copy
- [ ] "Check again ↺" reruns check
- [ ] "Skip setup (advanced)" link with confirm dialog

**Self-verify**: Re-read FEATURE_SPEC.md#screen-1 all states. Tick every criterion.
**Test requirement**: Manual: test each state by modifying claudePath to missing/broken/logged-out.
**⚠️ Boundaries**: Vanilla JS only. No React. Use window.electronAPI for IPC.
**CODEBASE.md update?**: No (splash.html not in file map — it's already there as a row)
**Architecture compliance**: splash.html vanilla JS pattern

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-010 · splash.html — Screen 2: Whisper + ffmpeg wizard step
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#screen-2--whisper--ffmpeg-check
- **Dependencies**: ONBD-002, ONBD-009
- **Touches**: `splash.html`

**What to do**: Auto-call check-whisper + check-ffmpeg IPCs on screen show (parallel calls via Promise.all). State logic: BOTH_FOUND → two green dots + auto-advance 1s. WHISPER_NOT_FOUND (regardless of ffmpeg) → whisper not found install block. FFMPEG_NOT_FOUND (whisper ok) → green whisper dot + red ffmpeg dot + brew install ffmpeg block. BOTH_NOT_FOUND → combined install block (3 commands, single copy button). "Check again ↺" reruns both checks. Stepper shows step 2 current, step 1 completed.

**Acceptance criteria**:
- [ ] check-whisper + check-ffmpeg called in parallel on screen show
- [ ] BOTH_FOUND: two green dots + auto-advance 1s
- [ ] WHISPER_NOT_FOUND: red dot + brew python + pip3 install whisper blocks with copies
- [ ] FFMPEG_NOT_FOUND: green whisper dot + red ffmpeg dot + brew ffmpeg + copy
- [ ] BOTH_NOT_FOUND: combined install block with one copy for all commands
- [ ] "Check again ↺" reruns both IPC calls
- [ ] "Skip setup (advanced)" link

**Self-verify**: Re-read FEATURE_SPEC.md#screen-2 all states. Tick every criterion.
**Test requirement**: Manual: rename ffmpeg + whisper binaries to test states.
**⚠️ Boundaries**: Vanilla JS. Promise.all for parallel IPC calls.
**CODEBASE.md update?**: No
**Architecture compliance**: splash.html vanilla JS pattern

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-011 · splash.html — Screen 3: Model download with real progress bar
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#screen-3--voice-model-download
- **Dependencies**: ONBD-003, ONBD-004, ONBD-010
- **Touches**: `splash.html`

**What to do**: Auto-call check-whisper-model on screen show. ALREADY_DOWNLOADED state: green dot + "Voice model ready (base, 148MB)" → auto-advance 1s. NOT_DOWNLOADED state: download arrow icon, title, body, info box, "Download now (148MB)" button. Button click → call download-whisper-model IPC (async, returns on complete). Listen to 'whisper-download-progress' IPC push events (window.electronAPI.on or similar) → update progress bar and labels. Progress bar: height 3px, blue fill (linear-gradient). Labels: "XX MB of 148 MB" left + "~XX sec remaining" right. COMPLETE: green checkmark → auto-advance 1s. FAILED: red dot + error text + "Try again" button + "Download manually" text note. Stepper shows step 3 current.

**Acceptance criteria**:
- [ ] check-whisper-model auto-called on screen show
- [ ] ALREADY_DOWNLOADED: green dot → auto-advance 1s
- [ ] NOT_DOWNLOADED: download UI shown before any download starts
- [ ] "Download now (148MB)" triggers download-whisper-model IPC
- [ ] Progress bar updates in real time from whisper-download-progress events
- [ ] MB + seconds remaining labels update correctly
- [ ] COMPLETE: green checkmark → auto-advance 1s
- [ ] FAILED: error shown + retry + "Download manually" note
- [ ] "Skip setup (advanced)" link

**Self-verify**: Re-read FEATURE_SPEC.md#screen-3 all states. Tick every criterion.
**Test requirement**: Manual: run full download, watch progress bar live.
**⚠️ Boundaries**: Vanilla JS. IPC push event listener must be removed on screen unload. preload.js must expose whisper-download-progress listener if not already.
**CODEBASE.md update?**: No
**Architecture compliance**: splash.html vanilla JS pattern; push event from main

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-012 · splash.html — Screen 4: All done + launch
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#screen-4--all-done
- **Dependencies**: ONBD-011
- **Touches**: `splash.html`

**What to do**: Screen 4 HTML: 56px green checkmark circle, title "You're all set", body text, three ✓ rows (Claude CLI / Whisper + model / ffmpeg), "Launch Promptly" button. Button click: call set-setup-complete IPC → call splash-done IPC. Stepper: all three steps shown as complete (green checkmarks). This is the terminal screen — no Back navigation.

**Acceptance criteria**:
- [ ] 56px green checkmark circle shown
- [ ] Title + body + three ✓ rows displayed
- [ ] Stepper shows all 3 steps completed
- [ ] "Launch Promptly" button calls set-setup-complete then splash-done
- [ ] App opens after button click

**Self-verify**: Re-read FEATURE_SPEC.md#screen-4. Tick every criterion.
**Test requirement**: Manual: click Launch — verify app opens and splash closes.
**⚠️ Boundaries**: set-setup-complete must be called before splash-done (race condition if reversed).
**CODEBASE.md update?**: No
**Architecture compliance**: splash.html vanilla JS

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-013 · Skip option + settings recheck
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#skip-option-for-experienced-users + #re-run-wizard-option
- **Dependencies**: ONBD-008
- **Touches**: `splash.html`, `src/renderer/components/SettingsPanel.jsx`, `preload.js`, `main.js`

**What to do**: In splash.html: add "Skip setup (advanced)" link (font-size 11px, rgba(255,255,255,0.18)) to Screen 1, 2, 3. Click shows an in-page confirmation overlay: "Are you sure? Promptly may not work correctly if dependencies are missing." + Cancel + Confirm. Cancel hides overlay. Confirm → set-setup-complete IPC → splash-done IPC. In SettingsPanel.jsx: add "Recheck setup ↺" button below existing path controls. OnClick: calls window.electronAPI.reopenWizard(). In main.js: register ipcMain.handle('reopen-wizard', ...) — (1) writeConfig({ ...readConfig(), setupComplete: false }); (2) recreate splashWin using same BrowserWindow config as original; (3) splashWin.loadFile('splash.html'); (4) splashWin.show(); win.hide(). In preload.js: expose reopenWizard() in contextBridge.

**Acceptance criteria**:
- [ ] "Skip setup (advanced)" link on Screens 1, 2, 3
- [ ] Confirmation overlay shown on click (not native dialog)
- [ ] Cancel hides overlay and does nothing
- [ ] Confirm → set-setup-complete → splash-done → app opens
- [ ] SettingsPanel.jsx has "Recheck setup ↺" button
- [ ] Button calls reopen-wizard IPC
- [ ] reopen-wizard resets setupComplete + recreates splashWin + hides main win

**Self-verify**: Re-read FEATURE_SPEC.md#skip-option and #re-run-wizard-option. Tick every criterion.
**Test requirement**: Manual: test skip on each screen; test recheck from settings — verify splash reopens.
**⚠️ Boundaries**: splashWin was destroyed after original splash-done — must recreate, not show.
**CODEBASE.md update?**: Yes — add reopen-wizard to IPC table; update SettingsPanel.jsx row
**Architecture compliance**: Inline overlay (not native dialog) for skip confirmation

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-014 · App.jsx + ExpandedView.jsx — transcription error state
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#transcription-error-state
- **Dependencies**: ONBD-005, ONBD-006
- **Touches**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx`, `src/renderer/components/ExpandedTransportBar.jsx`, `src/renderer/components/ThinkingState.jsx`

**What to do**: Add TRANSCRIPTION_ERROR to STATES constant + STATE_HEIGHTS (860 — stays in expanded layout). Add transcriptionError useState: `{ error: string, errorType: string, canRetry: bool } | null`. In useRecording.js (or App.jsx): catch whisper error/timeout from transcribe-audio IPC result — if !success, transition to TRANSCRIPTION_ERROR with error data. Build transcriptionErrorProps bundle: `{ error, errorType, canRetry, onRetry, onOpenSettings }`. handleRetryTranscription(): call window.electronAPI.retryTranscription() → on success, set thinkTranscript + transition to THINKING; on failure with no audio, show "Please record again" + transition to IDLE. Add onTranscriptionSlowWarning IPC listener in useEffect: sets transcriptionSlow state (boolean). Pass transcriptionSlow as prop to ThinkingState for the 20s warning banner. Forward transcriptionErrorProps + currentState to ExpandedDetailPanel via ExpandedView.

**Acceptance criteria**:
- [ ] TRANSCRIPTION_ERROR state added to STATES + STATE_HEIGHTS
- [ ] Transitions to TRANSCRIPTION_ERROR on whisper error or timeout
- [ ] transcriptionError state carries { error, errorType, canRetry }
- [ ] handleRetryTranscription calls retry-transcription IPC
- [ ] On retry success → THINKING state with transcript
- [ ] On retry failure (no audio) → IDLE with message
- [ ] transcriptionSlow state set by 'transcription-slow-warning' IPC event
- [ ] 20s warning banner shown in ThinkingState when transcriptionSlow=true
- [ ] transcriptionErrorProps forwarded to ExpandedDetailPanel via ExpandedView

**Self-verify**: Re-read FEATURE_SPEC.md#transcription-error-state. Tick every criterion.
**Test requirement**: Manual: inject a bad whisper path temporarily, trigger recording, verify error state.
**⚠️ Boundaries**: TRANSCRIPTION_ERROR is expanded-only (860px). Must check isExpanded=true before transitioning. Do NOT modify useRecording.js hook return shape without updating CODEBASE.md.
**CODEBASE.md update?**: Yes — TRANSCRIPTION_ERROR in state table; transcriptionError + transcriptionSlow in React state table
**Architecture compliance**: transition() only for state changes; useRef for stable callbacks; no stale closures

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-015 · App.jsx + ExpandedView.jsx — generation error state
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#generation-error-state
- **Dependencies**: ONBD-005, ONBD-007
- **Touches**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx`, `src/renderer/components/ExpandedTransportBar.jsx`, `src/renderer/components/ThinkingState.jsx`

**What to do**: Add GENERATION_ERROR to STATES + STATE_HEIGHTS (860). Add generationError useState: `{ error: string, errorType: 'auth' | 'timeout' | 'empty' | 'unknown', canRetry: bool } | null`. In handleGenerateResult (App.jsx): if !success, read result.errorType + result.timedOut; transition to GENERATION_ERROR with error data. Build generationErrorProps bundle. handleRetryGeneration(): call window.electronAPI.retryGeneration() → on success, handle result via handleGenerateResult normally. Add onGenerationSlowWarning IPC listener: sets generationSlow state. Pass generationSlow as prop to ThinkingState for the 30s warning banner. Forward generationErrorProps to ExpandedDetailPanel via ExpandedView.

**Acceptance criteria**:
- [ ] GENERATION_ERROR state added to STATES + STATE_HEIGHTS
- [ ] Transitions to GENERATION_ERROR on any generation failure
- [ ] errorType correctly set to 'auth' | 'timeout' | 'empty' | 'unknown'
- [ ] handleRetryGeneration calls retry-generation IPC
- [ ] On retry success → normal handleGenerateResult flow
- [ ] generationSlow state set by 'generation-slow-warning' IPC event
- [ ] 30s warning banner shown in ThinkingState when generationSlow=true
- [ ] generationErrorProps forwarded to ExpandedDetailPanel via ExpandedView

**Self-verify**: Re-read FEATURE_SPEC.md#generation-error-state all error types. Tick every criterion.
**Test requirement**: Manual: claude logout → trigger generation → verify auth error state.
**⚠️ Boundaries**: GENERATION_ERROR is expanded-only (860px). abortRef must be checked before transitioning to GENERATION_ERROR (same as handleGenerateResult guard).
**CODEBASE.md update?**: Yes — GENERATION_ERROR in state table; generationError + generationSlow in React state table
**Architecture compliance**: abortRef guard pattern; transition() only; no stale closures

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-016 · OperationErrorPanel.jsx — shared error component
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#transcription-error-state + #generation-error-state (visual specs)
- **Dependencies**: None (can be built standalone, wired in ONBD-014/015)
- **Touches**: `src/renderer/components/OperationErrorPanel.jsx` (new — distinct from existing ErrorState.jsx which is the minimal ERROR panel)

**What to do**: Create OperationErrorPanel.jsx. Props: `{ icon, title, body, errorDetails, fixLabel, fixCode, onCopy, onRetry, onOpenSettings }`. Icon variants: 'error' (red exclamation), 'lock' (amber lock), 'clock' (amber clock), 'warning' (amber warning). Layout: centred flex column, gap 14px. Error icon: 48px circle with rgba bg + border matching icon type. Title: 16px font-weight 500 rgba(255,255,255,0.75). Body: 12.5px rgba(255,255,255,0.38). Error details box (shown if errorDetails): monospace, 10.5px, rgba(255,100,90,0.55), max-height 80px overflow-y auto. Fix box (shown if fixCode): amber tinted bg rgba(255,189,46,0.04), border rgba(255,189,46,0.12), FIX label, code block, copy button. Action row: "Open settings" secondary (shown if onOpenSettings) + "Try again ↺" primary purple. Used by ExpandedDetailPanel for both error types.

**Acceptance criteria**:
- [ ] All 4 icon variants render correctly
- [ ] Error details box scrollable, max-height 80px
- [ ] Fix box shown only when fixCode prop provided
- [ ] "Open settings" shown only when onOpenSettings prop provided
- [ ] Copy button calls onCopy with fixCode
- [ ] "Try again ↺" calls onRetry
- [ ] All styles inline (no Tailwind for dynamic values)
- [ ] No dangerouslySetInnerHTML — JSX text nodes only

**Self-verify**: Re-read FEATURE_SPEC.md visual specs for both error states. Tick every criterion.
**Test requirement**: Manual: render with all 4 icon types, with/without errorDetails, with/without onOpenSettings.
**⚠️ Boundaries**: New file only. Do not modify ExpandedDetailPanel in this task (wiring done in ONBD-014/015).
**CODEBASE.md update?**: Yes — add OperationErrorPanel.jsx to file map
**Architecture compliance**: Functional React component; inline styles for dynamic; no dangerouslySetInnerHTML

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ONBD-017 · Docs — CODEBASE.md + DECISIONS.md + TASKS.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#codebasemd-sections-to-update
- **Dependencies**: ONBD-001 through ONBD-016
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**: CODEBASE.md updates: (1) Add OperationErrorPanel.jsx to file map with props list; (2) Add 7 new IPC channels to IPC table (check-claude, check-whisper, check-ffmpeg, check-whisper-model, download-whisper-model, retry-transcription, retry-generation) + 3 push channels (whisper-download-progress, transcription-slow-warning, generation-slow-warning) + 3 setup channels (check-setup-complete, set-setup-complete, reset-setup-complete); (3) Add TRANSCRIPTION_ERROR and GENERATION_ERROR rows to state machine table; (4) Add lastTempAudioPath, lastTranscript, currentMode to main.js module-scope vars table. DECISIONS.md: add D-ONBD-001 feature start entry. TASKS.md: mark ONBD-001 through ONBD-016 complete and update What just happened.

**Acceptance criteria**:
- [ ] OperationErrorPanel.jsx in CODEBASE.md file map
- [ ] All 13 new/new-push IPC channels in IPC table
- [ ] TRANSCRIPTION_ERROR + GENERATION_ERROR in state table
- [ ] lastTempAudioPath, lastTranscript, currentMode in module-scope vars table
- [ ] DECISIONS.md entry added
- [ ] TASKS.md fully updated

**Self-verify**: Re-read FEATURE_PLAN.md#codebasemd-sections-to-update. Verify no section was missed.
**Test requirement**: N/A — docs only.
**⚠️ Boundaries**: CODEBASE.md update rule: must be current within one task. Do not drift.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task
**Architecture compliance**: CODEBASE.md update rule from CLAUDE.md

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-ONBOARDING-WIZARD
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Welcome screen shown on first launch only (setupComplete flag)
- [ ] Setup wizard steps 1-3 verify tools actually work (not just path exists)
- [ ] Whisper model download with real progress bar shown before first use
- [ ] All-done screen sets setupComplete + launches app
- [ ] Skip option available on each step with confirmation
- [ ] Settings panel "Recheck setup" option works
- [ ] Transcription error shown in right panel with actual stderr
- [ ] Error-specific fix command shown with copy button
- [ ] "Try again" retries on same temp audio file
- [ ] Generation auth error detected and shown separately
- [ ] Generation timeout (45s) detected and shown
- [ ] Generation empty response detected and shown
- [ ] 20s transcription warning shown inline
- [ ] 30s generation warning shown inline
- [ ] All new tests pass
- [ ] Linter clean (npm run lint)
- [ ] No regressions in existing modes (balanced, refine, image, video, workflow)
- [ ] CODEBASE.md updated for all structural changes
- [ ] DECISIONS.md entry added
---
