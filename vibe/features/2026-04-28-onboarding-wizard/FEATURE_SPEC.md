# FEATURE-ONBOARDING-WIZARD — Setup wizard + error handling

## Problem
Two users attempted to install Promptly and both encountered silent
failures mid-flow. The splash screen checks paths exist but does not
verify tools actually work. The expanded view shows no errors when
transcription or generation fails — the app silently returns to idle.
This causes confusion, abandonment, and zero adoption.

Three specific failure modes confirmed in production:
1. Whisper path found but ffmpeg missing — transcription fails silently
2. Claude CLI path found but not logged in — generation fails silently
3. Whisper model not downloaded — first transcription hangs for 2-3
   minutes with no feedback (model downloads ~150MB on first use)

## Solution
Two distinct changes:

### Change 1 — Splash screen becomes a setup wizard
Not a path checker. A step-by-step wizard that verifies each dependency
actually works — not just that the binary exists. Includes explicit
Whisper model download with progress bar. Blocks launch until everything
is verified working end-to-end.

### Change 2 — Expanded view shows errors
Every async operation (transcription, generation) has a timeout and
error state shown in the right panel with the exact error, the fix
command, a copy button, and a retry button.

---

## SETUP WIZARD — detailed spec

### Screen 0 — Welcome
Shown on first launch only (check setupComplete in config.json via
readConfig/writeConfig — the existing zero-dep persistence pattern).
If setupComplete === true skip wizard entirely and go straight to app.
If setupComplete is missing or false → show welcome screen.

Layout:
  Promptly logo + name + tagline top
  Body text: "Before you start, Promptly needs three tools installed
    on your Mac. This takes about 5 minutes and only happens once."
  Three step preview cards:
    Card 1: Step 1 circle (blue) + "Claude CLI" + "The AI that writes
      your prompts" + "~1 min" right-aligned
    Card 2: Step 2 circle + "Whisper + ffmpeg" + "Converts your voice
      to text" + "~3 min"
    Card 3: Step 3 circle + "Voice model download" + "One-time 150MB
      download for transcription" + "~1 min"
  Primary button: "Let's set up Promptly →"
    background: purple gradient rgba(168,85,247,0.85) → rgba(124,58,237,0.85)
    width 100%, height 44px, border-radius 12px

### Progress indicator (shown on steps 1-3)
Horizontal stepper at top of each step screen:
  Step 0 (welcome): no stepper
  Steps 1-3: show completed steps as green checkmark circles,
    current step as purple circle with number,
    future steps as grey circles with number
  Progress bar between steps fills purple as steps complete

### Screen 1 — Claude CLI check

VERIFICATION (not just path check):
  1. Run resolveClaudePath() — find binary
  2. Run: execFile(claudePath, ['--version']) — verify it responds
  3. Run a TEST GENERATION:
     execFile(claudePath, ['-p', 'respond with only the word READY'])
     with 15 second timeout
     If output contains 'READY' → Claude is working end-to-end
     If output contains auth/login error → not logged in
     If timeout → CLI found but not responding

States:

CHECKING state (auto-runs on screen load):
  Spinner + "Checking Claude CLI..."
  Sub-states shown sequentially:
    "Looking for Claude CLI..."
    "Verifying version..."
    "Testing generation..."

FOUND AND WORKING state:
  Green dot + "Claude CLI — working"
  Shows: path found + version number
  Shows: "Test generation passed ✓"
  Auto-advances to Screen 2 after 1.5 seconds

NOT FOUND state:
  Red dot + "Claude CLI not found"
  Explanation: "The AI engine that writes your prompts"
  Install block:
    Label: "Don't have Node.js? Install it first:"
    Code block: brew install node
    Copy button
    Label: "Then install Claude CLI:"
    Code block: npm install -g @anthropic-ai/claude-cli
    Copy button
    Label: "Then log in:"
    Code block: claude login
    Copy button
    Note: "claude login opens a browser to authenticate"
  Buttons: "Need help?" (secondary) + "Check again ↺" (primary purple)
    "Need help?" → opens https://docs.anthropic.com/en/docs/claude-code/
      via existing splash-open-url IPC channel

