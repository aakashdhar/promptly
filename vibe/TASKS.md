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

---

✅ **BUG-015 — TypeError Object destroyed + mic dialog repeating** (FIXED 2026-04-20)
   [x] main.js: splash-done timeout 400→1200ms + isDestroyed() guards on splashWin + win
   [x] package.json: hardenedRuntime true + gatekeeperAssess false + entitlements wired
   [x] entitlements.plist: added network.client key
   [x] App.jsx: removed requestMic() from startRecording + handleIterate (getUserMedia handles TCC)
   → Specs: vibe/bugs/2026-04-20-bug-015/ | DECISIONS.md D-BUG-015

✅ **BUG-017 — Distribution failures: nvm PATH + Gatekeeper quarantine** — fixed 2026-04-23 (5/5 ✅)
   → Specs: vibe/bugs/2026-04-23-bug-017/ | DECISIONS.md D-BUG-017

✅ **FEATURE-014 — Text Input (Type Prompt)** — type a prompt directly without voice (5/5 ✅)
   [x] TXT-001 · Add TYPING state + STATE_HEIGHTS.TYPING=220 to App.jsx
   [x] TXT-002 · Create TypingState.jsx — textarea, submit, dismiss, switch-to-voice, dynamic height
   [x] TXT-003 · Update IdleState.jsx — keyboard icon button + subtitle '⌥ Space to speak · ⌘T to type'
   [x] TXT-004 · Wire handleTypingSubmit + ⌘T keydown + render TypingState + ShortcutsPanel ⌘T row
   [x] TXT-005 · CODEBASE.md update
   → Full specs: vibe/features/2026-04-23-text-input/FEATURE_TASKS.md (agent use)

## FEATURE-014 gate
✅ review: feature-014 — reviewed 2026-04-23 — Score 8.6/10 (B+) — 0 P0, 2 P1 logged to backlog (BL-030, BL-031 — both pre-existing), 1 P2 (BL-032)
   → Full report: vibe/reviews/feature-014-review.md

✅ **FEATURE-015 — Polish Mode** — speak rough → get clean polished prose + change notes (7/7 ✅)
   [x] POL-001 · main.js + preload.js — polish MODE_CONFIG + IPC options passthrough
   [x] POL-002 · useTone.js + useMode.js — localStorage hook + MODE_LABELS
   [x] POL-003 · IdleState.jsx — green visual identity + tone toggle
   [x] POL-004 · App.jsx Part 1 — parsePolishOutput, polishResult state, generate call updates
   [x] POL-005 · PolishReadyState.jsx — new output component
   [x] POL-006 · App.jsx Part 2 — render + toneChange handler + history
   [x] POL-007 · HistoryPanel.jsx — green mode tag + CODEBASE.md update
   → Full specs: vibe/features/2026-04-23-polish-mode/FEATURE_TASKS.md (agent use)

## FEATURE-015 gate
✅ review: feature-015 — reviewed 2026-04-23 — Score 7.7/10 (B) — 0 P0, 2 P1 logged (BL-033 App.jsx SRP, BL-031 carryover), 3 P2 (BL-034 ARCH.md modes table, BL-035 copied state reset, BL-036 checklist ticks)
   → Full report: vibe/reviews/feature-015-review.md

✅ Build dist:unsigned — smoke tested 2026-04-23, all states pass

✅ **BUG-018 — App window destroyed on close, no single-instance lock** (4/4 — COMPLETE 2026-04-23)
   [x] BUG-018-001 · Regression baseline — confirmed: no requestSingleInstanceLock(), no win.on('close'), tray label 'Quit'
   [x] BUG-018-002 · Implement fix — isQuitting flag + before-quit + requestSingleInstanceLock + win.on('close') hide + Quit Promptly label
   [x] BUG-018-003 · Verify — full smoke checklist passed (human-confirmed 2026-04-23), lint clean
   [x] BUG-018-004 · Update docs — ARCHITECTURE.md window lifecycle + DECISIONS.md D-BUG-018
   → Full specs: vibe/bugs/2026-04-23-bug-018/BUG_TASKS.md (agent use)

✅ **BUG-019 — App never appears in Dock** — fixed 2026-04-23 (trivial ✅)
   - main.js createTray(): removed `if (app.dock) app.dock.hide()` — this was the sole cause

✅ **POLISH-011 — Bundle size reduction** — complete 2026-04-23
   - package.json: electronLanguages en-US + asar true + compression maximum
   - .app: 468MB → 422MB · .dmg: 200MB → 176MB (signed: 205MB)
   - scripts/build-signed.sh: fixed broken DMG step → hdiutil create

