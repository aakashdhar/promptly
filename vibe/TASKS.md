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
⬜ review: phase 2 — pending

---

## Phase 3 — Polish and hardening
> Runs after Phase 2 gate passes. No new features.
> Phase 3 exit: run `review: final` — 0 P0 + 0 P1 before distributing.

⬜ Error state audit — verify all 9 error messages surface correctly with right text; all tap-to-dismiss
⬜ Manual smoke test — exercise all 6 states × all 5 modes; check shortcut conflict notice; verify no hangs
⬜ Build verification — npm run dist produces universal .dmg; install and run on Apple Silicon; verify on Intel if available
⬜ Distribution prep — write 5-line Slack message (what it does, download link, two clicks to start, example use case)

## Final gate
⬜ review: final — pending

---

## Phase 4+ — Future (not in current build)
> Planned so Phase 1-3 architecture doesn't foreclose these.
> Run `brainstorm:` when ready to plan the next version.

⬜ Prompt history / library — persist and browse past generated prompts · planned for v2
⬜ Menu bar / tray icon — always-visible quick access · planned for v2
⬜ Auto-paste into active app — copy + switch + paste automation · evaluate after v1 stickiness confirmed
⬜ Dark mode — follow macOS appearance setting · planned for v2
⬜ Custom shortcuts — user-configurable hotkey · planned for v2
⬜ Multi-language speech — non-English webkitSpeechRecognition · planned for v2
⬜ Broader distribution — notarisation, Sparkle auto-update, public landing page · if v1 stickiness confirmed

---

## What just happened
✅ BUG-008 — Prompt output formatting fixed:
   - Replaced 5 separate MODE_SYSTEM_PROMPTS strings with a single PROMPT_TEMPLATE + MODE_CONFIG
   - Section labels now plain text (Role: not **Role:**) — rule 10 enforced in template
   - Technical prompts always get Tech stack + Data model sections (rule 3)
   - UI/design prompts always get Visual style section (rule 4)
   - Transcript embedded in system prompt via {TRANSCRIPT} replacement — stdin write removed
   Lint: 0 errors · DECISIONS.md BUG-008 logged

## What's next
⬜ Manual smoke test: record a technical prompt and a UI prompt, verify section labels are plain text, Tech stack/Data model appear for technical, Visual style appears for UI.
Then run `review: phase 2` to trigger the phase gate.