NOT LOGGED IN state (binary found, auth fails):
  Amber lock icon + "Claude CLI found but not logged in"
  Explanation: "Your session expired or you haven't logged in yet"
  Fix block:
    Code block: claude login
    Copy button
    Note: "This opens a browser to authenticate with Anthropic"
  Buttons: "Check again ↺" (primary purple)

NOT RESPONDING state (found, version ok, test generation fails):
  Red dot + "Claude CLI not responding"
  Show exact error output from the test generation in a monospace box
  Fix suggestions:
    "Try running in Terminal:" + code block: claude -p "hello" + copy
    "If that works, click Check again"
    "If not, try: claude logout && claude login"
  Buttons: "Check again ↺" (primary)

### Screen 2 — Whisper + ffmpeg check

VERIFICATION:
  1. Run resolveWhisperPath() — find whisper binary
  2. Run resolvefffmpegPath() — find ffmpeg binary
  3. Run: execFile(whisperPath, ['--help']) — verify whisper responds
  4. Run: execFile(ffmpegPath, ['-version']) — verify ffmpeg responds

States:

CHECKING state:
  Spinner + "Checking Whisper and ffmpeg..."

BOTH FOUND state:
  Green dot + "Whisper — found at [path]"
  Green dot + "ffmpeg — found at [path]"
  Auto-advances to Screen 3 after 1 second

WHISPER NOT FOUND state:
  Red dot + "Whisper not found"
  Install block:
    "Don't have Python? Install it first:"
    Code: brew install python + copy
    "Then install Whisper:"
    Code: pip3 install openai-whisper + copy
  Buttons: "Check again ↺"

FFMPEG NOT FOUND state (whisper ok, ffmpeg missing):
  Green dot + "Whisper — found ✓"
  Red dot + "ffmpeg not found — required for audio processing"
  Install block:
    Code: brew install ffmpeg + copy
  Note: "ffmpeg processes audio before Whisper can transcribe it"
  Buttons: "Check again ↺"

BOTH NOT FOUND state:
  Both red dots
  Combined install block:
    "Install everything at once:"
    Code block (multiline):
      brew install python ffmpeg
      pip3 install openai-whisper
    Single copy button copies all three commands

### Screen 3 — Voice model download

PURPOSE: Explicitly handle the Whisper model download that previously
happened silently mid-session, hanging the app for 2-3 minutes.

VERIFICATION:
  Check if Whisper model is already cached:
    modelCachePath = path.join(os.homedir(), '.cache', 'whisper', 'base.pt')
    OR: path.join(os.homedir(), 'Library', 'Caches', 'whisper', 'base.pt')
  If file exists and size > 100MB → model already downloaded

MODEL ALREADY DOWNLOADED state:
  Green dot + "Voice model ready (base, 148MB)"
  "Already downloaded — no action needed"
  Auto-advances to Screen 4 (success) after 1 second

MODEL NOT DOWNLOADED state:
  Show before starting download:
    Icon: download arrow
    Title: "Voice model download required"
    Body: "Whisper needs a voice model to understand speech. This is
      a one-time 148MB download. Once done, Promptly works fully
      offline — your voice never leaves your Mac."
    Info box: "This would have happened silently on your first
      recording. We're doing it now so you don't hit a surprise
      2-minute wait later."
  Primary button: "Download now (148MB)"

DOWNLOADING state (after button click):
  Spinner + "Downloading Whisper base model"
  Real progress bar with MB progress and time remaining
  Implementation:
    Spawn: whisper /dev/null --model base 2>&1
    Parse stderr output for download progress
    Update progress bar in real time via IPC
    whisper downloading outputs lines like:
      "100%|█████| 139M/139M [00:45<00:00, 3.24MiB/s]"
    Parse percentage from this output
  Progress bar:
    height 3px, background rgba(255,255,255,0.06)
    fill: linear-gradient rgba(10,132,255,0.7) → rgba(10,132,255,0.9)
    border-radius 2px
  Labels: "XX MB of 148 MB" left + "~XX seconds remaining" right
  Info box: "This only happens once"
  Button: "Downloading... please wait"
    opacity: 0.45, cursor: default, pointerEvents: none

DOWNLOAD COMPLETE state:
  Green checkmark + "Voice model downloaded successfully"
  Auto-advances to Screen 4 after 1 second