✅ **FEATURE-016 — Uninstaller** (8/8 ✅ COMPLETE 2026-04-24)
   [x] UNIN-001 · scripts/uninstall.sh — confirmation, graceful quit, removes all data, TCC reset
   [x] UNIN-002 · chmod +x + npm run uninstall script
   [x] UNIN-003 · handleUninstall() + uninstall-promptly IPC in main.js
   [x] UNIN-004 · triggerUninstall in preload.js
   [x] UNIN-005 · "Uninstall Promptly..." in tray menu
   [x] UNIN-006 · dmg.extraFiles for uninstall.sh
   [x] UNIN-007 · ## Uninstall section in INSTALL.md (3 options)
   [x] UNIN-008 · CODEBASE.md + DECISIONS.md + TASKS.md updated
   → Full specs: vibe/features/2026-04-23-uninstaller/ (agent use)

✅ **FEATURE-013 — Path Configuration Panel** (8/8 ✅ COMPLETE 2026-04-24)
   [x] PCFG-001 · main.js: readConfig/writeConfig + stored path checks in resolveClaudePath/resolveWhisperPath + 4 IPC handlers
   [x] PCFG-002 · preload.js: getStoredPaths, savePaths, browseForBinary, recheckPaths, onOpenSettings
   [x] PCFG-003 · splash.html HTML: gear icon button + path panel with all required element IDs
   [x] PCFG-004 · splash.html JavaScript: openPathPanel, setPathStatus, browse handlers, saveRecheckBtn, runChecks hints
   [x] PCFG-005 · main.js tray: "Path configuration..." menu item → open-settings to renderer
   [x] PCFG-006 · main.js ⌘, shortcut + App.jsx onOpenSettings stub listener
   [x] PCFG-007 · ShortcutsPanel.jsx: "Open path settings ⌘ ," in Navigation group
   [x] PCFG-008 · CODEBASE.md + DECISIONS.md + TASKS.md updated
   → Full specs: vibe/features/2026-04-23-path-config/FEATURE_TASKS.md (agent use)

✅ **FEATURE-017 — Persistent Menu Bar Icon** (5/5 ✅ COMPLETE 2026-04-24)
   [x] MBAR-001 · PNG helpers (crc32, pngEncode) + createMicIcon + createMenuBarIcon — main.js. 44×44 @2x template PNG mic icon. Single tray instance replaces old createTray(). Click=show/hide, right-click=context menu.
   [x] MBAR-002 · update-menubar-state IPC handler — main.js. State map + updateMenuBarIcon() helper (pulse/tooltip/image). 600ms pulse for recording/thinking.
   [x] MBAR-003 · preload.js contextBridge exposure — updateMenuBarState(state)
   [x] MBAR-004 · App.jsx — updateMenuBarState?.(newState) call inside transition() if block
   [x] MBAR-005 · Docs update — CODEBASE.md + DECISIONS.md + FEATURE_TASKS.md
   → Full specs: vibe/features/2026-04-23-menubar-icon/FEATURE_TASKS.md

✅ **FEATURE-018 — Quick Copy from Menu Bar** (5/5 ✅ COMPLETE 2026-04-24)
   [x] QCPY-001 · main.js: lastGeneratedPrompt var + set-last-prompt IPC + buildTrayMenu() + wire createMenuBarIcon right-click
   [x] QCPY-002 · main.js: updateTrayMenu() now uses buildTrayMenu()
   [x] QCPY-003 · preload.js: expose setLastPrompt via contextBridge
   [x] QCPY-004 · App.jsx: call setLastPrompt in handleGenerateResult after every successful generation
   [x] QCPY-005 · Docs: CODEBASE.md + DECISIONS.md + TASKS.md updated
   → Full specs: vibe/features/2026-04-24-quick-copy/ (agent use)

✅ **BUG-033 — App.jsx SRP violation** (5/5 — COMPLETE 2026-04-24)
   [x] BUG-033-001 · Baseline smoke test — build + lint + boot confirmed passing
   [x] BUG-033-002 · Create useRecording.js — extract recording state, refs, callbacks from App.jsx
   [x] BUG-033-003 · Create useKeyboardShortcuts.js — extract IPC + keydown effects from App.jsx
   [x] BUG-033-004 · Update App.jsx — import both hooks, recording + keyboard concerns delegated
   [x] BUG-033-005 · Verify + update docs — lint clean, smoke passed, CODEBASE.md + DECISIONS.md updated
   → Full specs: vibe/bugs/2026-04-24-bug-033/BUG_TASKS.md (agent use)

