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

🔄 **FEATURE-004 — React migration** — Renderer migrated to React + Vite (13/14)
   Estimated: approx. 20-24 hours (S: 8, M: 6)
   Branch: feat/react-migration (DO NOT merge to main until all smoke tests pass)
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
   [ ] FCR-014 · Manual smoke test (18 items) — human must verify before merge to main
   → Full specs: vibe/features/2026-04-19-react-migration/FEATURE_TASKS.md (agent use)

⬜ Auto-paste into active app — evaluate after v1 stickiness confirmed
⬜ Custom shortcuts — user-configurable hotkey
⬜ Broader distribution — notarisation, Sparkle auto-update, public landing page

---

## What just happened
✅ FCR-001 thru FCR-013 complete — React migration code shipped (2026-04-19)
   Branch: feat/react-migration | Build: npm run build:renderer → dist-renderer/ ✅
   - vite.config.js, package.json scripts (dev, build:renderer, start:react)
   - src/renderer/: App.jsx, 5 state components, WaveformCanvas, MorphCanvas, 2 hooks, 3 CSS files
   - main.js: loadURL/loadFile based on NODE_ENV
   - History: saveToHistory() on every PROMPT_READY (promptly_history, cap 100)
   - lint: 0 errors

## What's next
⬜ FCR-014 · Manual smoke test — run `npm run start:react` and verify all 18 items in FEATURE_SPEC.md§3
   - All 5 states render · waveforms animate · shortcut · transcription · copy/edit/regen · history · glass morphism
   - Then: merge feat/react-migration → main
Say "next" to continue OR run the smoke test manually and report results.