DOWNLOAD FAILED state:
  Red dot + "Download failed"
  Show error details
  Retry button: "Try again"
  Alternative: "Download manually" text link
    URL: https://huggingface.co/openai/whisper-base
    Opens via existing splash-open-url IPC channel

### Screen 4 — All done

Layout:
  Large green checkmark circle (56px)
  Title: "You're all set"
  Body: "Everything is installed and verified. Promptly is ready."
  Three verification rows:
    ✓ Claude CLI — installed and logged in
    ✓ Whisper — installed, model ready  
    ✓ ffmpeg — installed
  Primary button: "Launch Promptly"
    On click: call set-setup-complete IPC (writes setupComplete:true to
      config.json via writeConfig) → then call splash-done IPC

### Re-run wizard option
In main app settings panel, add a "Recheck setup ↺" button.
  Clicking it calls the reopen-wizard IPC channel.
  main.js 'reopen-wizard' handler:
    1. Reset: writeConfig({ ...readConfig(), setupComplete: false })
    2. Recreate splashWin (it was destroyed after original splash-done)
       — use same BrowserWindow config as original app.whenReady() splash
    3. splashWin.loadFile('splash.html')
    4. splashWin.show()
    5. win.hide()
  This allows manual re-verification anytime.

### Skip option (for experienced users)
On Screen 1, 2, 3 — show a small "Skip setup (advanced)" link at bottom
  font-size 11px, color rgba(255,255,255,0.18)
  Clicking shows a confirmation: "Are you sure? Promptly may not work
    correctly if dependencies are missing."
  Confirm → call set-setup-complete IPC → call splash-done IPC

---

## EXPANDED VIEW ERROR HANDLING

### Transcription error state

Trigger: whisper process exits with non-zero code OR times out (30s)

Collapsed (non-expanded) mode behaviour:
  If transcription fails while app is collapsed, transition to the
  existing ERROR state (STATE_HEIGHTS.ERROR = 101px) with message:
  "Transcription failed — expand to retry"
  Tap-to-dismiss returns to IDLE. No retry in collapsed mode.

Expanded mode behaviour (TRANSCRIPTION_ERROR state, 860px):

Top bar update (ExpandedTransportBar):
  Hint text changes to "Transcription failed" with a red dot
  (same hint-text-row pattern as existing state-aware labels)
  Waveform zone hidden; hint text is the only content right of divider

Right panel — error state:
  Centred layout, flex column, gap 14px
  
  Error icon: 48px circle, rgba(255,59,48,0.08) bg,
    rgba(255,59,48,0.2) border, red exclamation SVG inside

  Title: "Transcription failed"
    font-size 16px, font-weight 500, rgba(255,255,255,0.75)
  
  Body: "Whisper couldn't process the audio."
    font-size 12.5px, rgba(255,255,255,0.38), line-height 1.7
  
  Error details box:
    background rgba(255,255,255,0.03)
    border rgba(255,255,255,0.07), border-radius 9px
    padding 10px 14px
    Label: "ERROR DETAILS" — 9px uppercase rgba(255,255,255,0.2)
    Content: actual stderr output from whisper process
      font-family monospace, font-size 10.5px, rgba(255,100,90,0.55)
      max-height 80px, overflow-y auto

  Error-specific fix box (amber):
    background rgba(255,189,46,0.04)
    border rgba(255,189,46,0.12), border-radius 9px
    Label: "FIX" — amber uppercase
    Content depends on error type:
      ffmpeg error → "brew install ffmpeg" + copy
      model not found → "whisper --model base /dev/null" + copy
      permission error → chmod fix command + copy
      unknown → "Open settings to verify paths" + link

  Action row:
    "Open settings" button (secondary)
    "Try again ↺" button (primary purple)
      Clicking retries transcription on the same audio file
      If audio file still in temp storage, re-run whisper on it
      If audio gone, show: "Please record again" and return to idle

### Generation error state

Trigger: claude process exits with non-zero code OR times out (45s)
OR stdout is empty after process completes

Collapsed (non-expanded) mode behaviour:
  If generation fails while app is collapsed, transition to the
  existing ERROR state (STATE_HEIGHTS.ERROR = 101px) with message:
  "Generation failed — expand to retry"
  Auth errors: "Claude not logged in — expand to fix"
  Tap-to-dismiss returns to IDLE. No retry in collapsed mode.