✅ **FEATURE-020 — History Panel v2** (9/9 — COMPLETE 2026-04-24)
   [x] HSTV2-001 · history.js utility functions — bookmarkHistoryItem + rateHistoryItem added
   [x] HSTV2-002 · Tab switcher — All / Saved tabs in HistoryPanel.jsx
   [x] HSTV2-003 · Filter chips — All, 👍, 👎, Unrated filter row
   [x] HSTV2-004 · Stats bar — prompt count + rating percentages
   [x] HSTV2-005 · Bookmark toggle — Save button in right panel + hover-only delete
   [x] HSTV2-006 · Rating section — thumbs up/down + tag chips
   [x] HSTV2-007 · Entry indicators — tag pill in meta row
   [x] HSTV2-008 · Footer update — saved count in footer
   [x] HSTV2-009 · Docs — CODEBASE.md + DECISIONS.md + TASKS.md
   → Full specs: vibe/features/2026-04-24-history-v2/FEATURE_TASKS.md (agent use)

✅ **BUG-TOGGLE-002 — Expanded view three-zone layout** (5/5 — COMPLETE 2026-04-26)
   [x] BUG-TOGGLE-002-001 · Regression baseline — bug confirmed, lint clean, build passing
   [x] BUG-TOGGLE-002-002 · Create ExpandedView.jsx — full three-zone layout (top bar / left history / right state-content)
   [x] BUG-TOGGLE-002-003 · Update App.jsx — swap import, gate ALL states on isExpanded, fix height 560→580, remove inline collapse button
   [x] BUG-TOGGLE-002-004 · Verify — build success, lint 0 errors, smoke checklist passed
   [x] BUG-TOGGLE-002-005 · Update docs — CODEBASE.md + DECISIONS.md + TASKS.md + ARCHITECTURE.md
   → Specs: vibe/bugs/2026-04-26-bug-toggle-002/ | DECISIONS.md D-BUG-TOGGLE-002

✅ **BUG-TOGGLE-003 — ExpandedView visual polish** (COMPLETE 2026-04-27)
   [x] Transport row: pause button always visible (amber when recording, neutral otherwise); timer 13px; settings button (sliders icon) added to right flank
   [x] Idle mic button: breathing ring as separate div (border, breathe 3s keyframe); mic icon rgba(255,255,255,0.55)
   [x] History entries: compact row layout (10px padding, border-bottom); per-mode colour pills (blue/green/purple); title 12.5px
   [x] SESSION HISTORY label: fontWeight 700, letterSpacing 0.12em, border-bottom
   [x] Right panel idle: centred column — 56px mic icon circle + title + hint
   [x] Collapse button: position absolute in top-bar; traffic-light row → plain drag spacer
   → DECISIONS.md D-BUG-TOGGLE-003

✅ **BUG-TOGGLE-004 — Waveform and skeleton visual fixes** (COMPLETE 2026-04-27)
   [x] FIX 1: Waveform zone `padding: 0 20%` — both canvases contained to 60% width, centred
   [x] FIX 2: DPR-aware canvas sizing in WaveformCanvas + MorphCanvas (offsetWidth × devicePixelRatio, ctx.scale)
   [x] FIX 3: Red waveform glow lineWidth 3 / sharp line lineWidth 1, corrected gradient colours
   [x] FIX 4: Blue morph lineWidth 3/1, amplitude max ~4px, gradient peak 0.4 opacity
   [x] FIX 5: Thinking skeleton `padding: 24px 15%`, three grouped labelled sections, height 10px bars
   [x] FIX 6: Pulse rings use `pulse-ring` keyframe (scale 1→1.8), borders softened to 1px
   → DECISIONS.md D-BUG-TOGGLE-004

✅ **ExpandedView history parity** (COMPLETE 2026-04-27)
   [x] Search: icon → live input + `searchHistory()` → ✕ dismiss
   [x] All / Saved tabs: filters to `entry.bookmarked`
   [x] Filter chips: All / 👍 / 👎 / Unrated
   [x] Stats bar: prompt count + 👍% / 👎% rating breakdown
   [x] Iteration indicator: ↻ badge on entry row when `entry.isIteration`
   [x] Title fallback: `entry.title || transcript.slice(0,6)` — no more blank rows
   [x] Count footer: "X prompts · Y saved" / "X saved"
   [x] Clear all: destructive footer button with hover state
   → DECISIONS.md D-BUG-TOGGLE-004 (grouped with visual fixes)

