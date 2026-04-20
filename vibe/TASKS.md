# TASKS — Promptly
> macOS floating bar that turns speech into structured Claude prompts.
> For BetaCraft team members already on Claude CLI — zero setup, zero friction.
> One file to watch. Updated after every task.

---

## Phase 1 — Foundation
> No user-facing features. Sets up the Electron shell that all UI features depend on.
> Phase 1 exit: run `review: phase 1` when all tasks complete.

- [x] P1-001 · package.json — electron v31+, electron-builder config, start + dist + lint scripts, no runtime deps
- [x] P1-002 · entitlements.plist — microphone entitlement for hardened runtime (required for webkitSpeechRecognition)
- [x] P1-003 · main.js skeleton — BrowserWindow: frameless, vibrancy, alwaysOnTop, contextIsolation, 480px wide
- [x] P1-004 · preload.js skeleton — contextBridge with placeholder electronAPI methods (all 5 IPC channels stubbed)
- [x] P1-005 · index.html skeleton — valid HTML5, empty body, system font applied, window opens without errors
- [x] P1-006 · PATH resolution — exec('zsh -lc "which claude"') at app-ready, cache to claudePath, log result
- [x] P1-007 · Global shortcut — register ⌥Space (fallback ⌃\` if taken), send shortcut-triggered to renderer, log in console
- [x] P1-008 · IPC channel stubs — all 5 channels in ipcMain: generate-prompt, copy-to-clipboard, check-claude-path return placeholder
- [x] P1-009 · Smoke test + CODEBASE.md — npm start opens window, shortcut fires console log, claudePath visible; populate CODEBASE.md

## Phase 1 gate
✅ review: phase 1 — reviewed 2026-04-18 — Score 7.9/10 (B) — 0 P0, 3 P1 fixed inline, 3 P2 logged to backlog

---

## Phase 2 — Core features
> Build order is deliberate — features are sequenced by dependency.
> A feature marked [needs: X] cannot start until X is complete.
> Features marked [parallel with: X] can run simultaneously.
> Phase 2 exit: run `review: phase 2` when all features complete.

✅ **F-STATE — State machine + full UI skeleton** (5/5 — COMPLETE)
   [x] FST-001 · JS foundation — module vars, localStorage wrappers, setState() skeleton
   [x] FST-002 · DOM structure — all 6 state panels in #app with correct IDs
   [x] FST-003 · CSS — all 6 states fully styled, animations, design tokens
   [x] FST-004 · Window resize IPC — resize-window channel in main.js + preload.js, setState() wires resize
   [x] FST-005 · Boot + IPC wire-up — shortcut listeners, DOMContentLoaded → IDLE, CODEBASE.md update
   → Full specs: vibe/features/2026-04-18-state-machine/FEATURE_TASKS.md (agent use)

✅ **F-FIRST-RUN — First-run setup checklist** (4/4 — COMPLETE)
   Estimated: approx. 3-4 hours (S: 3, M: 1)
   [x] FRN-001 · Boot gate + DOM ID fix — gate boot on firstRunComplete, add id to mic status span
   [x] FRN-002 · initFirstRun() — CLI check via IPC + mic pre-check via permissions API
   [x] FRN-003 · Mic grant button handler — getUserMedia, success/error status update
   [x] FRN-004 · checkFirstRunCompletion() + IDLE transition — 600ms delay, CODEBASE.md update
   → Full specs: vibe/features/2026-04-18-first-run/FEATURE_TASKS.md (agent use)

✅ **F-SPEECH — Speech recording** (5/5 — COMPLETE)
   Estimated: approx. 5 hours (S: 3, M: 2)
   [~] FPH-001 · Module vars + startRecording() — webkitSpeechRecognition (superseded — retrofit pending)
   [~] FPH-002 · Handlers + stopRecording() — webkitSpeechRecognition (superseded — retrofit pending)
   [x] FPH-001-R · Retrofit module vars + startRecording() for MediaRecorder
   [x] FPH-004 · transcribe-audio IPC — main.js + preload.js (Whisper CLI)
   [x] FPH-002-R · Retrofit stopRecording() + onstop handler + shortcut wiring
   [x] FPH-003 · CODEBASE.md update
   → Full specs: vibe/features/2026-04-18-speech-recording/FEATURE_TASKS.md (agent use)

✅ **D-004 — Traffic lights + visual waveform** (2/2 — COMPLETE)
   Estimated: approx. 2-3 hours (S: 1, M: 1)
   [x] D004-001 · main.js — titleBarStyle: hiddenInset + trafficLightPosition: { x: 12, y: 10 }
   [x] D004-002 · index.html — left padding for traffic light area + 30-bar waveform (IDLE static grey, RECORDING animated red sine+noise)

✅ **F-CLAUDE — Claude CLI integration + 5 prompt modes** (4/4 — COMPLETE)
   Estimated: approx. 5-6 hours (S: 2, M: 2)
   [x] FCL-001 · generate-prompt IPC — replace stub with real spawn + MODE_SYSTEM_PROMPTS + 30s timeout
   [x] FCL-002 · Replace F-CLAUDE setTimeout stub in mediaRecorder.onstop — call generatePrompt IPC → PROMPT_READY
   [x] FCL-003 · Mode context menu — right-click IDLE bar, 5 modes, checkmark, setMode + label update
   [x] FCL-004 · CODEBASE.md update
   → Full specs: vibe/features/2026-04-18-claude-integration/FEATURE_TASKS.md (agent use)

✅ **F-ACTIONS — Copy, Edit, Regenerate** (4/4 — COMPLETE)
   Estimated: approx. 3-4 hours (S: 3, M: 1)
   [x] FAC-001 · Copy button — green flash 1.8s + clipboard IPC
   [x] FAC-002 · Edit mode — contenteditable, Escape cancel, Done save
   [x] FAC-003 · Regenerate — originalTranscript → THINKING → PROMPT_READY
   [x] FAC-004 · CODEBASE.md update
   → Full specs: vibe/features/2026-04-18-actions/FEATURE_TASKS.md (agent use)

✅ **BUG-003 — 4 visual fixes** (4/4 — COMPLETE 2026-04-18)
   [x] Ghost behind recording pill — pill now own BrowserWindow (pillWin); win.hide() on recording start
   [x] Traffic lights at bottom — .traf align-items:center added
   [x] Blank flash before THINKING — resizeWindow wrapped in requestAnimationFrame
   [x] Ghost below prompt ready — #bar min-height:100vh fills window; pillWin lifecycle ensures clean transitions
   → Specs: vibe/bugs/2026-04-18-bug-003/ | DECISIONS.md BUG-003 entry

✅ **DECISION-004 — Recording state moved into main win** (COMPLETE 2026-04-18)
   [x] pillWin + all pill IPC channels removed from main.js
   [x] showPill/hidePill/pillStop/pillDismiss/onPillAction removed from preload.js
   [x] panel-recording added to index.html — traf, cr-rec (dismiss/waveform/timer/stop), transcript-wrap
   [x] drawRecordingWave(), startRecTimer(), stopRecTimer() added to index.html
   [x] pill.html deleted
   → DECISIONS.md DECISION-004 entry

## Phase 2 gate
✅ review: phase 2 — reviewed 2026-04-18 — Score 6.4/10 (C+) — 0 P0, 2 P1 logged, 6 P2 logged, 4 P3 logged
   → Full report: vibe/reviews/phase-2-review.md

---

## Phase 3 — Polish and hardening
> Runs after Phase 2 gate passes. No new features.
> Phase 3 exit: run `review: final` — 0 P0 + 0 P1 before distributing.

### P1 fixes from Phase 2 review (BL-013, BL-014) — COMPLETE
✅ BL-013 — renderPromptOutput regex updated → /^([A-Za-z][A-Za-z\s]*):\s*$/ — plain-text labels now styled
✅ BL-014 — RAF loop leak fixed — morphAnimFrame stores inline RAF handle; stopMorphAnim() now cancels correctly
✅ BL-015/016/017/018/019/020 — all P2 doc + security fixes applied
✅ BL-021/022/023 — all P3 code cleanup applied

### Phase 3 polish
✅ Error state audit — all error messages human-readable; regenerate path now propagates specific error; ERROR panel tap-to-dismiss confirmed; lint 0 errors
⬜ Manual smoke test — exercise all 5 states × all 5 modes; check shortcut conflict notice; verify no hangs; test Regenerate 5× to confirm no RAF accumulation after BL-014 fix
✅ Build verification — dist/Promptly-1.0.0-universal.dmg produced (199 MB); human must install on Apple Silicon + verify on Intel
✅ Distribution prep — vibe/distribution/slack-message.md written (5-line Slack message ready)

✅ Review fixes — Final gate (2/2)
   [x] RFX-001 · Remove 6 console.log statements from main.js
   [x] RFX-002 · Manual smoke test complete (human-confirmed 2026-04-18)

## Final gate
✅ review: final — reviewed 2026-04-18 — Score 8.7/10 (B+) — 0 P0, 0 P1 — CLEARED FOR DISTRIBUTION
   → Full report: vibe/reviews/final-review.md

---

## Phase 4 — v2 Features
> Run `next` to start the next task.

✅ **FEATURE-002 — Design mode** (COMPLETE 2026-04-18)
   [x] Add `design` key to `MODE_CONFIG` in main.js with standalone 12-section prompt
   [x] Add `design` to `show-mode-menu` IPC handler in main.js
   [x] Add `{ key: 'design', label: 'Design' }` to `MODES` in index.html
   [x] Update `getModeLabel()` in index.html
   [x] `standalone: true` flag on design config — bypasses PROMPT_TEMPLATE
   → DECISIONS.md: FEATURE-002 entry logged

✅ **F-HISTORY — Prompt history** (4/4 — COMPLETE 2026-04-19)
   [x] FHI-001 · History storage module — saveToHistory(), loadHistory(), capped at 20
   [x] FHI-002 · HISTORY state panel + CSS — scrollable list, empty state
   [x] FHI-003 · History trigger — pill in IDLE, button in PROMPT_READY, ⌥Space to close
   [x] FHI-004 · CODEBASE.md update
   → Full spec: vibe/features/2026-04-18-prompt-history/FEATURE_TASKS.md

✅ **F-TRAY — Menu bar / tray icon** (3/3 — COMPLETE 2026-04-19)
   [x] FTR-001 · Create tray icon in main.js — NativeImage, click to toggle show/hide
   [x] FTR-002 · Keep app alive when window closed + hide Dock icon
   [x] FTR-003 · CODEBASE.md update
   → Full spec: vibe/features/2026-04-18-tray-icon/FEATURE_TASKS.md

✅ **F-DARKMODE — Dark / light mode** (3/3 — COMPLETE 2026-04-19)
   [x] FDM-001 · Light mode CSS tokens + body.light overrides for all 5 states
   [x] FDM-002 · main.js nativeTheme listener → theme-changed IPC + get-theme handler
   [x] FDM-003 · Renderer theme wiring + CODEBASE.md + ARCHITECTURE.md
   → Full spec: vibe/features/2026-04-18-dark-mode/FEATURE_TASKS.md

✅ **F-LANGUAGE — Multi-language speech** (3/3 — COMPLETE 2026-04-19)
   [x] FLG-001 · Language storage module — LANGUAGES constant, getLanguage/setLanguage wrappers
   [x] FLG-002 · Wire language to Whisper CLI + language pill + native menu
   [x] FLG-003 · CODEBASE.md + ARCHITECTURE.md update
   → Full spec: vibe/features/2026-04-18-multi-language/FEATURE_TASKS.md

✅ **FEATURE-004 — React migration** — Renderer migrated to React + Vite (14/14 — COMPLETE 2026-04-19)
   Estimated: approx. 20-24 hours (S: 8, M: 6)
   Branch: feat/react-migration → merged to main
   [x] FCR-001 · Branch + install devDeps — git checkout -b feat/react-migration, npm install vite + react
   [x] FCR-002 · vite.config.js + package.json scripts + electron-builder files config
   [x] FCR-003 · src/renderer folder structure + index.html + main.jsx
   [x] FCR-004 · CSS migration: tokens.css + bar.css + states.css (exact copy from index.html)
   [x] FCR-005 · useMode.js + useWindowResize.js hooks
   [x] FCR-006 · App.jsx state machine core — state vars, transition(), IPC wiring, theme
   [x] FCR-007 · IdleState.jsx — pulse ring, mode pill, click handler
   [x] FCR-008 · WaveformCanvas.jsx + RecordingState.jsx — red sine wave RAF + timer
   [x] FCR-009 · MorphCanvas.jsx + ThinkingState.jsx — blue morph wave + YOU SAID
   [x] FCR-010 · PromptReadyState.jsx — copy flash, edit/done, regenerate, reset
   [x] FCR-011 · ErrorState.jsx — error badge + dismiss
   [x] FCR-012 · main.js: load React build (NODE_ENV dev → localhost:5173, prod → dist-renderer)
   [x] FCR-013 · History foundation: saveToHistory() in App.jsx, localStorage cap 100
   [x] FCR-014 · Manual smoke test (18 items) — human-confirmed 2026-04-19, all items pass
   → Full specs: vibe/features/2026-04-19-react-migration/FEATURE_TASKS.md (agent use)

✅ **FEATURE-006 — Keyboard shortcuts panel + global shortcuts** (5/5 — COMPLETE 2026-04-19)
   [x] FSC-001 · ShortcutsPanel.jsx — 8 shortcut rows, key chips, Done button
   [x] FSC-002 · App.jsx SHORTCUTS state — STATE_HEIGHTS 380px, prevStateRef, render
   [x] FSC-003 · App.jsx keyboard listener — Escape, ⌘C, ⌘E + onShowShortcuts IPC
   [x] FSC-004 · main.js + preload.js — context menu item, ⌘? global shortcut, Alt+P
   [x] FSC-005 · IdleState ⌘? hint + feature docs
   → Full specs: vibe/features/2026-04-19-keyboard-shortcuts/FEATURE_TASKS.md

✅ **FEATURE-007 — Export formats** — save-file IPC + .md export from PROMPT_READY (4/4 — COMPLETE 2026-04-19)
   → Full specs: vibe/features/2026-04-19-export-formats/FEATURE_TASKS.md (agent use)

✅ **FEATURE-008 — Export simplification** — single-click .md export, format picker removed (2/2 — COMPLETE 2026-04-19)
   → Full specs: vibe/features/2026-04-19-export-md-only/FEATURE_TASKS.md (agent use)

✅ **BUG-SC-001 — ShortcutsPanel three fixes** — Escape returns to prevState, ⌥Space starts recording, Done visible + padding (FIXED 2026-04-19, smoke tested ✅)

✅ **FEATURE-009 — History Panel (Split View)** — browse, search, delete, reuse past prompts (5/5 — COMPLETE 2026-04-19)
   [x] HIST-001 · history.js utility — extract + extend saveToHistory, getHistory, deleteHistoryItem, clearHistory, searchHistory, formatTime
   [x] HIST-002 · HistoryPanel.jsx — split-panel UI: left list + search + per-entry delete, right detail + copy/reuse
   [x] HIST-003 · App.jsx wiring — HISTORY state, ⌘H keydown, onShowHistory IPC, openHistory/closeHistory helpers, render HistoryPanel
   [x] HIST-004 · main.js + preload.js — resize-window-width IPC, "History ⌘H" context menu item, show-history push
   [x] HIST-005 · CODEBASE.md update
   → Full specs: vibe/features/2026-04-19-history-panel/FEATURE_TASKS.md (agent use)

✅ **BUG-011 — HistoryPanel layout broken** (FIXED 2026-04-19)
   - HistoryPanel.jsx: full rewrite with inline styles only — Tailwind layout classes were not applying
   - App.jsx root div: switched from `w-[520px]` Tailwind className to `width:100%` inline style
   - Added `set-window-size` IPC (main.js + preload.js) — sets width + height atomically with min/max constraints updated; fixes race condition between separate resize calls
   - openHistory/closeHistory: now use setWindowSize(746, 720) / setWindowSize(520, IDLE) directly
   - Discovered: BrowserWindow had `minWidth:520, maxWidth:520` — must call setMinimumSize/setMaximumSize before setSize to change width

✅ **FEATURE-010 — Refine Mode** (5/5 — COMPLETE 2026-04-20)
   [x] RFNE-001 · main.js — refine added to MODE_CONFIG (standalone) + show-mode-menu array
   [x] RFNE-002 · useMode.js — refine: 'Refine' added to MODE_LABELS
   [x] RFNE-003 · IdleState.jsx — purple pill + pulse ring + mic stroke + subtitle text
   [x] RFNE-004 · PromptReadyState.jsx — status line + purple section labels + purple copy button
   [x] RFNE-005 · CODEBASE.md + ARCHITECTURE.md + DECISIONS.md + TASKS.md updated
   → Full specs: vibe/features/2026-04-20-refine-mode/FEATURE_TASKS.md (agent use)

✅ **FEATURE-011 — Pause and Resume Recording** (3/3 — COMPLETE 2026-04-20)
   Estimated: approx. 3-4 hours (S: 1, M: 2)
   [x] PAUZ-001 · Core state, timer, pause/resume logic — App.jsx + preload.js
   [x] PAUZ-002 · RecordingState pause button + PausedState.jsx + pauseGlow keyframe
   [x] PAUZ-003 · Wire PAUSED render in App.jsx + CODEBASE.md update
   → Full specs: vibe/features/2026-04-20-pause-resume/FEATURE_TASKS.md (agent use)

✅ **FEATURE-012 — Iteration Mode** — refine a generated prompt with a new voice recording (6/6 ✅)
   [x] ITR-001 · generate-raw IPC + iterGlow CSS — main.js, preload.js, index.css
   [x] ITR-002 · IteratingState.jsx — blue banner + waveform + timer + stop button
   [x] ITR-003 · App.jsx — ITERATING state + full iteration recording + dismiss flow
   [x] ITR-004 · PromptReadyState.jsx — ↻ Iterate button + ↻ iterated badge
   [x] ITR-005 · history.js + HistoryPanel.jsx — isIteration fields + ↻ indicator
   [x] ITR-006 · CODEBASE.md + ARCHITECTURE.md + DECISIONS.md updated
   → Full specs: vibe/features/2026-04-20-iteration-mode/FEATURE_TASKS.md (agent use)

✅ **BUG-012 — PATH resolution fails in packaged DMG** (FIXED 2026-04-20)
   [x] BUG-012-001 · main.js — resolveClaudePath() expanded + resolveWhisperPath() added + await both + whisper exec cmd fix
   [x] BUG-012-002 · Lint clean + dev boot verified
   [x] BUG-012-003 · CODEBASE.md + ARCHITECTURE.md + DECISIONS.md updated
   → Full specs: vibe/bugs/2026-04-20-bug-012/ | DECISIONS.md D-BUG-012

⬜ Broader distribution — notarisation, Sparkle auto-update, public landing page

---

## What just happened
✅ BUG-012 — PATH resolution fixed — 2026-04-20
   - resolveClaudePath(): common paths checked first (fs.existsSync), then zsh → bash fallback
   - resolveWhisperPath(): new function, same pattern + python3 -m whisper fallback
   - Both awaited in app.whenReady() before window creation — race condition eliminated
   - transcribe-audio: whisperCmd handles 'python3 -m whisper' multi-word case
   - CODEBASE.md + ARCHITECTURE.md + DECISIONS.md updated

## What's next
⬜ Smoke checklist — build dist:unsigned, install from DMG, verify both splash checks pass
⬜ Broader distribution — notarisation, Sparkle auto-update, public landing page