Expanded mode behaviour (GENERATION_ERROR state, 860px):

Top bar update (ExpandedTransportBar):
  Hint text changes based on errorType:
    auth → amber dot + "Not logged in"
    timeout → amber dot + "Claude timed out"
    empty → amber dot + "Empty response"
    unknown → red dot + "Generation failed"

Error types and right panel content:

AUTH ERROR (output contains 'not authenticated', 'login', 'unauthorized'):
  Amber lock icon
  Title: "Claude is not logged in"
  Body: "Your session expired or you haven't logged in yet."
  Fix box:
    Code: claude login + copy button
    Note: "This opens a browser to authenticate"
  Actions: "I've logged in — Try again ↺"

TIMEOUT (45 seconds, no response):
  Clock icon (amber)
  Title: "Claude took too long to respond"
  Body: "This can happen with slow connections or if Claude CLI
    needs updating."
  Fix box:
    "Check your internet connection"
    Code: claude update + copy
  Actions: "Try again ↺"

EMPTY RESPONSE (process exits 0 but stdout empty):
  Warning icon
  Title: "Claude returned an empty response"
  Body: "The CLI ran successfully but returned nothing.
    This may be a Claude CLI version issue."
  Fix box:
    Code: claude update + copy
    Code: claude -p "hello" + copy (to test manually)
  Actions: "Try again ↺"

UNKNOWN ERROR:
  Red icon
  Title: "Generation failed"
  Body: exact stderr shown in monospace error box
  Fix box:
    Code: claude -p "hello" + copy (to test manually in Terminal)
  Actions: "Open settings" + "Try again ↺"

### Manual retry button
In both transcription and generation error states:
  "Try again ↺" always retries the last operation
  For transcription: re-runs whisper on the temp audio file
    (keep temp file until next recording starts, not until error dismissed)
  For generation: re-runs claude with the same transcript
    Store last transcript in App.jsx as lastTranscript ref
    Generation retry uses lastTranscript

### Timeout handling
Transcription timeout: 30 seconds
  After 20 seconds: show warning text node in ThinkingState layout,
    positioned below the MorphCanvas and above the "YOU SAID" block.
    Text: "Taking longer than expected... Whisper may still be processing."
    Style: font-size 11px, color rgba(255,189,46,0.7), text-align center
    Controlled by transcriptionSlow prop (boolean) on ThinkingState.
  After 30 seconds → kill process → transition to TRANSCRIPTION_ERROR
    (expanded) or ERROR (collapsed)

Generation timeout: 45 seconds
  After 30 seconds: show warning text node in same position in
    ThinkingState (below MorphCanvas, above YOU SAID block).
    Text: "Claude is taking longer than usual..."
    Style: same as above.
    Controlled by generationSlow prop (boolean) on ThinkingState.
  After 45 seconds → kill process → transition to GENERATION_ERROR
    (expanded) or ERROR (collapsed)

---

## IPC additions (main.js)

New IPC handlers — wizard setup management:
  'check-setup-complete' → reads setupComplete from config.json
    Returns: { complete: bool }

  'set-setup-complete' → writes setupComplete: true to config.json
    Returns: { ok: true }

  'reset-setup-complete' → writes setupComplete: false to config.json
    Returns: { ok: true }

  'reopen-wizard' → recreates splashWin + resets setupComplete
    1. writeConfig({ ...readConfig(), setupComplete: false })
    2. Create new BrowserWindow (same config as original splashWin)
    3. splashWin.loadFile('splash.html')
    4. splashWin.show(); win.hide()
    Returns: { ok: true }

New IPC handlers — dependency verification:
  'check-claude' → runs resolveClaudePath + version check + test generation
    Returns: { found, path, version, working, error, authError }

  'check-whisper' → runs resolveWhisperPath + --help check
    Returns: { found, path, error }

  'check-ffmpeg' → runs resolveFfmpegPath + -version check
    Returns: { found, path, error }

  'check-whisper-model' → checks if base.pt exists in cache
    Returns: { downloaded, path, sizeMB }

  'download-whisper-model' → spawns whisper download process
    Streams progress updates via: win.webContents.send('whisper-download-progress', { percent, mbDone, mbTotal, secondsLeft })
    Returns: { success, error }