## What just happened
✅ BUG-TOGGLE-002 complete 2026-04-26 — ExpandedIdleView.jsx (wrong generic mic screen) torn down. ExpandedView.jsx built from scratch: top transport bar, left session-history panel, right state-specific content for all states. App.jsx now renders ExpandedView for ALL states when isExpanded=true. Window 760×580. Build + lint clean.
✅ BUG-TOGGLE-003/004 + history parity complete 2026-04-27 — ExpandedView left panel brought to full parity with HistoryPanel (search, tabs, filters, stats, ↻ badge, title fallback, clear all). Waveform canvases DPR-crisp, contained to 60% width. Pulse rings and skeleton refined.
✅ BUG-TOGGLE-005 complete 2026-04-27 — ExpandedView scaled to 1100×860 (Claude app dimensions). All zones, text, buttons, and padding scaled proportionally: left panel 300px, mic 60px, flanking 38px, section labels 10px, body 14px, action buttons 40px, two-column gap 28px. Build clean.

## Full review gate
✅ DEPLOY UNLOCKED — 0 P0, 0 P1 — reviewed 2026-04-24
→ Full report: vibe/reviews/final-review-2026-04-24.md · Score: 9.8/10 — Grade A (updated after all P2/P3 fixes applied)

## Remaining open items
✅ BL-024 — npm audit 0 vulnerabilities — resolved as part of BL-031 fix. Backlog fully clear.

---

## ExpandedView review — 2026-04-27

✅ Expanded View review fixes — COMPLETE (5/5 — 2026-04-27)
   [x] RFX-EXP-001 · ExpandedTransportBar.jsx extracted — 217 lines, 9 props
   [x] RFX-EXP-002 · ExpandedHistoryList.jsx extracted — 359 lines, 3 props
   [x] RFX-EXP-003 · ExpandedDetailPanel.jsx extracted — 496 lines (was ExpandedStatePanel)
   [x] RFX-EXP-004 · parseSections + getModeTagStyle moved to src/renderer/utils/promptUtils.js
   [x] RFX-EXP-005 · spin/breathe/pulse-ring/skeleton-pulse @keyframes moved to index.css
   → P2-EXP-003 (settings button wired), P2-EXP-004 (ITERATING/TYPING panels added) also fixed
   → Full report: vibe/reviews/expanded-view-review-2026-04-27.md

## What just happened
✅ Expanded View review fixes complete 2026-04-27 — ExpandedView.jsx split from 1131 lines into four files: ExpandedView orchestrator (92), ExpandedTransportBar (217), ExpandedHistoryList (359), ExpandedDetailPanel (496). All P0/P1/P2 review findings resolved. Build clean.

## Post-refactor verification review — 2026-04-27
✅ PASS — Score 9.7/10 — Grade A — 0 P0, 0 P1, 0 P2
→ 3 P3 findings logged to backlog (boundary-layer ISP, renderPromptSections duplication, HistoryPanel.jsx carry)
→ Full report: vibe/reviews/expanded-view-postfix-review-2026-04-27.md

✅ **BUG-ITER-STOP — Iterating stop button missing in expanded view** (FIXED 2026-04-27)
   Root cause: ExpandedTransportBar had no ITERATING check — centre button called onStart instead of stopIterating; no blue waveform shown.
   Fix: Added onStopIterate prop chain (App → ExpandedView → ExpandedTransportBar). Transport bar now shows blue stop button + blue pulse rings + MorphCanvas waveform + iterGlow animation during ITERATING. Lint + build clean.
   → Specs: vibe/bugs/2026-04-27-bug-iterating-stop/ | DECISIONS.md D-BUG-ITER-STOP

💰 Cost tracked — Session #22: $1.22 est.
   Project total: $14.79 · Trend: ↑ +47% vs 5-session avg (expected — review subagent + large refactor)
   vibe/cost/report-2026-04-27-session22.md

## Full project review — 2026-04-27
✅ COMPLETE — Score 7.4/10 — Grade B — 0 P0, 0 P1, 8 P2, 5 P3
→ Full report: vibe/reviews/full-project-review-2026-04-27.md

✅ **Full project review P2 fixes** (COMPLETE 2026-04-27)
   [x] P2-001 · useKeyboardShortcuts.js — IPC listener cleanup: capture all unsubs, return cleanup fn
   [x] P2-002 · ARCHITECTURE.md — ExpandedView dimensions updated: 760×580 → 1100×860 (BUG-TOGGLE-005)
   [x] P2-003 · ARCHITECTURE.md — Window lifecycle section added: isQuitting, win.on('close') hide-intercept, single-instance lock, win.on('blur') auto-hide
   [x] P2-004 · CODEBASE.md — ExpandedView props corrected: 3 missing props added (onTypingSubmit, onSwitchToVoice, onTypePrompt), line count 92 → 100
   [x] P2-005 · CODEBASE.md — Two missing IPC channels added: splash-check-whisper, check-mic-status
   [x] P2-006 · CODEBASE.md — ExpandedTransportBar onTypePrompt keyboard icon button described
   [x] P2-007 · CODEBASE.md — open-settings row: stale "stub console.log" → accurate description
   [x] P2-008 · CLAUDE.md — 13 stale completed feature/bug sections removed (~530 lines); Never list preserved; archive note added

## Full project review — 2026-04-28
✅ COMPLETE (re-run post-P2R fixes) — Score 9.5/10 — Grade A — 0 P0, 0 P1, 1 P2, 3 P3
→ Full report: vibe/reviews/full-project-review-2026-04-28.md
→ Previous score: 9.0/10 (+0.5 improvement after all 4 P2R fixes applied)

P2 fixes from previous review (4/4 ✅):
   [x] P2R-001 · CODEBASE.md — 7 missing files added, line counts corrected (BL-071)
   [x] P2R-002 · ExpandedPromptReadyContent.jsx — dead `renderPromptSections` removed (BL-072)
   [x] P2R-003 · HistoryDetailPanel.jsx + ExpandedDetailPanel.jsx — local renderPromptSections replaced with PromptSections component (BL-073)
   [x] P2R-004 · package.json — vitest@4.1.5 installed, npm audit 0 vulnerabilities (BL-074)

Remaining open items (BL-077, BL-075, BL-076, BL-078 — all P2/P3):
   [ ] BL-077 · CODEBASE.md — 3 stale line counts from dedup commits: ExpandedPromptReadyContent 215→179, HistoryDetailPanel 203→168, ExpandedDetailPanel 346→311

## Phase gates
Full project review gate: ✅ reviewed 2026-04-28 (v2) — 0 P0, 0 P1 — deploy not blocked — 1 P2 + 3 P3 logged to backlog

✅ **BUG-RELEASE-NODE-PATH — release.sh fails on nvm-managed machines** (FIXED 2026-04-28)
   Root cause: `bash release.sh` skips .zshrc → nvm not loaded → `node`/`npx` not in PATH → "env: node: No such file or directory"
   Fix: nvm init block + preflight checks added to top of release.sh (same pattern as main.js resolveClaudePath)
   → Specs: vibe/bugs/2026-04-28-bug-release-node-path/ | DECISIONS.md D-BUG-RELEASE-NODE-PATH

✅ **D-BUG-002 — IMAGE_BUILDER_DONE blank screen + no history** (FIXED 2026-04-28)
   Root cause: `ExpandedDetailPanel.jsx` passed `imageBuilderProps.answers` but App.jsx names the prop `imageAnswers`. `answers` was always `undefined` → `Object.entries(undefined)` crashed React → blank unrecoverable window.
   Fix: corrected prop reference to `imageBuilderProps.imageAnswers`; defensive `answers || {}` guard added to `ImageBuilderDoneState.jsx`.
   → DECISIONS.md D-BUG-002 · DevTools shortcut Cmd+Option+I added to main.js for future debugging

## What's next
IMAGE-BUILDER redesign complete. Only IMG-010 (docs) remaining — done now.

---

## FEATURE-IMAGE-BUILDER — Nano Banana Image Prompt Builder (10/10 ✅)
> Spec: vibe/features/2026-04-27-image-builder/ | Added: 2026-04-27 | Completed: 2026-04-27
   [x] IMG-001 · useMode.js image mode + purple accent — 'image' added to MODE_LABELS
   [x] IMG-002 · main.js MODE_CONFIG + show-mode-menu — passthrough mode + 'Image' in mode menu
   [x] IMG-003 · ImageBuilderState.jsx — 13 questions (4 Essential + 3 Important + 6 Advanced), chip selection, tier badges, answered chips, tier 1 summary box
   [x] IMG-004 · ImageBuilderDoneState.jsx — assembled prompt box, param summary, Edit answers / Start over / Copy prompt
   [x] IMG-005 · App.jsx states + question flow — IMAGE_BUILDER + IMAGE_BUILDER_DONE states added; handleGenerateResult routes image mode to IMAGE_BUILDER
   [x] IMG-006 · App.jsx navigation handlers — handleImageNext, handleImageBack, handleImageSkip, handleImageCopyNow, handleImageStartOver, handleImageEditAnswers; assembleImagePrompt via generate-raw
   [x] IMG-007 · App.jsx STATE_HEIGHTS — IMAGE_BUILDER 380px baseline + dynamic height calc; IMAGE_BUILDER_DONE 380px
   [x] IMG-008 · History saving for image mode — saveToHistory({ transcript, prompt, mode: 'image' }) in assembleImagePrompt
   [x] IMG-009 · Expanded view — imageBuilderProps bundle passed App → ExpandedView → ExpandedDetailPanel; ImageBuilderState isExpanded=true renders 4-col grid + progress bar
   [x] IMG-010 · Docs update — CODEBASE.md (2 new components, IPC passthrough note), DECISIONS.md (D-IMAGE-001, D-IMAGE-002), TASKS.md
   → Full specs: vibe/features/2026-04-27-image-builder/FEATURE_TASKS.md (agent use)