New IPC handlers — retry:
  'retry-transcription' → re-runs whisper on lastTempAudioPath
    Returns same shape as existing transcribe-audio IPC

  'retry-generation' → re-runs claude with lastTranscript and currentMode
    Returns same shape as existing generate-prompt IPC

New push channels (main → renderer):
  'whisper-download-progress' → { percent, mbDone, mbTotal, secondsLeft }
  'transcription-slow-warning' → (no payload) fired at 20s
  'generation-slow-warning' → (no payload) fired at 30s

New state in main.js:
  let lastTempAudioPath = null  // set after each recording
  let lastTranscript = null     // set after each transcription
  let currentMode = 'balanced'  // updated on each generate-prompt call

---

## Acceptance criteria

Setup wizard:
- [ ] Welcome screen shown on first launch only
- [ ] setupComplete flag checked in electron-store
- [ ] Screen 1: Claude CLI check runs test generation not just path check
- [ ] Screen 1: NOT FOUND state shows node + claude + login commands
- [ ] Screen 1: NOT LOGGED IN state detected separately from not found
- [ ] Screen 1: Test generation uses `claude -p "respond with only the word READY"`
- [ ] Screen 1: WORKING state auto-advances after 1.5s
- [ ] Screen 2: Both whisper and ffmpeg verified with --help/-version
- [ ] Screen 2: Missing states shown separately or combined
- [ ] Screen 3: Model cache checked before showing download
- [ ] Screen 3: Download shows real progress bar with MB + time remaining
- [ ] Screen 3: Download spawned via whisper --model base /dev/null
- [ ] Screen 3: Progress parsed from whisper stderr output
- [ ] Screen 4: All three green checkmarks + Launch button
- [ ] Screen 4: Launch sets setupComplete = true in electron-store
- [ ] Skip option available on steps 1-3 with confirmation dialog
- [ ] Settings panel has "Recheck setup" option

Expanded view errors:
- [ ] Transcription error shown in right panel (not silent)
- [ ] Error shows actual stderr from whisper process
- [ ] Error-specific fix command shown with copy button
- [ ] "Try again" retries on same temp audio file
- [ ] Generation auth error detected and shown specifically
- [ ] Generation timeout detected after 45 seconds
- [ ] Generation empty response detected and shown
- [ ] "Try again" for generation uses stored lastTranscript
- [ ] 20-second transcription warning shown inline
- [ ] 30-second generation warning shown inline
- [ ] Top bar shows error indicator (not just idle state)
- [ ] Temp audio file kept until next recording starts

## Files in scope
- splash.html — full wizard rewrite
- main.js — new IPC handlers, lastTempAudioPath, lastTranscript,
  timeout handling, test generation
- preload.js — must add contextBridge entries for all new IPC channels
  (check-setup-complete, set-setup-complete, reset-setup-complete,
  reopen-wizard, check-claude, check-whisper, check-ffmpeg,
  check-whisper-model, download-whisper-model, retry-transcription,
  retry-generation; listeners for whisper-download-progress,
  transcription-slow-warning, generation-slow-warning)
- src/renderer/App.jsx — TRANSCRIPTION_ERROR + GENERATION_ERROR states,
  retry handlers, timeout warnings, slow-warning IPC listeners
- src/renderer/components/ExpandedView.jsx — forward error props to panel
- src/renderer/components/ExpandedDetailPanel.jsx — render OperationErrorPanel
  for TRANSCRIPTION_ERROR + GENERATION_ERROR states
- src/renderer/components/ExpandedTransportBar.jsx — hint text for
  TRANSCRIPTION_ERROR + GENERATION_ERROR states (add to state-aware
  hint-text-row switch)
- src/renderer/components/SettingsPanel.jsx — "Recheck setup ↺" button
- src/renderer/components/OperationErrorPanel.jsx (new — replaces
  OperationErrorPanel.jsx name to avoid confusion with existing ErrorState.jsx)
- vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md

## Files out of scope
All mode-specific components (image, video, workflow builders)
All hooks (no hook changes required — error state wiring is in App.jsx)
index.css
ThinkingState.jsx — transcriptionSlow/generationSlow props added here
  (in scope for prop addition only — no layout changes)