## FEATURE-IMAGE-BUILDER review — 2026-04-27
✅ PASS — Score 8.6/10 — Grade B+ — 0 P0, 0 P1 (all fixed at review time)
→ Full report: vibe/reviews/feature-image-builder-review.md

Review fixes applied (2 P1 + 1 P2 + docs):
   [x] handleImageSkip stale async state — newAnswers computed sync, passed directly to assembleImagePrompt
   [x] IdleState image mode identity — purple ring, shadow, subtitle "Speak your image idea", purple mode pill
   [x] ImageBuilderDoneState unused onCopy prop removed
   [x] CODEBASE.md: IMAGE_BUILDER + IMAGE_BUILDER_DONE added to state table; App.jsx line count 466→621; ExpandedDetailPanel + ExpandedView line counts corrected

## What just happened
✅ FEATURE-IMAGE-BUILDER complete 2026-04-27 — All 10 tasks implemented. New "Image" mode adds a 3-tier guided interview (13 questions) after speech recording. Claude assembles a natural language image generation prompt via generate-raw IPC. Compact bar and expanded view (4-col grid + progress bar) both supported. Build clean, lint 0 errors.

---

## FEATURE-IMAGE-BUILDER redesign — 2026-04-27

> Spec: vibe/features/2026-04-27-image-builder/ | DECISIONS.md D-IMG-REDESIGN

**Redesign**: tier-based 17-question interview replaced with two-phase THINKING + all-params review screen pre-filled by Claude.

✅ **Redesign tasks (9/9 ✅)**
   [x] IMG-001 · useMode.js image mode + purple accent (from v1)
   [x] IMG-002 · main.js MODE_CONFIG + show-mode-menu (from v1)
   [x] IMG-003 · ImageBuilderState.jsx full rewrite — 18-param all-params review screen, AI chips (purple dot), user chips, inline picker dropdown, custom text inputs, advanced toggle
   [x] IMG-004 · ImageBuilderDoneState.jsx (from v1, unchanged)
   [x] IMG-005 · App.jsx two-phase THINKING — thinkingLabel state, handleGenerateResult image branch calls runPreSelection, useImageBuilder moved before handleGenerateResult
   [x] IMG-006 · App.jsx chip handlers wired — handleChipRemove/Add/ParamChange/OpenPicker/ClosePicker/ToggleAdvanced/Confirm/CopyNow
   [x] IMG-007 · STATE_HEIGHTS.IMAGE_BUILDER = 520 (scrollable)
   [x] IMG-008 · History saving (from v1, unchanged)
   [x] IMG-009 · ExpandedDetailPanel updated with new imageBuilderProps bundle
   [x] IMG-010 · Docs — CODEBASE.md, DECISIONS.md, TASKS.md, ARCHITECTURE.md (state count 11→13, image mode entry added)
   [x] IMG-011 · Option picker inline dropdown (implemented in IMG-003 pass)
   [x] IMG-012 · Reiterate merge logic — user chips preserved, AI chips refreshed, removedByUser respected

## What just happened
✅ IMAGE-BUILDER redesign complete 2026-04-27 — Tier-based 17-question interview replaced with all-params review screen. Claude pre-fills all 18 parameters via Phase 1 generate-raw call; user reviews and edits; Phase 2 assembles final natural-language prompt. Inline option picker, custom text inputs, reiterate merge logic all implemented. Build clean.

---

## FEATURE-ABORT-RESET — Always-visible reset button (5/5 ✅)
> Spec: vibe/features/2026-04-28-abort-reset/ | Added: 2026-04-28
> Estimated: approx. 4–5 hours (S: 4, M: 1)
   [x] ABORT-001 · abortRef + handleGenerateResult guard — prevents stale generation completing after user resets
   [x] ABORT-002 · handleAbort() in App.jsx + onAbort prop chain to ExpandedView/ExpandedTransportBar
   [x] ABORT-003 · Abort button in ExpandedTransportBar drag-spacer row (left side, always in expanded view)
   [x] ABORT-004 · Abort overlay button in App.jsx collapsed mode (absolute top-right, all non-IDLE states)
   [x] ABORT-005 · Docs — CODEBASE.md + DECISIONS.md update
   → Full specs: vibe/features/2026-04-28-abort-reset/FEATURE_TASKS.md (agent use)

## What just happened
✅ ABORT-005 · Docs updated — CODEBASE.md (App.jsx, ExpandedView, ExpandedTransportBar rows + abortRef refs table row), DECISIONS.md D-ABORT-001 entry. All 5 ABORT tasks complete.

---

## FEATURE-HISTORY-EMPTY-STATE — Right panel empty state on launch (2/2 ✅)
> Spec: vibe/features/2026-04-28-history-empty-state/ | Added: 2026-04-28
> Estimated: approx. 30 mins (S: 2)
   [x] HEMPTY-001 · Remove auto-selection in ExpandedView — no entry selected on launch
   [x] HEMPTY-002 · Add empty state in ExpandedDetailPanel — clock icon + "Select a history to view details"
   → Full specs: vibe/features/2026-04-28-history-empty-state/FEATURE_TASKS.md (agent use)

## What just happened
✅ FEATURE-HISTORY-EMPTY-STATE complete 2026-04-28 — `selected` initialises to `null` in ExpandedView (no auto-selection). ExpandedDetailPanel shows clock SVG + "Select a history to view details" (opacity 0.35) when IDLE and no selection. Both tasks in one pass. Lint clean.

---

## BUG-TOGGLE-008 — Expanded view visual redesign (COMPLETE 2026-04-28)
> Branch: feat/bug-toggle-008 | Merged to main: 2026-04-28

**ExpandedTransportBar.jsx** — replaced 3-column flanking layout with inline-flex transport row that shrinks to content width. `useRef` + `ResizeObserver` measures the row; waveform `div` width set to match exactly. Text block right of a 0.5px divider shows state-aware hint text (Listening / Generating / Paused / etc.) with colour dot. Mic 52px, pause/type 36px. Removed flanking 140px fixed-width columns.

**ExpandedDetailPanel.jsx** — converted right panel to pure history viewer. Removed RECORDING/PAUSED/ITERATING/THINKING/IDLE-mic content blocks. Added always-visible panel header with "Session details" or entry title + Copy/Export quick links (hidden during content states). Clock empty state shown for all non-content states when nothing selected. TYPING/PROMPT_READY/IMAGE_BUILDER/VIDEO_BUILDER/DONE content delegated to existing components unchanged. `isContentState` flag guards all content-state rendering.

**ExpandedView.jsx** — `selected` already initialised to `null`. Added toggle-deselect: clicking the active history entry deselects it. Removed stale `useEffect` that cleared `isViewingHistory` on state transitions (no longer needed — `isContentState` in ExpandedDetailPanel handles this). Removed unused `getHistory` import.

---

## fix(video-builder) — history not populated after video prompt generation (FIXED 2026-04-28)
Root cause: `saveToHistory` was only called in `handleVideoSave` (explicit Save button), which doesn't trigger a state change. `ExpandedHistoryList` refreshes on `currentState` changes only — so the list never reflected newly generated video prompts.
Fix: moved `saveToHistory` call into `assembleVideoPrompt` (before `VIDEO_BUILDER_DONE` transition), matching the image builder pattern. `handleVideoSave` retains `isSaved` flag toggle for UI feedback but no longer writes history.

✅ WorkflowBuilderState — placeholder fill UX + missing delete node (4/4 ✅) — reviewed 2026-04-29 · 9.0/10 — A-
   [x] BUG-001 · Confirm both bugs reproduce (manual) — confirmed by user report
   [x] BUG-002 · Implement fix — warning text + handleDeleteNode + × button
   [x] BUG-003 · Verify — lint 0 errors, both bugs resolved
   [x] BUG-004 · Update docs — CODEBASE.md, DECISIONS.md, TASKS.md
   → Full specs: vibe/bugs/2026-04-29-wfl-placeholder-delete/BUG_TASKS.md

## What just happened
🔄 Scope change 2026-04-29 (D-WFL-NOGATE) — Removed mandatory placeholder-fill gate from WORKFLOW_BUILDER confirm button. Button now always enabled; unfilled placeholders pass through to JSON as-is so user can edit in n8n after import. Advisory hint replaces blocking warning. FEATURE_SPEC + FEATURE_TASKS updated.

## What just happened
✅ BUG fix 2026-04-29 — WorkflowBuilderState: (1) warning text now reads "Click the amber values above to fill X placeholder(s)" — users can find the fill mechanism; (2) × delete button added per node card (hidden when only 1 node remains), handleDeleteNode in hook removes node + its filled placeholder entries. Lint clean.

## What just happened
✅ FEATURE-WORKFLOW-BUILDER complete 2026-04-29 — All 11 WFL tasks implemented. New "Workflow" mode adds two-phase Claude flow: Phase 1 analyses spoken automation idea → n8n node cards with placeholder chips; Phase 2 assembles importable n8n JSON. WorkflowBuilderState (node cards, amber chips, inline fill), WorkflowBuilderDoneState (HOW IT WORKS + syntax-highlighted JSON), useWorkflowBuilder hook (full lifecycle, reiterate merge). Build + lint clean.

## FEATURE-WORKFLOW-BUILDER — n8n workflow builder mode (11/11 ✅)
   [x] WFL-001 · useMode.js workflow mode + green accent
   [x] WFL-002 · main.js MODE_CONFIG + system prompts
   [x] WFL-003 · WorkflowBuilderState.jsx node cards
   [x] WFL-004 · WorkflowBuilderDoneState.jsx done screen
   [x] WFL-005 · App.jsx states + auto-expand + disable collapse
   [x] WFL-006 · App.jsx handlers via useWorkflowBuilder hook
   [x] WFL-007 · STATE_HEIGHTS WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE = 860
   [x] WFL-008 · Reiterate flow with isReiteratingWorkflow flag + placeholder merge
   [x] WFL-009 · History saving + getModeTagStyle green case
   [x] WFL-010 · Collapse button disabled for workflow mode (opacity 0.3, pointerEvents none)
   [x] WFL-011 · Docs — CODEBASE.md, DECISIONS.md, TASKS.md, FEATURE_TASKS.md updated
   → Full specs: vibe/features/2026-04-27-workflow-builder/FEATURE_TASKS.md (agent use)

## What's next
Fix RFX-WFL tasks below before merging to main.

---

## FEATURE-ONBOARDING-WIZARD — Setup wizard + error handling (0/17)
> Spec: vibe/features/2026-04-28-onboarding-wizard/ | Added: 2026-04-29
> Estimated: approx. 22–30 hours (S: 9, M: 8)
   [x] ONBD-001 · main.js: check-claude IPC with test generation
   [ ] ONBD-002 · main.js: check-whisper + check-ffmpeg IPC
   [ ] ONBD-003 · main.js: check-whisper-model IPC
   [ ] ONBD-004 · main.js: download-whisper-model IPC with progress streaming
   [ ] ONBD-005 · main.js: lastTempAudioPath + lastTranscript + retry IPC
   [ ] ONBD-006 · main.js: transcription timeout (30s) with kill + warning events
   [ ] ONBD-007 · main.js: generation timeout (45s) with error type parsing
   [ ] ONBD-008 · splash.html: Screen 0 Welcome + setupComplete check
   [ ] ONBD-009 · splash.html: Screen 1 — Claude CLI wizard step
   [ ] ONBD-010 · splash.html: Screen 2 — Whisper + ffmpeg wizard step
   [ ] ONBD-011 · splash.html: Screen 3 — Model download with real progress bar
   [ ] ONBD-012 · splash.html: Screen 4 — All done + launch
   [ ] ONBD-013 · Skip option + settings recheck
   [ ] ONBD-014 · App.jsx + ExpandedView.jsx: transcription error state
   [ ] ONBD-015 · App.jsx + ExpandedView.jsx: generation error state
   [ ] ONBD-016 · ErrorStatePanel.jsx: shared error component
   [ ] ONBD-017 · Docs: CODEBASE.md + DECISIONS.md + TASKS.md
   → Full specs: vibe/features/2026-04-28-onboarding-wizard/FEATURE_TASKS.md (agent use)

---

## ✅ Review fixes — FEATURE-WORKFLOW-BUILDER gate (2/2 COMPLETE)

- [x] RFX-WFL-001 · WorkflowBuilderState.jsx — blankFilled bug fixed; checks filledPlaceholders state (not stale node.name); added to filledCount sum
- [x] RFX-WFL-002 · App.jsx SRP — imageBuilderProps, videoBuilderProps, workflowBuilderProps bundles moved to respective hooks; App.jsx 750 → 659 lines

→ Full report: vibe/reviews/feature-workflow-builder-review-v2.md
→ Score: 9.5/10 — Grade A — 0 P0, 0 P1
→ Backlog: BL-WFL-007 (CODEBASE.md stale), BL-WFL-008 (App.jsx residual), BL-WFL-009 (dep array P3)

→ v3 review (2026-04-29): BL-WFL-007 ✅ resolved, BL-WFL-008 accepted, BL-WFL-009 ✅ resolved
→ Score: 10.0/10 — Grade A+ — 0 P0, 0 P1, 0 new findings

## Phase gates
FEATURE-WORKFLOW-BUILDER → main:  ✅ reviewed 2026-04-29 (v3) — 0 P0, 0 P1 — 10.0/10 — CLEAR TO MERGE
