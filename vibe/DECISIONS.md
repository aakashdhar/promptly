# DECISIONS — Promptly
> Append-only. Every drift, scope change, tech choice — logged with full context.
> Never delete entries. Strikethrough if superseded.

## Decision types
- **drift** — deviated from PLAN.md or ARCHITECTURE.md
- **blocker-resolution** — something was impossible; workaround found
- **tech-choice** — chose between valid approaches not in plan
- **scope-change** — added/removed via `change:` command
- **discovery** — unexpected finding affecting future tasks

## Format
```
### D-[ID] — [Short title]
- **Date**: · **Task**: [TASK-ID] · **Type**: [type]
- **What was planned**:
- **What was done**:
- **Why**:
- **Alternatives considered**:
- **Impact on other tasks**:
- **Approved by**: human | agent-autonomous
```

---

### D-001 — index.html excluded from lint script
- **Date**: 2026-04-18 · **Task**: P1-005/P1-009 · **Type**: tech-choice
- **What was planned**: `eslint main.js preload.js index.html`
- **What was done**: `eslint main.js preload.js` (index.html removed)
- **Why**: ESLint 9 flat config cannot parse HTML files without `eslint-plugin-html` devDep. Adding that plugin would deviate from the "only electron + electron-builder" devDep constraint. index.html inline JS is reviewed manually as part of smoke test.
- **Alternatives considered**: Add `eslint-plugin-html` as devDep — rejected (adds devDep complexity for minimal benefit at this project size)
- **Impact on other tasks**: index.html JS correctness checked via manual smoke test only; no automatic lint gate
- **Approved by**: agent-autonomous (logged retroactively after phase-1-review P2-003 finding)

---

---

## — Feature Start: F-STATE (State machine + full UI skeleton) — 2026-04-18
> Folder: vibe/features/2026-04-18-state-machine/
> Establishes all 6 state DOM panels, setState(), module vars, localStorage wrappers, CSS, and window resize IPC.
> Tasks: FST-001 · FST-002 · FST-003 · FST-004 · FST-005 | Estimated: ~7 hours
> Drift logged below.

### D-002 — resize-window IPC channel added (not in original 5)
- **Date**: 2026-04-18 · **Task**: FST-004 · **Type**: tech-choice
- **What was planned**: 5 IPC channels (generate-prompt, copy-to-clipboard, check-claude-path, shortcut-triggered, shortcut-conflict)
- **What was done**: Added 6th channel `resize-window` — renderer → main, calls `win.setContentSize(480, height)`
- **Why**: Spec requires bar height varies by state (44px idle, ~200px prompt-ready). Electron windows cannot be resized from the renderer without a main-process call. No Web API equivalent. All alternatives (fixed large height, transparent bg) produce visible dead space below the bar.
- **Alternatives considered**: (1) Fixed large height + CSS clip — window bounds remain large, covers content beneath. (2) transparent: true on BrowserWindow — rendering side-effects, larger change. (3) Accepted: new IPC channel, minimal surface, one call per setState().
- **Impact on other tasks**: All future setState() calls automatically resize — no impact on F-SPEECH, F-CLAUDE, F-ACTIONS.
- **Approved by**: human (flagged in FEATURE_SPEC.md §7, implicit approval by proceeding)

---

---

## 2026-04-18 — Spec review: add-feature (F-FIRST-RUN)
> P0: 0 · P1: 1 · P2: 2
> Action: all fixed — label IDs added, CLI status initialised to ○, quit edge case documented
> Report: vibe/spec-reviews/2026-04-18-add-feature-first-run.md

---

## — Feature Start: F-FIRST-RUN (First-run setup checklist) — 2026-04-18
> Folder: vibe/features/2026-04-18-first-run/
> Gates IDLE boot on firstRunComplete; shows CLI + mic checklist on first launch; auto-transitions to IDLE when both pass.
> Tasks: FRN-001 · FRN-002 · FRN-003 · FRN-004 | Estimated: ~3-4 hours
> Drift logged below.

---

## 2026-04-18 — Spec review: add-feature (F-STATE)
> P0: 0 · P1: 2 · P2: 1
> Action: all fixed
> Report: vibe/spec-reviews/2026-04-18-add-feature-state-machine.md

---

## 2026-04-18 — Spec review: new-app
> P0: 1 · P1: 3 · P2: 2
> Action: all fixed before build begins
> Report: vibe/spec-reviews/2026-04-18-new-app.md

Key fixes applied:
- Mode system prompts added to SPEC.md F4 (exact text for all 5 modes)
- Conformance checklist error condition count corrected
- ARCHITECTURE.md Always + Ask First sections added (three-tier complete)
- Git branch naming convention added to ARCHITECTURE.md


---

---

### D-003 — Speech engine replaced: webkitSpeechRecognition → MediaRecorder + Whisper CLI
- **Date**: 2026-04-18 · **Type**: scope-change
- **Trigger**: change: command — user-initiated
- **Build stage**: Mid-phase (FPH-001, FPH-002 committed but wrong)
- **What changed**: F-SPEECH speech-to-text engine replaced. webkitSpeechRecognition removed. New approach: getUserMedia + MediaRecorder records audio in renderer → transcribe-audio IPC sends ArrayBuffer to main → Whisper CLI transcribes → transcript returned.
- **Why**: webkitSpeechRecognition in Electron fails with `error: network` — Electron does not bundle Google's API key required by the speech service. Confirmed via DevTools console test.
- **Before**: webkitSpeechRecognition (Web Speech API), live transcript, no IPC needed
- **After**: getUserMedia + MediaRecorder (renderer) + transcribe-audio IPC + Whisper CLI (main), no live transcript, post-processing only
- **UX impact**: RECORDING state shows "Recording…" instead of live transcript text
- **Prerequisite**: Whisper must be installed — `pip install openai-whisper`
- **Tasks affected**: Retrofit: FPH-001, FPH-002 · New: FPH-001-R, FPH-002-R, FPH-004 · Unchanged: FPH-003
- **Folders affected**: vibe/features/2026-04-18-speech-recording/FEATURE_TASKS.md
- **Architecture impact**: Yes — new IPC channel `transcribe-audio`, speech layer changes, main.js + preload.js now in scope for F-SPEECH
- **BRIEF.md updated**: No — didn't check (not critical for internal tool)
- **Approved by**: human

---

### D-004 — Traffic lights + 30-bar visual waveform
- **Date**: 2026-04-18 · **Type**: scope-change
- **Trigger**: change: command — user-initiated
- **Build stage**: Between tasks (F-SPEECH complete, F-CLAUDE not started)
- **What changed**: (1) Window title bar changed from `frame: false` to `titleBarStyle: 'hiddenInset'` with `trafficLightPosition: { x: 12, y: 10 }` — traffic lights now visible. (2) 30-bar animated waveform added to IDLE (static grey) and RECORDING (animated red, sine+noise setInterval) states.
- **Why**: Traffic lights were in original BRIEF.md intent and omitted from SPEC.md F1 at planning time. Waveform was referenced in BRIEF.md files list ("state machine, waveform, mode system") but never specced.
- **Before**: `frame: false` (no traffic lights); no waveform
- **After**: `titleBarStyle: 'hiddenInset'` + `trafficLightPosition: { x: 12, y: 10 }`; 30-bar waveform in IDLE and RECORDING
- **Tasks affected**: New: D004-001, D004-002 · Retrofit: none · Removed: none
- **Folders affected**: none (no active feature folder for window config)
- **Architecture impact**: Yes — window config pattern updated; waveform animation pattern added
- **BRIEF.md updated**: Yes
- **Approved by**: human

---

## 2026-04-18 — Spec review: add-feature (F-CLAUDE)
> P0: 0 · P1: 1 fixed · P2: 1 logged
> Action: P1-001 fixed — claude --help verification step added to FCL-001; THINKING text mismatch logged for Phase 3
> Report: vibe/spec-reviews/2026-04-18-add-feature-claude-integration.md

---

## — Feature Start: F-CLAUDE (Claude CLI integration + 5 prompt modes) — 2026-04-18
> Folder: vibe/features/2026-04-18-claude-integration/
> Replaces generate-prompt stub with real spawn call; adds MODE_SYSTEM_PROMPTS; adds mode context menu; wires PROMPT_READY.
> Tasks: FCL-001 · FCL-002 · FCL-003 · FCL-004 | Estimated: ~5-6 hours
> Dependencies met: F-SPEECH ✅, F-FIRST-RUN ✅
> Drift logged below.

---

### BUG-001 — Renderer complete rewrite: window bounds, shortcut, waveform, state containment
- **Date**: 2026-04-18 · **Type**: drift
- **Root cause**: Renderer (index.html) built without visual verification against SPEC.md. Multiple critical deviations accumulated across features.
- **Confirmed issues**: (1) IDLE height 44px instead of 80px — STATE_HEIGHTS.IDLE = 44. (2) ⌥Space signal present in main.js/preload.js but UI elements rendered outside bar clipping area so shortcut appeared to do nothing. (3) Waveform bars rendered with `width: 3px` static — no bar-height-based animation. (4) PROMPT_READY resize to 200px caused content to overflow outside bar bounds. (5) All state panels used separate `div#app` child panels outside a single clipping container.
- **Fix applied**: Complete replacement of index.html with single `#bar` container (overflow: hidden) that contains all states. Drag region (10px) + content-row (70px) = 80px IDLE. Transcript/prompt sections expand inside #bar. resize(360) for PROMPT_READY. 2px-wide animated bars for waveform.
- **IPC adaptations**: Replacement spec assumed string returns from transcribeAudio/generatePrompt — adapted to existing `{ success, transcript/prompt/error }` response shape. Buffer.from() unavailable in isolated renderer — passes ArrayBuffer directly.
- **Files changed**: index.html (full rewrite). main.js and preload.js unchanged (shortcut IPC was already correct).
- **Approved by**: human

---

## 2026-04-18 — Feature Start: F-SPEECH — Speech Recording
> Folder: vibe/features/2026-04-18-speech-recording/
> Implements webkitSpeechRecognition with live transcript, originalTranscript capture at stop, auto-stop on silence.
> Tasks: FPH-001, FPH-002, FPH-003 | Estimated: ~3 hours (S: 2, M: 1)
> Dependencies met: F-STATE ✅, F-FIRST-RUN ✅
> Drift logged below.

---

## 2026-04-18 — Feature Start: F-ACTIONS — Copy, Edit, Regenerate
> Folder: vibe/features/2026-04-18-actions/
> Wires Copy (clipboard flash), Edit (contenteditable + Escape/Done), Regenerate (originalTranscript re-run).
> Tasks: FAC-001, FAC-002, FAC-003, FAC-004 | Estimated: ~3-4 hours (S: 3, M: 1)
> Dependencies met: F-CLAUDE ✅ (generatedPrompt in PROMPT_READY state)
> All changes in index.html only — copy-to-clipboard IPC already live in main.js + preload.js.
> Drift logged below.

---

## 2026-04-18 — Spec review: add-feature (F-SPEECH)
> P0: 0 · P1: 1 · P2: 1
> Action: all fixed
> Report: vibe/spec-reviews/2026-04-18-add-feature-speech-recording.md

Key fixes applied:
- onerror 'no-speech' branch added to FEATURE_PLAN.md handler code and FEATURE_TASKS.md FPH-002 criteria
- Text cursor animation clarified as v2 deferral (blinking dot covers v1 requirement)

---

### BUG-002 — 6 visual bugs across 3 states after dark-glass design implementation
- **Date**: 2026-04-18 · **Type**: drift
- **Root cause**: Design implementation session shipped without visual verification against a running build. Six separate bugs introduced across window management, context menu, and CSS.

**BUG-002-A — Window positioning offset left (all states)**
- **Symptom**: Thinking and Prompt Ready states render offset left, overlapping the terminal behind.
- **Root cause**: `win.setPosition(width/2 - 260, height - 120)` combined with `setContentSize()` — macOS anchors `setContentSize` resizes from the top-left corner, drifting the window on each state change.
- **Fix**: Replace `win.setPosition()` with `win.center()` on launch. Change all resize calls from `setContentSize(520, h)` to `setSize(520, h, true)` — width always 520, height-only resizes, no position drift.
- **Files**: main.js

**BUG-002-B — Window width not constrained (thinking, prompt ready)**
- **Symptom**: Bar appears wider than 520px in thinking and prompt ready states.
- **Root cause**: `setContentSize` and `setSize` without explicit width in the resize-window IPC allowed the window to expand horizontally on some resize paths.
- **Fix**: `win.setSize(520, height, true)` hardcodes 520 as width on every resize call.
- **Files**: main.js

**BUG-002-C — Thinking state bottom clipped**
- **Symptom**: Bottom of the bar (YOU SAID transcript area) cut off in thinking state.
- **Root cause**: `STATE_HEIGHTS.THINKING = 204` — too short; traf(25) + cr-think(68) + morph-wrap(48) + divider(1) + ys-label(23) + ys-text(36) + padding = ~220px.
- **Fix**: `STATE_HEIGHTS.THINKING = 220`.
- **Files**: index.html

**BUG-002-D — Mode context menu first/last items not clickable, text cut off**
- **Symptom**: Clicking "Balanced" or "Code" does nothing; menu text truncated.
- **Root cause**: HTML `#mode-menu` absolutely positioned inside the Electron window — when the menu renders near the bottom/top of the 101px window, it overflows the window bounds and clips.
- **Fix**: Replace HTML context menu entirely with Electron native `Menu.buildFromTemplate` + `menu.popup({ window: win })`. IPC: renderer sends `show-mode-menu` → main builds radio menu → click handler sends `mode-selected` back to renderer.
- **Files**: main.js, preload.js, index.html

**BUG-002-E — Prompt ready scrollbar always visible**
- **Symptom**: Scrollbar renders on right edge of prompt output area even when content fits.
- **Root cause**: Missing `-webkit-scrollbar-track { background: transparent }` — system scrollbar track bleeds through the custom thin scrollbar styles.
- **Fix**: Add `:-webkit-scrollbar-track { background: transparent }` to `.prompt-out` scrollbar block.
- **Files**: index.html

**BUG-002-F — Prompt ready window height too tall (empty space below Copy button)**
- **Symptom**: Window expands beyond 480px showing dead space below btn-row.
- **Root cause**: `setContentSize` does not enforce a hard cap on macOS with `hiddenInset` — content layout can push the reported content size beyond the requested value.
- **Fix**: Switch to `win.setSize(520, height, true)` which enforces exact outer frame dimensions regardless of content.
- **Files**: main.js

- **Status**: FIXED 2026-04-18
- **Smoke test**: ⬜ pending — visual verification required by user (screenshots of all 4 states)
- **Approved by**: human

---

### BUG-003 — 4 visual bugs: ghost window, traffic lights, flash, ghost below prompt ready
- **Date**: 2026-04-18 · **Type**: drift
- **Folder**: vibe/bugs/2026-04-18-bug-003/

**BUG-003-A — Ghost window visible behind recording pill**
- **Root cause**: `vibrancy:'sidebar'` is a window-level macOS material applied to the full BrowserWindow frame. Hiding `#bar` via `display:none` removes content but vibrancy persists across the full window area.
- **Fix**: Recording pill is now a separate `BrowserWindow` (`pillWin` — transparent, frame:false, alwaysOnTop). On recording start: `win.hide()` + create pillWin. On stop/dismiss: `setState(THINKING/IDLE)` → `switchToMain()` (destroy pillWin, show win).
- **Files**: main.js (pillWin lifecycle, show-pill / switch-to-main / pill-stop / pill-dismiss IPC), preload.js (showPill, switchToMain, pillStop, pillDismiss, onPillAction), index.html (startRecording, stopRecording, onPillAction handler), pill.html (new file — pill UI)

**BUG-003-B — Traffic light dots rendering below traf container**
- **Root cause**: `.traf` had `display:flex` but was missing `align-items:center`.
- **Fix**: Added `align-items: center` to `.traf` CSS rule.
- **Files**: index.html

**BUG-003-C — Blank flash before THINKING state renders**
- **Root cause**: `resizeWindow()` IPC dispatched synchronously before the next paint. Window resized while old DOM still clearing.
- **Fix**: Wrapped all `resizeWindow()` calls in `requestAnimationFrame()` so window resizes after DOM paints.
- **Files**: index.html

**BUG-003-D — Ghost panel below prompt ready**
- **Root cause**: Same as A (vibrancy fills full window) + content shorter than window height. Also: no second createWindow() found — existing code was already single-window.
- **Fix**: Added `min-height: 100vh` to `.bar` so bar always fills window — no exposed vibrancy ghost below content. pillWin lifecycle (fix A) also ensures no stale window during THINKING/PROMPT_READY.
- **Files**: index.html

**Architecture note**: As of this fix there is ONE `win` (main BrowserWindow) and at most ONE `pillWin` (alive only during RECORDING). `pillWin` is created in `show-pill` IPC handler and destroyed in `switch-to-main` IPC handler. No other BrowserWindows are ever created.

**New file**: `pill.html` — justified deviation from "all UI in index.html" rule. The pill must be a separate BrowserWindow to isolate the vibrancy ghost. ARCHITECTURE.md note: pill.html contains self-contained pill UI with waveform/timer/buttons. It uses the same preload.js.

**New IPC channels** (deviations from locked IPC table — approved via this bug fix):
- `show-pill` (renderer → main): hide win, create pillWin
- `switch-to-main` (renderer → main): destroy pillWin, show win
- `pill-stop` (pill → main → win): forward stop action
- `pill-dismiss` (pill → main → win): forward dismiss action
- `pill-action` (main → win): forwarded stop/dismiss from pill

- **Status**: FIXED 2026-04-18
- **Approved by**: human

**BUG-003-E — pillWin ghost rectangle, rectangular shadow, and incorrect transparency**
- **Root cause (1)**: pillWin width was 520px but pill.html content is 480px wide — 40px gap on sides caused ghost transparent edges that macOS composited as grey artifacts.
- **Root cause (2)**: macOS window shadow followed the 520×90 BrowserWindow rectangle, not the pill's CSS border-radius. `hasShadow: false` removes it; pill's own `box-shadow` provides depth.
- **Root cause (3)**: No `vibrancy` or `visualEffectState` set — transparent regions not properly frosted, composited incorrectly by macOS.
- **Root cause (4)**: No explicit `backgroundColor` — transparency not guaranteed before first paint.
- **Fix**: pillWin config updated to `width: 480`, `hasShadow: false`, `vibrancy: 'under-window'`, `visualEffectState: 'active'`, `backgroundColor: '#00000000'`.
- **Files**: main.js
- **Status**: FIXED 2026-04-18
- **Approved by**: human

**BUG-003-F — Ghost window still visible behind pill (show-pill race condition)**
- **Root cause**: `win.hide()` and pillWin creation were synchronous back-to-back — macOS compositor hadn't finished hiding `win` before pillWin rendered, causing the ghost to bleed through. Additionally, on some macOS versions the window remains visually composited even after `win.hide()` returns until the next render cycle.
- **Fix 1**: Wrapped pillWin creation in `setTimeout(50)` after `win.hide()` — guarantees macOS has completed the hide before the pill window appears.
- **Fix 2**: Renamed `switch-to-main` → `hide-pill` IPC. New handler hides pillWin first, waits 50ms, then destroys pillWin and shows win. This prevents win from appearing before pillWin is fully gone.
- **Fix 3**: Added `win.setOpacity(0)` immediately before `win.hide()` (and `win.setOpacity(1)` before `win.show()`) — makes win invisible before the OS composites the hide, eliminating any frame where the window is visible during the hide animation.
- **Fix 4**: Added `!important` to `background: transparent` on `body` in pill.html — prevents any browser default or inherited background from rendering under the pill.
- **IPC rename**: `switch-to-main` → `hide-pill` (main.js + preload.js `switchToMain` → `hidePill` + index.html callers updated)
- **Files**: main.js, preload.js, index.html, pill.html
- **Status**: FIXED 2026-04-18
- **Smoke checklist**: pill floats with nothing behind it — just pill over raw desktop; win.hide() completes before pill renders; no ghost on dismiss/stop path
- **Approved by**: human

---

### DECISION-004 — Recording state moved from pillWin to main win
- **Date**: 2026-04-18 · **Type**: scope-change
- **Trigger**: feature: command — user-initiated
- **What was planned**: RECORDING state uses separate pillWin BrowserWindow (BUG-003-A fix)
- **What was done**: pillWin eliminated entirely. RECORDING state renders inside main win as a new `#panel-recording`. `pill.html` deleted. All pill IPC channels removed (`show-pill`, `hide-pill`, `pill-stop`, `pill-dismiss`, `pill-action`). New `#panel-recording` HTML added to index.html with waveform canvas, timer, dismiss button, stop button. `stopRecTimer()` / `startRecTimer()` / `drawRecordingWave()` added to index.html.
- **Why**: pillWin ghost race condition (BUG-003-F) proved intractable — three successive fixes (setTimeout, setOpacity, hide-pill ordering) still produced ghost artifacts. Root cause: macOS compositor always composites the main window during hide transition regardless of timing. Moving RECORDING into main win eliminates the race permanently.
- **Files changed**: main.js (remove pillWin, show-pill, hide-pill, pill-stop, pill-dismiss), preload.js (remove showPill, hidePill, pillStop, pillDismiss, onPillAction), index.html (add panel-recording, CSS, canvas animation, timer, dismiss/stop handlers, remove onPillAction), pill.html (deleted)
- **Alternatives considered**: (1) Continue fixing pill race with more aggressive setTimeout/opacity hacks — rejected, three iterations already failed. (2) Use a single NSPanel via native module — rejected, adds native build complexity. (3) Accepted: all UI in one window, no ghost possible.
- **Impact**: BUG-003-A/E/F bugs become permanently irrelevant. ARCHITECTURE.md "all UI in index.html" rule restored. preload.js simplified.
- **Approved by**: human

---

### BUG-004 — IDLE state: vibrancy flat, traffic light halos, mode pill appearance
- **Date**: 2026-04-18 · **Type**: drift

**BUG-004-A — Vibrancy rendering flat (brown/opaque instead of frosted glass)**
- **Root cause**: `vibrancy: 'sidebar'` does not composite correctly on all macOS versions; missing `backgroundColor: '#00000000'` meant the window had an implicit opaque background before first paint.
- **Fix**: `vibrancy: 'sidebar'` → `'under-window'`; added `backgroundColor: '#00000000'` to BrowserWindow config; added `!important` to `body { background: transparent }` and `.bar { background: rgba(255,255,255,0.04) }` to prevent any inherited or default paint overriding transparency.
- **Files**: main.js, index.html

**BUG-004-B — Traffic light colored dot halos bleeding into bar surface**
- **Root cause**: Custom HTML `.tl-r` / `.tl-y` dots had `box-shadow` glows that spread rgba color onto the frosted bar surface, visible as dirty tint against warm wallpapers.
- **Fix**: Removed all `.tl` children from every `.traf` div. Removed `.tl`, `.tl-r`, `.tl-y`, `.tl-off` CSS rules. Changed `.traf` to a 28px drag-region spacer — native macOS traffic lights from `titleBarStyle: 'hiddenInset'` render over this area. `trafficLightPosition` updated to `{ x: 12, y: 12 }`.
- **Files**: index.html, main.js

**BUG-004-C — Mode pill rendered with macOS system button appearance**
- **Root cause**: `<span>` element with no `-webkit-appearance: none` could inherit system button styling in WebKit-based renderers.
- **Fix**: Added `-webkit-appearance: none` to `.mode-pill` CSS rule.
- **Files**: index.html

- **Status**: FIXED 2026-04-18
- **Approved by**: human

---

### BUG-006 — Global vibrancy fix: frosted glass not rendering across all states
- **Date**: 2026-04-18 · **Type**: drift

**Root causes**:
1. BrowserWindow missing `frame: false` — native title bar frame was composited over the transparent window, preventing the vibrancy layer from rendering correctly.
2. BrowserWindow missing `show: false` + `ready-to-show` pattern — window shown before renderer had painted, causing a white flash that persisted as an opaque background on some macOS versions.
3. `app.commandLine.appendSwitch('enable-transparent-visuals')` absent — required for Chromium compositing to honour `transparent: true` on all macOS GPU configurations.
4. `html, body` CSS missing `background-color: transparent !important` — `background` shorthand does not always override `background-color` in Chromium's inherited style resolution.

**Fixes applied**:
- `main.js`: Added `app.commandLine.appendSwitch('enable-transparent-visuals')` before `app.whenReady()`. BrowserWindow config updated: `frame: false` added; `show: false` added; `height: 101 → 89`; `minWidth: 520` / `maxWidth: 520` added; `win.center()` removed; `win.loadFile()` and `win.once('ready-to-show', () => win.show())` added after constructor.
- `index.html`: `html, body` rule updated to add `background-color: transparent !important` and `!important` on `overflow: hidden`. Defensive `#app, #root, .app, .container, .wrapper { background: transparent !important }` added.

**Scope**: One-time global fix — applies to all states (IDLE, RECORDING, THINKING, PROMPT_READY, ERROR) without per-state changes. No solid dark hex backgrounds found in CSS — all colours are rgba or #FF3B30 (stop button, not a window background).

**Files**: main.js, index.html
- **Status**: ~~FIXED 2026-04-18~~ → superseded by follow-up below
- **Approved by**: human

---

### BUG-006 (follow-up) — Vibrancy: second round of root causes confirmed via visual diagnosis
- **Date**: 2026-04-18 · **Type**: drift

**New root causes** (found after BUG-006 first fix still showed flat/opaque bar):
1. `.bar { background: rgba(255,255,255,0.04) !important }` — even 0.04 opacity sits on top of the native vibrancy layer and blocks it. macOS vibrancy only shows through elements with `background: transparent`.
2. Electron v41 changed how `transparent: true` windows composite with vibrancy. `disable-gpu-compositing` flag required in addition to `enable-transparent-visuals`.
3. `vibrancy: 'under-window'` unreliable in Electron v31+ on some macOS GPU configurations — `'fullscreen-ui'` is more reliable.
4. No `z-index` stacking guard between `::before` frosted tint layer and content panels — content could paint below the tint.

**Fixes applied**:
- `main.js`: `vibrancy: 'under-window'` → `'fullscreen-ui'`; added `app.commandLine.appendSwitch('disable-gpu-compositing')`.
- `index.html`: `.bar { background }` changed from `rgba(255,255,255,0.04) !important` → `transparent`. `.bar::before` repurposed from top-highlight line to full frosted tint layer (`inset: 0; background: rgba(255,255,255,0.06); z-index: 0`). Top border highlight preserved via existing `border-top: var(--border-top)` on `.bar`. All 5 panels (`#panel-idle`, `#panel-recording`, `#panel-thinking`, `#panel-ready`, `#panel-error`) given `position: relative; z-index: 1` to stack above frosted tint.

**Files**: main.js, index.html
- **Status**: FIXED 2026-04-18
- **Approved by**: human

---

### BUG-007 — Thinking state: YOU SAID not scrollable, morph wave not animating
- **Date**: 2026-04-18 · **Type**: drift

**BUG-007-A — YOU SAID text overflow, no scroll, static window height**
- **Root cause**: `.ys-text-s` had no `max-height` or `overflow-y`. `STATE_HEIGHTS.THINKING` fixed at 220px regardless of transcript length. Regenerate path called `setState(THINKING)` (which clears think-transcript) but never repopulated it.
- **Fix**: Added `max-height: 80px; overflow-y: auto; scrollbar-width: thin` + webkit scrollbar styles to `.ys-text-s`. After setting `think-transcript` text (onstop path and regenerate path), measure `panel-thinking.scrollHeight` and call `resizeWindow(clamp(height, 220, 320))`. Regenerate handler now sets `think-transcript` to `originalTranscript` before resize.
- **Files**: index.html

**BUG-007-B — Morph wave RAF loop not starting**
- **Root cause**: `startMorphAnim()` used module-level `morphT`/`morphAnimFrame`. On repeated THINKING transitions the old RAF loop kept running while a new one started — conflicting global state caused erratic or invisible animation. Replaced with inline RAF using local `morphT` and named `animMorph` function scoped to each setState call.
- **Fix**: Replaced `startMorphAnim()` call in `setState(STATES.THINKING)` with inline `let morphT = 0` + `const animMorph = () => { drawMorphWave(morphCanvas, morphT++); requestAnimationFrame(animMorph); }; requestAnimationFrame(animMorph)`.
- **Files**: index.html

- **Status**: FIXED 2026-04-18
- **Approved by**: human

---

### D-005 — Claude CLI timeout extended from 30s to 60s
- **Date**: 2026-04-18 · **Type**: tech-choice
- **What was planned**: SPEC.md F4 timeout 30 seconds
- **What was done**: main.js generate-prompt handler uses `60000` ms timeout
- **Why**: 30s proved too short for complex/detailed prompts during testing — Claude CLI with a large system prompt template can take 20-40s in practice. 60s provides headroom without meaningfully degrading UX (spinner is shown throughout).
- **Approved by**: agent-autonomous (logged retroactively during phase-2 review)

---

### D-006 — set-window-buttons-visible IPC channel added
- **Date**: 2026-04-18 · **Type**: tech-choice
- **What was planned**: No IPC channel to control traffic light visibility
- **What was done**: Added `set-window-buttons-visible` IPC channel (renderer → main) that calls `win.setWindowButtonVisibility(visible)`. Called with `false` on RECORDING start, `true` on THINKING and PROMPT_READY.
- **Why**: Traffic lights are distracting during the active recording state (red stop button is the primary CTA). Electron's `setWindowButtonVisibility` API provides clean show/hide without CSS workarounds.
- **Approved by**: agent-autonomous (logged retroactively during phase-2 review)

---

### D-007 — FIRST_RUN state removed from index.html; replaced by splash.html
- **Date**: 2026-04-18 · **Type**: scope-change
- **What was planned**: F-FIRST-RUN: in-bar FIRST_RUN state, `firstRunComplete` localStorage gate, shown only on first launch
- **What was done**: FIRST_RUN state and `panel-first-run` removed from index.html (during BUG-001 full rewrite). Replaced by `splashWin` BrowserWindow (`splash.html`) via FEATURE-001 — runs every launch, auto-proceeds when checks pass.
- **Why**: Separate splash window provides better UX — animated, full-screen, branded. Runs every launch rather than first-launch-only (fast path completes in ~2s when everything is fine, so no friction on subsequent launches). Removes need for `firstRunComplete` localStorage key.
- **Impact**: `firstRunComplete` localStorage key is now unused. `STATES.FIRST_RUN` removed from state machine. `getFirstRunComplete()`/`setFirstRunComplete()` wrappers no longer needed.
- **Approved by**: human (FEATURE-001 approved, retroactively documented for D-007)

---

### BUG-008 — Prompt output formatting: plain-text section labels + data/visual sections
- **Date**: 2026-04-18 · **Task**: BUG-008 · **Type**: blocker-resolution
- **Root cause**: `MODE_SYSTEM_PROMPTS` instructed Claude to use markdown bold headers (`**Role:**`) and lacked data model / visual style sections for technical and UI prompts.
- **Fix**: Replaced 5 separate mode prompt strings with a single `PROMPT_TEMPLATE` constant + `MODE_CONFIG` object. Template embeds `{MODE_NAME}`, `{MODE_INSTRUCTION}`, and `{TRANSCRIPT}` placeholders filled at call time. Since transcript is now in the system prompt, stdin write removed (`child.stdin.end()` only). Section labels explicitly specified as plain text — no asterisks, no hashtags.
- **Files**: `main.js`
- **Status**: FIXED 2026-04-18
- **Approved by**: human

---

### FEATURE-001 — Splash screen: launch-time CLI + mic checks before idle bar
- **Date**: 2026-04-18 · **Type**: scope-change (feature addition)
- **Trigger**: feature: command — user-initiated

**What was built**: Separate `splashWin` BrowserWindow (`splash.html`) shown on app launch. Animated CLI check + mic permission check before showing the main idle bar. If CLI missing: red X + Install button (opens claude.ai/code). If mic denied: red X + error. On all-clear: "All checks passed — launching" → 600ms → `splash-done` IPC → splash hides, main win shows, shortcut registers.

**Architecture changes**:
- `resolveClaudePath()` extracted from callback into a Promise — `app.whenReady()` now `async`, awaits it before creating any window. `claudePath` guaranteed set before splash runs its check.
- `registerShortcut()` extracted into standalone function — called from `splash-done` handler, not at app launch.
- `createWindow()` auto-show removed (was `win.once('ready-to-show', () => win.show())`). Main win hidden until splash completes.
- 4 new IPC channels: `splash-done`, `splash-check-cli`, `splash-open-url`, `request-mic`.
- 4 new `electronAPI` methods in preload.js: `splashDone`, `splashCheckCLI`, `splashOpenURL`, `requestMic`.

**New file**: `splash.html` — self-contained splash UI using same `preload.js`. Frosted glass vibrancy matching main bar aesthetic. Logo ring with pulse animation, app name + tagline fade-up, check items with spinner/✓/✗ states.

**Files changed**: `main.js`, `preload.js`, `splash.html` (new)
- **Status**: SHIPPED 2026-04-18
- **Approved by**: human

---

### FEATURE-002 — Design mode: designer-specific prompt generation
- **Date**: 2026-04-18 · **Type**: scope-change (feature addition)
- **Trigger**: feature: command — user-initiated

**What was built**: A sixth prompt mode (`design`) targeting designers speaking their creative vision. The mode produces a 12-section structured prompt (Role → Output format) using vivid, specific design language — Visual personality, Colour direction, Typography direction, Motion and feel, What to avoid, etc. Unlike the five generic modes, the design instruction is self-contained and does not wrap inside PROMPT_TEMPLATE.

**Architecture changes**:
- `MODE_CONFIG.design` entry added to `main.js` with `standalone: true` flag and the full 12-section instruction as a template literal containing `{TRANSCRIPT}`.
- `generate-prompt` IPC handler updated: when `modeConf.standalone === true`, system prompt is `modeConf.instruction.replace('{TRANSCRIPT}', transcript)` — PROMPT_TEMPLATE is bypassed entirely.
- `MODES` array in `index.html` extended: `{ key: 'design', label: 'Design' }`.
- `getModeLabel()` in `index.html` updated to include `design: 'Design'`.
- `show-mode-menu` IPC handler in `main.js` updated to include `{ key: 'design', label: 'Design' }`.

**Why standalone**: Design instruction defines its own section labels (Role, Design brief, Visual personality, etc.) and ends with its own `The user said: "{TRANSCRIPT}"`. Embedding it inside PROMPT_TEMPLATE would produce a duplicate transcript and conflicting section structure.

**Files changed**: `main.js`, `index.html`
- **Status**: SHIPPED 2026-04-18
- **Approved by**: human

---

### D-HISTORY-REMOVE — F-HISTORY removed pending React migration
- **Date**: 2026-04-19 · **Type**: scope-change (feature removal)
- **Trigger**: User-initiated — explicit request to remove history feature
- **What was planned**: F-HISTORY shipped as part of Phase 4 — saveToHistory/loadHistory capped at 20, HISTORY state panel, history pill in IDLE, btn in PROMPT_READY, ⌥Space to close.
- **What was done**: Entire feature removed — all history CSS, DOM panel, JS functions (saveToHistory, loadHistory, clearHistory, renderHistoryList), STATES.HISTORY, STATE_HEIGHTS.HISTORY, history-btn in IDLE, btn-history in PROMPT_READY, HISTORY→IDLE shortcut case, and both saveToHistory call-sites in stopRecording and regenerate handlers.
- **Why**: User is planning to migrate Promptly from vanilla JS/Electron to React (or a better framework). Building history persistence on localStorage now creates schema baggage to carry into the migration. Removing it keeps the codebase lean for the rewrite — history will be re-implemented properly (likely with a real database or state manager) in the new stack.
- **Alternatives considered**: Keep it and migrate later. Rejected — adds dead weight and a localStorage schema that the React version would need to stay compatible with or explicitly clear.
- **Impact on other tasks**: None — feature was self-contained in index.html only. main.js and preload.js untouched.
- **Approved by**: human
- **Status**: REMOVED 2026-04-19 — revisit in React migration

---

---

## — Feature Start: FEATURE-004 (React migration) — 2026-04-19
> Folder: vibe/features/2026-04-19-react-migration/
> Migrates renderer from vanilla JS/HTML to React + Vite. Electron main process unchanged.
> Tasks: FCR-001 · FCR-002 · FCR-003 · FCR-004 · FCR-005 · FCR-006 · FCR-007 · FCR-008 · FCR-009 · FCR-010 · FCR-011 · FCR-012 · FCR-013 · FCR-014 | Estimated: ~20-24 hours
> Branch: feat/react-migration — DO NOT merge to main until all 18 smoke test items pass
> Drift logged below.

---

### D-LANGUAGE-REMOVE — F-LANGUAGE removed; English-only via --language en flag
- **Date**: 2026-04-19 · **Type**: scope-change (feature removal)
- **Trigger**: User-initiated — Whisper transcription quality in Hindi was poor and the output was unusable
- **What was planned**: F-LANGUAGE — 12-language picker, language pill in IDLE, Whisper --language flag passed from renderer
- **What was done**: Entire feature removed. Language pill, LANGUAGES constant, LANGUAGE_KEY, getLanguage/setLanguage/getLanguageLabel, showLanguageMenu IPC, onLanguageSelected callback all deleted. Whisper CLI now hardcoded to --language en for reliable English-only transcription.
- **Why**: Whisper tiny model + non-English speech produced garbled output with no resemblance to what was said. Multi-language support in Whisper tiny is unreliable without significant model size increase. Will revisit in React migration with a better transcription strategy (larger model, cloud API, or browser-native speech recognition).
- **Alternatives considered**: Upgrade to whisper medium/large model — too slow for real-time UX. Keep the picker but warn about quality — adds UI complexity for a broken feature.
- **Impact**: main.js transcribe-audio handler simplified (language param + langFlag removed, --language en hardcoded). preload.js transcribeAudio reverted to single argument. index.html cleaned of all language UI and logic.
- **Approved by**: human
- **Status**: REMOVED 2026-04-19 — revisit in React migration

---

## — Feature Start: FEATURE-005 (Tailwind v4 migration) — 2026-04-19
> Adds Tailwind CSS v4 to the React renderer. All vanilla CSS files deleted; all styles expressed as Tailwind utilities.

### FEATURE-005 — Tailwind v4 added to React renderer
- **Date**: 2026-04-19 · **Task**: FEATURE-005 · **Type**: tech-choice
- **What was planned**: Three CSS files in src/renderer/styles/ (tokens.css, bar.css, states.css)
- **What was done**: Installed tailwindcss + @tailwindcss/vite. All three CSS files deleted. All component styles converted to inline Tailwind className utilities. index.css created with @import "tailwindcss" + @theme block (color/font/animation tokens) + @keyframes + body reset + custom scrollbar utilities.
- **Why**: User-directed migration. Tailwind v4 eliminates separate CSS files and the CSS variable token system, expressing all design decisions directly in component markup. Easier to reason about per-component styles without context-switching to CSS files.
- **Alternatives considered**: Keep CSS files alongside Tailwind (hybrid) — rejected per spec (no separate CSS files). Use CSS modules — rejected (adds build complexity, still separate files).
- **Impact on other tasks**: light-mode body.light overrides from tokens.css are not yet ported to Tailwind (no dark: variant wiring). body.light class is still toggled by App.jsx theme logic; light-mode visual overrides will need Tailwind variants in a follow-up if light mode support is required.
- **Pseudo-elements**: bar ::before and ::after (top highlight, bottom accent) replaced with child divs in App.jsx. pulse-ring ::before and ::after pulse-expand rings replaced with child divs in IdleState.jsx.
- **Approved by**: human

---

### D-BUG-009 — Layout, glass, and window height fixes across all 4 states
- **Date**: 2026-04-19 · **Task**: BUG-009 · **Type**: blocker-resolution
- **What was planned**: Bar renders correctly after Tailwind v4 migration
- **What was done**: Fixed 9 sub-issues (A–I) across index.css, App.jsx, IdleState, MorphCanvas, main.js
- **Why**:
  - A (empty space above idle content): `h-7` spacer in IdleState was 28px of blank glass above the mic icon. Removed it — content row itself has `[-webkit-app-region:drag]`.
  - A/D/F (window too tall): `min-h-screen` on bar + missing initial `resizeWindow(IDLE)` on mount. createWindow uses `height: 89` (recording height); without a mount resize call, IDLE window stayed at 89px while content tried to fill a larger bar. Fixed: `h-full flex flex-col` on bar + `height: 100%` on html/body/#root + `useEffect(() => resizeWindow(STATE_HEIGHTS.IDLE), [])` in App.jsx.
  - E (morph canvas left-overflow): MorphCanvas had no style prop — rendered at its 476px `width` attribute without `display: block`. Added `style={{ width: '100%', height: '32px', display: 'block' }}`.
  - I (flat dark, no frosted glass): `app.commandLine.appendSwitch('disable-gpu-compositing')` in main.js disabled backdrop-filter/blur and macOS vibrancy. Removed that flag.
  - B/C/G/H: Already correctly coded (`px-5`, `px-4`, `px-[22px]`, `h-11`, `rounded-[10px]`) — now visible once bar container is correctly constrained.
- **Alternatives considered**: Leave `min-h-screen` and add explicit heights per state — rejected (brittle, every state needs independent sizing logic). Use `overflow: hidden` on `#root` — not sufficient alone, window itself was growing.
- **Impact on other tasks**: Bar container pattern now established for all future states — always `h-full flex flex-col` on the root glass div.
- **Approved by**: human

---

### BUG-010 — PROMPT_READY state: layout, spacing, and button visibility fixes
- **Date**: 2026-04-19 · **Task**: post-BUG-009 · **Type**: blocker-resolution

#### Issues reported (all in PromptReadyState.jsx)

**BUG-010-A — Edit button: text clipping at left/right edges**
- **Symptom**: "Edit" / "Done" label had barely any horizontal breathing room inside the button.
- **Root cause**: Button had `px-6` (24px each side) but no `min-w` — in a flex row next to a `flex-1` Copy button, the Edit button collapsed to minimum intrinsic width, making the text appear edge-to-edge.
- **Fix**: Added `px-8 min-w-[80px]` to the Edit button.

**BUG-010-B — Copy/Edit buttons not pinned to bottom**
- **Symptom**: Buttons floated inline after the prompt text rather than being anchored to the bottom of the window.
- **Root cause**: Layout was normal block flow — buttons followed directly after the prompt div. Long text caused overflow; short text left buttons mid-screen.
- **Fix**: Converted panel to `flex flex-col` (`flex-1 flex flex-col min-h-0`). Prompt output set to `flex-1 min-h-0 overflow-y-auto`. Button row set to `flex-shrink-0` so it is always visible at the bottom.

**BUG-010-C — Insufficient breathing room between "Prompt ready" header and "You said" section**
- **Symptom**: Header and "You said" appeared compressed.
- **Fix**: Added `pt-6 pb-6` to the "You said" wrapper. Dividers reduced from `marginLeft/Right: 32` → `16` so they extend wider, matching ThinkingState full-width look.

**BUG-010-D — Generated prompt section: condensed, non-scrollable**
- **Symptom**: Prompt output shrank to fit short text; no scrollbar on long text.
- **Root cause**: `max-h-[200px] overflow-y-auto` — soft ceiling with no floor.
- **Fix**: Replaced with `flex-1 min-h-0 overflow-y-auto` — fills remaining space between "You said" and buttons, scrolls regardless of content length.

**BUG-010-E — Insufficient breathing room between "Prompt ready" and the title-bar/traffic-light area**
- **Symptom**: "Prompt ready" label appeared immediately below the macOS traffic lights.
- **Fix**: Drag area increased from `h-7` (28px) → `h-10` (40px). PROMPT_READY window height bumped 540 → 560px.

---

#### Bug introduced by first fix attempt

**BUG-010-F — Buttons disappeared entirely after flex layout change (root cause: min-h-screen)**
- **Symptom**: After applying BUG-010-B, the Copy and Edit buttons vanished. "You said" and generated prompt had no visible divider. No scrollbar appeared.
- **Root cause**: `#bar` in `App.jsx` used `min-h-screen` (`min-height: 100vh`). In CSS flexbox, `min-height` sets a floor but no ceiling — child elements with `flex-1` grow without bound because the parent has no fixed height. The prompt div expanded infinitely, pushing the button row below the window's visible viewport. `overflow-hidden` on `#bar` clipped the buttons silently off-screen.
- **Fix**: Changed `min-h-screen` → `h-screen` (`height: 100vh`) on `#bar` in `App.jsx`. Since `resizeWindow()` sets the Electron window to `STATE_HEIGHTS[state]` on every transition, `100vh` always equals the exact window height — a safe equivalence. With a fixed height on the parent, `flex-1` is properly bounded.
- **Secondary fix**: Converted `DIVIDER` module-level JSX constant to a `Divider()` React component — same element reference at two tree positions can cause React reconciliation edge cases.
- **Files changed**: `App.jsx` (`min-h-screen` → `h-screen`), `PromptReadyState.jsx` (flex layout, dividers, spacing, `Divider` component)

**Key learning for future states**: `min-h-screen` on a flex column makes `flex-1` children unbounded. Always use `h-screen` (or an explicit height) on the root flex container when child elements need to divide space via `flex-1`.

- **Status**: FIXED 2026-04-19
- **Approved by**: human

---

## — Feature Start: FEATURE-006 (Keyboard Shortcuts Panel + Global Shortcuts) — 2026-04-19
> Folder: vibe/features/2026-04-19-keyboard-shortcuts/
> SHORTCUTS state with ShortcutsPanel, ⌘? global shortcut, Escape/⌘C/⌘E keydown handlers, Alt+P global shortcut, ⌘? hint in IDLE
> Tasks: FSC-001 · FSC-002 · FSC-003 · FSC-004 · FSC-005 | Estimated: ~3 hours
> Status: COMPLETE 2026-04-19
> Drift logged below.

### FEATURE-006 — Keyboard shortcuts panel and global shortcuts
- **Date**: 2026-04-19 · **Type**: scope-change (feature addition)
- **Trigger**: feature: command — user-initiated with full implementation spec
- **What was built**: SHORTCUTS state (380px) with ShortcutsPanel component showing 8 shortcuts with key chips. Triggered via right-click context menu ("Keyboard shortcuts ⌘?") and global CommandOrControl+Shift+/ shortcut. Window-focused keydown listener: Escape (stop recording or → IDLE), ⌘C (copy prompt in PROMPT_READY), ⌘E (dispatch export-prompt event). Alt+P global shortcut registered (→ shortcut-pause, for Phase 2). ⌘? hint in IdleState below subtitle.
- **New IPC channels**: `show-shortcuts` (main → renderer), `shortcut-pause` (main → renderer)
- **New preload method**: `onShowShortcuts`
- **Files changed**: `src/renderer/components/ShortcutsPanel.jsx` (new), `src/renderer/App.jsx`, `src/renderer/components/IdleState.jsx`, `main.js`, `preload.js`
- **Status**: SHIPPED 2026-04-19
- **Approved by**: human

---

## — Feature Start: FEATURE-007 (Export Formats) — 2026-04-19
> Folder: vibe/features/2026-04-19-export-formats/
> Save generated prompt as .txt / .md / .json from PROMPT_READY state via macOS save dialog
> Tasks: EXP-001 · EXP-002 · EXP-003 · EXP-004 | Estimated: ~4-5 hours
> Status: COMPLETE 2026-04-19
> Drift logged below.

### FEATURE-007 — Export formats in PROMPT_READY state
- **Date**: 2026-04-19 · **Type**: scope-change (feature addition)
- **Trigger**: feature: command — user-initiated with full implementation spec
- **What was built**: ExportPanel.jsx (format picker — txt/md/json tiles, formatContent pure function, handleExport via saveFile IPC), save-file IPC (dialog.showSaveDialog + fs.writeFileSync in main.js, saveFile in preload.js), PromptReadyState integration (Export toggle in top row, ExportPanel above button row, ↓ Export in button row, useEffect resize 560↔650px, export-prompt custom event listener for ⌘E)
- **New IPC channels**: `save-file` (renderer → main)
- **New preload method**: `saveFile`
- **Files changed**: `src/renderer/components/ExportPanel.jsx` (new), `src/renderer/components/PromptReadyState.jsx`, `main.js`, `preload.js`
- **Window height**: PROMPT_READY closed = 560px; open with export panel = 650px (+90px)
- **Status**: SHIPPED 2026-04-19
- **Approved by**: human

---

---

## — Feature Start: FEATURE-008 (Export Simplification) — 2026-04-19
> Folder: vibe/features/2026-04-19-export-md-only/
> Remove format picker, single-click direct .md export from top-row Export button
> Tasks: EXPS-001 · EXPS-002 | Estimated: ~1 hour
> Status: COMPLETE 2026-04-19

### FEATURE-008 — Export simplification (Markdown only, single-click)
- **Date**: 2026-04-19 · **Type**: scope-change (simplification of FEATURE-007)
- **What was changed**: Removed ExportPanel.jsx and format picker UI; Export button in top row now directly exports as .md; removed ↓ Export from button row; removed showExport state and window resize effect; ⌘E now triggers direct export
- **Files changed**: `src/renderer/components/ExportPanel.jsx` (deleted), `src/renderer/components/PromptReadyState.jsx`
- **Approved by**: human

---

### D-BUG-SC-001 — ShortcutsPanel: three bugs fixed
- **Date**: 2026-04-19 · **Type**: drift (bug fix)
- **Bugs**:
  1. Escape went to IDLE for all non-IDLE states — fixed to return to prevStateRef when in SHORTCUTS
  2. ⌥Space silently ignored in SHORTCUTS state — added SHORTCUTS case to onShortcutTriggered handler
  3. Done button opacity 25% (invisible) — raised to 50% with hover; padding increased 22px→28px; added WebkitAppRegion: 'no-drag'
- **Files changed**: `src/renderer/App.jsx`, `src/renderer/components/ShortcutsPanel.jsx`
- **Approved by**: human

---

### D-BUG-007A — Trivial fix: ExportPanel tiles unclickable
- **Date**: 2026-04-19 · **Type**: drift (trivial bug)
- **Root cause**: `panel-ready` root div has `WebkitAppRegion: 'drag'`; ExportPanel wrapper never overrode it to `'no-drag'`, so all tile button clicks were swallowed by Electron's window drag handler
- **Fix**: Added `style={{ WebkitAppRegion: 'no-drag' }}` to ExportPanel wrapper div (`src/renderer/components/ExportPanel.jsx`)
- **Approved by**: human

---

## — Feature Start: FEATURE-009 (History Panel — Split View) — 2026-04-19
> Folder: vibe/features/2026-04-19-history-panel/
> Split-panel history UI: left scrollable list with search + per-entry delete, right full prompt detail, ⌘H trigger, 680px wide window while active.
> Tasks: HIST-001 · HIST-002 · HIST-003 · HIST-004 · HIST-005 | Estimated: 7–9 hours
> Drift logged below.

### D-HIST-001 — New IPC channel: resize-window-width
- **Date**: 2026-04-19 · **Task**: HIST-004 · **Type**: tech-choice
- **What was planned**: Window always 520px wide (minWidth/maxWidth locked in createWindow)
- **What was done**: Added `resize-window-width` IPC channel — renderer → main, sets width while preserving current height, uses setResizable(true/false) guard identical to resize-window pattern
- **Why**: HISTORY panel needs 680px to display split left-list + right-detail layout. Single-axis resize IPC keeps concerns separate (height managed by existing resize-window, width managed by this new channel).
- **Alternatives considered**: (1) Always 680px wide — wastes space in all other states. (2) Combined resize-window-both IPC — would require updating all existing callers. (3) Accepted: thin new channel, called only on HISTORY entry/exit.
- **Impact on other tasks**: preload.js must expose resizeWindowWidth; App.jsx calls it on openHistory/closeHistory.
- **Approved by**: human

---

## 2026-04-19 — Spec review: add-feature (FEATURE-009)
> P0: 1 · P1: 1 · P2: 1
> Action: all fixed inline before build began
> Report: vibe/spec-reviews/2026-04-19-add-feature-009.md

---

### D-BUG-011 — HistoryPanel inline styles + atomic window resize
- **Date**: 2026-04-19 · **Task**: BUG-011 · **Type**: blocker-resolution
- **What was planned**: HistoryPanel.jsx using Tailwind utility classes for layout
- **What was done**: Full rewrite of HistoryPanel.jsx with inline styles only; App.jsx root div `w-[520px]` className replaced with `style={{width:'100%'}}` inline; added `set-window-size` IPC channel that sets width + height atomically (also calls setMinimumSize/setMaximumSize before setSize); openHistory/closeHistory now call setWindowSize(746,720) / setWindowSize(520,118) directly
- **Why**: (1) Tailwind layout classes were not applying in HISTORY panel — classes generated at build time but not matching runtime output. (2) Separate width + height IPC calls had a race condition: resize-window (RAF-deferred) read win.getSize() before resize-window-width had applied, resetting width back to 520. (3) BrowserWindow had hardcoded minWidth:520, maxWidth:520 — setSize() was silently clamped; must update min/max constraints before calling setSize.
- **Alternatives considered**: (1) Debug Tailwind JIT — not worth it; inline styles are reliable and explicit. (2) Delay RAF in resize-window to let width settle — fragile, timing-dependent. (3) Accepted: single atomic IPC call is the correct pattern for multi-axis resize.
- **Impact on other tasks**: Any future state that requires a non-standard window width must use setWindowSize; resize-window alone is only safe when width stays at 520.
- **Approved by**: human

---

### D-BUG-011-B — closeHistory always transitions to IDLE (not prevState)
- **Date**: 2026-04-19 · **Task**: BUG-011 · **Type**: scope-change
- **What was planned**: HIST-003 spec — closeHistory returns to prevStateRef (same pattern as ShortcutsPanel)
- **What was done**: closeHistory calls setWindowSize(520, STATE_HEIGHTS.IDLE) and always transitions to IDLE
- **Why**: User explicitly requested "On HISTORY close: resizeWindow(STATE_HEIGHTS.IDLE)" during BUG-011 fix session — IDLE is the correct home state after reviewing history
- **Approved by**: human

---

## — Feature Start: FEATURE-010 (Refine Mode) — 2026-04-20
> Folder: vibe/features/2026-04-20-refine-mode/
> Add Refine as a 7th prompt mode — standalone 4-section design feedback prompt with purple visual accent.
> Tasks: RFNE-001 · RFNE-002 · RFNE-003 · RFNE-004 · RFNE-005 | Estimated: ~3 hours
> Note: User referenced this as FEATURE-009 in the feature: command — renumbered to FEATURE-010 since FEATURE-009 is the History Panel (complete).

### D-RFNE-001 — Refine mode is an unplanned addition
- **Date**: 2026-04-20 · **Task**: RFNE-001 · **Type**: scope-change
- **What was planned**: PLAN.md has no Refine mode entry — original spec had 5 modes (balanced, detailed, concise, chain, code) + FEATURE-002 added design
- **What was done**: Added `refine` as a 7th mode with `standalone: true` — same pattern as `design`
- **Why**: User-requested addition. Mode infrastructure (MODE_CONFIG, show-mode-menu, useMode hook, mode-selected IPC) is generic — adding a new mode requires only an entry in MODE_CONFIG + one line in the menu array
- **Alternatives considered**: Using PROMPT_TEMPLATE with a refine-specific instruction — rejected because Refine has its own distinct 4-section output format that must not be wrapped in the generic Role/Task/Context/Constraints/Output format template
- **Impact on other tasks**: None. Mode system is additive by design.
- **Approved by**: human

---

## — Feature Start: FEATURE-011 (Pause and Resume Recording) — 2026-04-20
> Folder: vibe/features/2026-04-20-pause-resume/
> Add pause/resume to recording flow — PAUSED state with amber UI, timer persistence, Alt+P shortcut.
> Tasks: PAUZ-001 · PAUZ-002 · PAUZ-003 | Estimated: ~3-4 hours
> Note: Unplanned addition — not in original PLAN.md feature map.

### D-PAUZ-001 — Pause/resume is an unplanned addition
- **Date**: 2026-04-20 · **Task**: PAUZ-001 · **Type**: scope-change
- **What was planned**: PLAN.md has no pause/resume entry — original spec had IDLE/RECORDING/THINKING/PROMPT_READY/ERROR
- **What was done**: Added PAUSED as an 8th state (after SHORTCUTS and HISTORY). Timer lifted from RecordingState to App.jsx to persist across RECORDING↔PAUSED transitions. MediaRecorder.pause()/resume() used natively — audio chunks accumulate across pause/resume automatically.
- **Why**: User-requested addition. Alt+P shortcut was already stubbed in main.js (FSC-004). onShortcutPause was the missing link.
- **Alternatives considered**: Keeping timer in RecordingState and passing it back up on pause — rejected because parent-owns-state is simpler and avoids ref-forwarding complexity.
- **Impact on other tasks**: transition() updated to hide traffic lights for PAUSED (same as RECORDING). stopRecording() works from 'paused' MediaRecorder state natively.
- **Approved by**: human

---

### D-008 — Vibrancy removed; solid #0A0A14 background for consistent cross-wallpaper readability
- **Date**: 2026-04-20 · **Type**: tech-choice
- **What was planned**: `vibrancy: 'fullscreen-ui'` + `visualEffectState: 'active'` + `transparent: true` on both main win and splashWin
- **What was done**: Removed `vibrancy`, `visualEffectState`. Set `transparent: false`, `backgroundColor: '#0A0A14'`. Updated `index.css` body background to `#0A0A14`. Updated `splash.html` html/body background to `#0A0A14`.
- **Why**: Vibrancy bleeds the desktop wallpaper through the bar, producing unpredictable readability depending on the user's wallpaper (bright photos, white backgrounds). Solid opaque background eliminates the variable entirely — the bar looks identical on any wallpaper and any macOS appearance setting.
- **Alternatives considered**: Keep vibrancy but increase overlay opacity — rejected because it still bleeds through at low contrast.
- **Impact on other tasks**: Bar container `backdropFilter: blur(40px)` removed (meaningless without transparency). Glow effect (D-009) added to compensate for lost depth.
- **Approved by**: human

---

### D-009 — Ambient blue + purple glow added for premium dark glass aesthetic
- **Date**: 2026-04-20 · **Type**: tech-choice
- **What was planned**: No ambient glow — vibrancy provided depth
- **What was done**: Two absolutely-positioned `div` glow layers added to App.jsx bar container and `splash.html`: blue radial gradient top-right (`rgba(10,132,255,0.08)`), purple radial gradient bottom-left (`rgba(120,40,200,0.1)`). `zIndex: -1` so they render behind all content. Bar container gradient: `linear-gradient(135deg, #0A0A14 → #0D0A18 → #0A0A14)`.
- **Why**: Solid dark background needed visual depth to replace vibrancy. Ambient glow adds premium "dark glass" feel without any dependency, without transparency, and without wallpaper sensitivity. Purple complements the blue accent colour (#0A84FF) already in the design system.
- **Alternatives considered**: CSS box-shadow only — rejected as too flat. Adding a subtle texture PNG — rejected (adds a binary asset).
- **Impact on other tasks**: Splash screen updated to match — same two glow divs added before `.content`. All state panel content renders above glows via natural stacking (glows at z-index:-1).
- **Approved by**: human

---

## FEATURE-012 — Iteration Mode — 2026-04-20
> Folder: vibe/features/2026-04-20-iteration-mode/
> Allows users to refine a generated prompt by speaking a new voice input that is combined with the original prompt and sent to Claude.
> Tasks: ITR-001 through ITR-006 | Estimated: 6–9 hours | Unplanned addition

### D-ITER-001 — generate-raw IPC channel added
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: `generate-prompt` constructs its system prompt from MODE_CONFIG in main.js and cannot accept a pre-built system prompt. Iteration requires sending the original prompt + new transcript as a fully pre-assembled system prompt from the renderer. `generate-raw` is the minimal new IPC surface: takes `{ systemPrompt }` string, same timeout/error/spawn pattern as `generate-prompt`.

### D-ITER-002 — ITERATING is a state, not a mode
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Iteration works across all existing modes — it's a refinement flow, not a prompt style. A new state (ITERATING) is required to show the blue recording UI without conflicting with RECORDING. No new MODE_CONFIG entry, no localStorage key, no mode pill change.

### D-ITER-003 — originalTranscript.current updated to iterText on successful iteration
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: "You said" in PROMPT_READY should show the user's most recent input (the iteration voice input), not the original recording from possibly many minutes ago. The original prompt content is safely preserved in iterationBase.current.prompt. If user regenerates after iteration, they regenerate from the latest iteration transcript, which is the correct behaviour.

---
## 2026-04-20 — Spec review: add-feature (FEATURE-012)
> P0: 0 · P1: 2 (both fixed) · P2: 2 (acknowledged)
> Action: fixed — both P1s resolved before build
> Report: vibe/spec-reviews/2026-04-20-add-feature.md

---

## 2026-04-20 — UI Polish Pass (feat/ui-polish branch)

### POLISH-001 — State transition animations
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Instant state snaps felt cheap. Added `displayState` + `stateClass` pattern: exit animation 120ms (opacity 1→0, translateY 0→-4px), gap 60ms, enter animation 200ms (opacity 0→1, translateY 6px→0). `animateToState()` helper called from `transition()`, `openHistory()`, `closeHistory()`. Logic state (`currentState`) updates immediately; visual state (`displayState`) lags 120ms to allow exit animation.

### POLISH-002 — Window resize spring animation
- **Date**: 2026-04-20 · **Type**: discovery
- **Why**: Already implemented — `win.setSize(width, height, true)` was already present across all three resize IPC handlers (`resize-window`, `resize-window-width`, `set-window-size`). No change needed.

### POLISH-003 — Typography hierarchy
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Status text ("Promptly is ready", "Building your prompt") → fontSize 13px, fontWeight 500, letterSpacing -0.01em, color rgba(255,255,255,0.82). Section labels → letterSpacing 0.12em (from 0.14em). Timer → fontWeight 400, letterSpacing 0.08em. Primary content → letterSpacing -0.01em.

### POLISH-004 — Button hover states
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Buttons lacked hover feedback. Used onMouseEnter/onMouseLeave with local state for each button in PromptReadyState, HistoryPanel, ShortcutsPanel. Edit button border brightens on hover. Iterate gets text-shadow glow. Regenerate/Reset/Export/Done/Cancel fade from 0.58→0.80. Clear all red fades 0.55→0.75.

### POLISH-005 — Pulse ring and mic breathing animation
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Two-ring system: inner ring uses new `pulse-inner` keyframe (scale 1→1.8, 2s), outer uses updated `pulse-expand` (scale 1→2.4, 2s, 0.5s delay). Mic SVG gets `mic-breathe` keyframe (scale 1.00↔1.06, 3s ease-in-out infinite).

### POLISH-006 — Scrollbar refinement
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Replaced `.scrollbar-thin` class (opacity 0 → on-hover) with global `*::-webkit-scrollbar` rules: 3px width, transparent track, rgba(255,255,255,0.08) thumb always visible, 0.18 on hover. More legible and consistent.

### POLISH-007 — Copy button success state
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Improved success state: green gradient rgba(48,209,88,0.85)→rgba(30,168,70,0.85), boxShadow 0 2px 16px rgba(48,209,88,0.35), text changed to '✓ Copied', transition: all 300ms ease on the button.

### POLISH-008 — Section dividers in prompt output
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: Added 0.5px rgba(255,255,255,0.04) horizontal dividers between each prompt section in renderPromptOutput. Divider inserted before every non-first label. Removed old mt-5/first:mt-0 margin approach.

### POLISH-009 — Global text brightness pass
- **Date**: 2026-04-20 · **Type**: tech-choice
- **Why**: All text colors below rgba(255,255,255,0.5) were too dim on the dark glass background. Applied brightness map across all component files: white 0.14–0.45 → 0.45–0.75 range. Blue accent 0.42–0.55 → 0.70–0.80. Purple refine 0.7–0.9 → 0.85–1.0. Exceptions: borders, box shadows, backgrounds, ambient glows — unchanged.


---

### D-BUG-012 — PATH resolution expanded: common paths + zsh/bash fallback
- **Date**: 2026-04-20 · **Task**: BUG-012 · **Type**: blocker-fix
- **Root cause**: In packaged .app/.dmg builds, `exec('zsh -lc "which claude"')` silently fails because the process environment does not load the user's shell profile. `whisperPath` had an additional race condition — resolved via fire-and-forget callback, so `splash-check-whisper` could run before it was set.
- **Files in scope**: `main.js`
- **Fix approach**: `resolveClaudePath()` and new `resolveWhisperPath()` — both check a list of common installation paths via `fs.existsSync` first (no shell needed), then fall back to zsh login shell, then bash login shell. Whisper also tries `python3 -m whisper`. Both are `async` and `await`ed in `app.whenReady()` before any window is created.
- **CODEBASE.md update**: Yes — `whisperPath` row + `resolveWhisperPath()` added to main.js exports
- **ARCHITECTURE.md update**: Yes — PATH resolution section updated with expanded search pattern
- **Deviations from BUG_PLAN.md**: None

---

### D-BUG-013 — Microphone permission dialog repeating: three root causes

- **Date**: 2026-04-20 · **Type**: discovery + blocker-fix

**Root cause A — `setPermissionCheckHandler` missing (critical)**
Electron/Chromium has a two-step permission system for `getUserMedia`:
1. **Check** (`setPermissionCheckHandler`): Chromium asks "do I already have this permission?" *before* opening the stream. If this returns `false` (or no handler is set), Chromium treats every call as a fresh request and re-prompts.
2. **Request** (`setPermissionRequestHandler`): handles an incoming request when the check fails.
We had only set the request handler. Without the check handler returning `true` for `'media'`, Chromium re-prompted on every single `getUserMedia` call — splash, recording start, iteration start — even in the same session.
**Fix**: `session.defaultSession.setPermissionCheckHandler((_wc, p) => p === 'media')` — both handlers must be set together.

**Root cause B — `request-mic` IPC was a no-op**
The `request-mic` IPC handler returned `{ ok: true }` without calling `systemPreferences.askForMediaAccess`. This meant macOS TCC was only touched in splash, not refreshed before recording. On relaunches where TCC expired, `getUserMedia` hit an un-granted TCC entry.
**Fix**: `request-mic` now calls `askForMediaAccess('microphone')`. `startRecording()` and `handleIterate()` in App.jsx call `requestMic()` before every `getUserMedia`.

**Root cause C — `dist:unsigned` with `hardenedRuntime: true` and no signature**
Hardened runtime entitlements (`com.apple.security.device.audio-input`) only apply to *signed* builds. An unsigned build with `hardenedRuntime: true` runs under hardened runtime restrictions without the entitlements that would bypass them — causing TCC to not persist between launches.
**Fix**: `dist:unsigned` script now passes `--config.mac.hardenedRuntime=false`.

**Key learnings for future Electron mic work:**
- Always set BOTH `setPermissionCheckHandler` AND `setPermissionRequestHandler` — one without the other causes repeated prompts.
- `systemPreferences.askForMediaAccess` (main process, macOS TCC) and `getUserMedia` (renderer, Chromium) are two separate layers. Both must agree.
- `askForMediaAccess` returns `true` silently if TCC is already granted — safe to call before every recording start.
- For unsigned DMG distribution: always set `hardenedRuntime: false` or the entitlements won't apply and TCC won't persist.

---

### D-BUG-013-B — Renderer process TCC grant missing — getUserMedia never primed in splash
- **Date**: 2026-04-20 · **Task**: BUG-013 · **Type**: blocker-resolution
- **What was planned**: BUG-013 fix (D-BUG-013 above) was considered complete after setting both Electron session handlers and wiring `requestMic()` before every recording.
- **What was done**: Added a `getUserMedia({ audio: true })` call (with immediate track release) inside the splash mic check block, after `checkMicStatus` returns granted, before showing the green checkmark.
- **Why**: macOS TCC has **two separate process-level grants**:
  1. Main process grant — obtained via `systemPreferences.askForMediaAccess()` from main.js. This is what the splash `check-mic-status` IPC was calling. It grants TCC for the **main process**.
  2. Renderer helper process grant — only obtained when `getUserMedia` is called from a **renderer context**. In packaged Electron apps on macOS (esp. Sequoia/Darwin 25), the renderer runs as a separate subprocess (`Promptly Helper (Renderer).app`) with its own TCC entry requirement. `askForMediaAccess` from the main process does NOT cover the renderer subprocess.
  
  Result: splash passed green (main process TCC = granted), but the first `getUserMedia` call in the main window's renderer triggered the macOS dialog again because the renderer helper process had never been granted.

  By calling `getUserMedia` inside the splash renderer context (then immediately releasing the stream), we prime the renderer helper's TCC grant during the controlled splash sequence — where the user expects to grant permissions — so subsequent `getUserMedia` calls in the main window are silent.

- **Alternatives considered**: (1) Call `getUserMedia` from main window on first load before user presses shortcut — rejected, no clear hook without adding new IPC and timing complexity. (2) Use `setPermissionCheckHandler` return value to bypass TCC entirely — confirmed this only prevents Chromium's dialog, not macOS TCC. (3) Current fix — one `getUserMedia` in splash renderer, immediate track release. Minimal, correct, and happens at the expected "grant permissions" moment.
- **Impact on other tasks**: None — splash.html only. No IPC changes.
- **Approved by**: human

---

### D-BUG-014 — Whisper fails in DMG — ffmpeg not found, err swallowed, timeout too short
- **Date**: 2026-04-20 · **Task**: BUG-014 · **Type**: blocker-resolution
- **Symptom**: Recording stops → THINKING spins ~60s → ERROR state. Confirmed ffmpeg missing from packaged app PATH.
- **Root causes**:
  - **A — ffmpeg PATH too narrow**: whisperEnv only included 7 paths. Homebrew Cask ffmpeg lives at `/opt/homebrew/bin/ffmpeg`, conda variants live at `~/anaconda3/bin`, `~/miniconda3/bin`, `~/miniforge3/bin`. Old Homebrew at `/usr/local/opt/ffmpeg/bin`. All missing.
  - **B — exec err swallowed**: callback read txtFile before checking `err`. If whisper exited non-zero, and a stale txtFile existed, it could resolve with wrong text. If no txtFile, the real error (from stderr) was only surfaced via the catch path — fragile ordering.
  - **C — timeout 60s too short for first-run model download**: `--model tiny` is ~75MB. On a slow connection inside a DMG cold-start, download + transcription can exceed 60s. Increased to 90s.
  - **D — Python env vars missing**: pyenv-managed whisper needs `PYENV_VERSION` and `PYTHONPATH` to resolve its packages. These were not forwarded.
- **Fixes**:
  1. Expanded `whisperEnv.PATH` to 13 entries covering all known ffmpeg install locations.
  2. Added `PYENV_VERSION`, `PYTHONPATH` (forwarded from process.env if set), `PYTHONUNBUFFERED=1`.
  3. `exec` callback checks `err` first, rejects immediately with `stderr || err.message`.
  4. Timeout raised to 90000ms.
  5. `splash-check-whisper` now also returns `ffmpegFound` (probes 4 common paths) — informational, not a blocker.
  6. `--model tiny` confirmed already in use — no change.
- **Impact on other tasks**: None — `transcribe-audio` handler only.
- **Approved by**: human

---

### D-BUG-015 — TypeError Object destroyed + mic dialog repeating + double mic request
- **Date**: 2026-04-20 · **Task**: BUG-015 · **Type**: blocker-resolution
- **Symptom 1**: `TypeError: Object has been destroyed` on launch — splashWin internal Chromium IPC fires after the 400ms destroy timeout, hitting a dead webContents.
- **Symptom 2**: Microphone permission dialog appears on every launch instead of only the first.
- **Symptom 3**: Two consecutive TCC requests on recording start — could trigger a second dialog.
- **Root causes**:
  - **A — splash-done timeout too short**: `splash-done` handler destroys splashWin after 400ms. `getUserMedia` in splash renderer triggers async Chromium-internal IPC back through splashWin.webContents. With 400ms destroy the IPC arrives after destruction → TypeError.
  - **B — hardenedRuntime: false**: Unsigned/unhardened app bundle has no code identity TCC can persist. macOS re-prompts every launch.
  - **C — redundant requestMic() in startRecording**: `startRecording` and `handleIterate` both call `window.electronAPI.requestMic()` (which calls `askForMediaAccess` in main) and then immediately `getUserMedia`. With the session permission handlers in place this is redundant and risks a race on first recording.
- **Fixes**:
  1. `main.js` splash-done: timeout 400→1200ms. Added `isDestroyed()` guards on `splashWin` and `win` inside the timeout callback.
  2. `package.json`: `hardenedRuntime: true`, `gatekeeperAssess: false`, `entitlements: "entitlements.plist"`, `entitlementsInherit: "entitlements.plist"`, `minimumSystemVersion: "12.0"`.
  3. `entitlements.plist`: added `com.apple.security.network.client` key (was missing).
  4. `App.jsx`: removed `await window.electronAPI.requestMic()` from `startRecording` and `handleIterate`. `getUserMedia({ audio: true, video: false })` handles TCC directly.
- **Files in scope**: `main.js`, `package.json`, `entitlements.plist`, `src/renderer/App.jsx`
- **Impact**: Smoke checklist: no TypeError on launch, mic dialog once only, recording starts silently.
- **Approved by**: human

---

### D-BUG-016 — Mic permission dialog on every launch: askForMediaAccess is the wrong API
- **Date**: 2026-04-20 · **Task**: BUG-016 · **Type**: blocker-resolution
- **Symptom**: macOS microphone permission dialog appears on every launch, even after the user has clicked Allow.
- **Root cause**: `check-mic-status` and `request-mic` IPC handlers both called `systemPreferences.askForMediaAccess('microphone')`. Despite documentation suggesting it returns immediately if already granted, `askForMediaAccess` re-shows the TCC dialog on every call for unsigned builds — it is an *active request* API, not a *status query* API.
- **Fixes**:
  1. `main.js` — `check-mic-status`: replaced `askForMediaAccess` with `systemPreferences.getMediaAccessStatus('microphone')`. Synchronous status-only query — no dialog, ever.
  2. `main.js` — `request-mic`: same replacement. Returns `{ ok: status === 'granted' }` without side effects.
  3. `splash.html` — `runChecks()` mic block: removed `window.electronAPI.checkMicStatus()` entirely. Replaced with direct `getUserMedia({ audio: true })` — the only call that correctly registers a TCC grant for the renderer helper process. First launch: dialog once. All subsequent launches: resolves silently.
  4. `preload.js` — removed `checkMicStatus` and `requestMic` contextBridge exposures (confirmed unused in all renderer src).
- **Why getUserMedia is correct**: `askForMediaAccess` grants TCC for the main process; `getUserMedia` in the renderer grants TCC for the renderer helper subprocess — the same context that handles all recording. Only `getUserMedia` in the splash renderer produces a persistent grant for recording.
- **Files changed**: `main.js`, `preload.js`, `splash.html`
- **Impact**: First launch → one dialog; all subsequent launches → zero dialogs; recording starts silently.
- **Approved by**: human

---

### D-FEATURE-SIGNING — Self-signed code signing for persistent TCC mic permissions
- **Date**: 2026-04-20 · **Task**: FEATURE-SIGNING · **Type**: tech-choice
- **What was planned**: Unsigned builds (identity=null) for local distribution.
- **What was done**: Added self-signed code signing scripts and npm commands so macOS TCC can persist the microphone permission grant across launches.
- **Why**: Even with hardenedRuntime:true, an unsigned bundle has no persistent code identity. TCC may re-prompt on each launch. A self-signed certificate gives the bundle a stable identity without requiring an Apple Developer account or notarisation.
- **Scripts added**:
  - `scripts/create-cert.sh` — generates a 10-year RSA-2048 self-signed cert with codeSigning EKU, imports into login.keychain-db via openssl + security CLI. Idempotent (no-op if cert already exists).
  - `scripts/sign-app.sh` — signs dylibs/frameworks first, then helper .app bundles, then the main bundle with --options runtime + entitlements.plist. Runs codesign --verify at end.
  - `scripts/build-signed.sh` — orchestrates: build:renderer → electron-builder (unsigned pkg) → sign-app.sh → electron-builder dmg.
- **npm scripts added**: `create-cert`, `sign-app`, `dist:signed`
- **entitlements.plist**: already correct — no changes needed.
- **Alternatives considered**: Apple Developer ID signing (requires paid account + notarisation). Ad-hoc signing (--sign - flag; no persistent identity, TCC still re-prompts).
- **Impact on other tasks**: None. `dist:unsigned` remains unchanged. New workflow: run `npm run create-cert` once, then `npm run dist:signed` for any signed build.

---

### D-BUG-017 — Distribution failures: nvm PATH + Gatekeeper quarantine
- **Date**: 2026-04-23 · **Type**: drift (distribution blocker)
- **Folder**: vibe/bugs/2026-04-23-bug-017/
- **Root cause A**: `resolveClaudePath()` static path list omits all `~/.nvm/versions/node/*/bin/` paths. Shell fallback (`zsh -lc "which claude"`) also fails for nvm users in packaged apps because nvm requires explicit sourcing of `~/.nvm/nvm.sh` — which doesn't happen in non-interactive Electron-spawned shells. Additionally missing: `~/.volta/bin/` and `~/n/bin/` for other node version managers.
- **Root cause B**: DMG downloaded from Google Drive receives `com.apple.quarantine` xattr from macOS. Self-signed (non-notarized) app triggers Gatekeeper block. Fix is documentation — three bypass options: `xattr -d` (recommended), right-click Open, System Preferences Allow Anyway.
- **Files in scope**: `main.js`, `INSTALL.md` (new), `vibe/distribution/slack-message.md`
- **Fix approach A**: Add volta/n to static paths; dynamic nvm scan via `readdirSync(~/.nvm/versions/node)`; replace shell fallback with explicit NVM_DIR init (`export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which claude`). Same nvm scan added to `resolveWhisperPath()`.
- **Fix approach B**: Create INSTALL.md with Gatekeeper bypass instructions (3 options). Update Slack message template.
- **CODEBASE.md update**: No — function signatures unchanged, behavior change is internal.
- **ARCHITECTURE.md update**: Yes — PATH resolution section updated from 3-step to 4-step pattern (adds nvm dynamic scan step).
- **Deviations from BUG_PLAN.md**: None.

---

## — Feature Start: FEATURE-014 Text Input (Type Prompt) — 2026-04-23
> Folder: vibe/features/2026-04-23-text-input/
> Add a TYPING state so users can type prompts directly — same generate-prompt pipeline as voice, same history, same modes. No new IPC channels.
> Tasks: TXT-001, TXT-002, TXT-003, TXT-004, TXT-005 | Estimated: 5–6 hours
> Drift logged below.
---

---

## 2026-04-23 — Spec review: add-feature (FEATURE-014)
> P0: 0 · P1: 1 · P2: 2
> Action: all findings fixed before build
> Report: vibe/spec-reviews/2026-04-23-add-feature.md
---

---

### D-TXT-001 — resizeWindow passed as prop to TypingState (not via hook)
- **Date**: 2026-04-23 · **Task**: TXT-002 · **Type**: pattern-deviation
- **Decision**: `resizeWindow` is passed from App.jsx as a prop to TypingState rather than calling `useWindowResize()` inside TypingState directly.
- **Why**: TypingState calls resizeWindow on every keystroke (onChange). The hook is a thin IPC wrapper — both approaches produce identical behaviour. Passing as prop avoids a second hook instantiation for a component that does not otherwise need the hook at mount time.
- **Impact**: None — functionally identical. Noted as minor deviation from hook-everywhere convention.
---

---

## — Feature Start: FEATURE-015 Polish Mode — 2026-04-23
> Folder: vibe/features/2026-04-23-polish-mode/
> Add 'polish' as an 8th prompt mode that returns clean polished prose + change notes instead of a Claude prompt. Formal/Casual tone toggle persists via promptly_polish_tone localStorage key. Green accent throughout. Dedicated PolishReadyState.jsx component.
> Tasks: POL-001, POL-002, POL-003, POL-004, POL-005, POL-006, POL-007 | Estimated: 14-18 hours
> Drift logged below.
---

## 2026-04-23 — Spec review: add-feature (FEATURE-015)
> P0: 0 · P1: 2 · P2: 3
> Action: both P1s fixed inline before build
> Report: vibe/spec-reviews/2026-04-23-add-feature-polish-mode.md
---

---

## — Bug Fix: BUG-018 — window destroyed on close + no single-instance lock — 2026-04-23
> Folder: vibe/bugs/2026-04-23-bug-018/
> Tasks: BUG-018-001, BUG-018-002, BUG-018-003, BUG-018-004
> Drift logged below.

### D-BUG-018 — Bug fix: window destroyed on close + no single-instance lock
- **Date**: 2026-04-23 · **Type**: drift
- **Folder**: vibe/bugs/2026-04-23-bug-018/
- **Root cause**: (A) No `app.requestSingleInstanceLock()` — second DMG launch starts a fresh conflicting process. (B) No `win.on('close')` intercept — red X destroys `win`; `activate` handler's `!win.isDestroyed()` guard then fails silently; window can never be reshown. (C) Once hide-on-close is added, the existing tray `Quit` → `app.quit()` would be blocked by the close handler — needs `isQuitting` flag.
- **Files in scope**: `main.js`
- **Fix approach**: `isQuitting` flag at module scope + `app.on('before-quit')` to set it + `app.requestSingleInstanceLock()` + `second-instance` handler + `win.on('close')` hide-intercept in `createWindow()` + tray Quit label → 'Quit Promptly'
- **CODEBASE.md update**: No — no new functions or IPC channels
- **ARCHITECTURE.md update**: Yes — window lifecycle section added (hide-on-close pattern, isQuitting flag, single-instance lock requirement)
- **Deviations from BUG_PLAN.md**: none yet
---

### D-POL-001 — FEATURE-015 is an unplanned addition
- **Date**: 2026-04-23 · **Task**: planning · **Type**: scope-change
- **What was planned**: PLAN.md Section 6 did not include a Polish mode.
- **What was done**: Polish mode added as unplanned vertical slice.
- **Why**: User request — a "clean prose" mode is a natural complement to the existing prompt-generation modes. All prerequisites (React migration, mode system, history panel, generate-prompt IPC) are complete. No dependency violations.
- **Alternatives considered**: Adding tone toggle to existing Balanced mode rather than a new mode. Rejected — Polish has a fundamentally different output shape (direct prose, not a Claude prompt), requiring its own output component.
- **Impact on other tasks**: `generate-prompt` IPC gets a backwards-compatible `options` parameter. New localStorage key `promptly_polish_tone`. New `PolishReadyState.jsx` component. HistoryPanel gets green mode tag for polish entries. All other modes unaffected.
- **Approved by**: human
---

### D-POLISH-010 — ShortcutsPanel.jsx complete redesign
- **Date**: 2026-04-23 · **Task**: POLISH-010 · **Type**: tech-choice
- **What was planned**: Incremental polish tweaks to the existing flat shortcut list.
- **What was done**: Full component replacement — flat list replaced with grouped layout (Recording / Prompt / Navigation), inline styles throughout, group section headers with blue accent, gradient dividers between groups, 3D key chips (borderBottom 1.5px + inset shadow), hover background on each row, Done button with pill style. STATE_HEIGHTS.SHORTCUTS updated 400 → 380.
- **Why**: Grouped layout improves scannability; inline styles eliminate Tailwind dependency in this component; 3D key chips match macOS visual language more closely.
- **Alternatives considered**: Keeping flat list with cosmetic tweaks. Rejected — too many shortcuts for a flat list; grouping is clearer at 9 items.
- **Impact on other tasks**: None. No logic changes — only presentation. `onClose` prop contract unchanged.
---

### D-BUG-019 — Trivial fix: app never appears in Dock
- **Date**: 2026-04-23 · **Type**: drift (trivial bug)
- **Root cause**: `createTray()` called `app.dock.hide()` unconditionally after tray creation — removed the app from the macOS Dock entirely, so minimize had nowhere to go and the app was invisible to the user outside the menu bar.
- **Fix**: Removed `if (app.dock) app.dock.hide()` from `createTray()` in `main.js`. The Dock icon is now visible; minimize sends the window to the Dock; tray icon continues to work alongside it.
- **Regression test**: Manual — npm start, confirm Dock icon visible, click minimize, confirm window goes to Dock, click Dock icon to restore.
- **Approved by**: human
---

### D-POLISH-011 — Bundle size audit + reduction
- **Date**: 2026-04-23 · **Task**: POLISH-011 · **Type**: tech-choice
- **What was planned**: No explicit bundle size target in PLAN.md.
- **What was done**: Full audit of the universal `.app` bundle, then three targeted changes to `package.json` build config:
  1. `"electronLanguages": ["en-US"]` — strips all non-English `.lproj` locale packs from Electron Framework (~28MB of locale files, 0 at runtime)
  2. `"asar": true` — explicitly set (was already the default; made explicit for clarity)
  3. `"compression": "maximum"` — maximum ASAR + installer compression
- **Size before**: `.app` 468MB installed · `.dmg` 200MB download
- **Size after**: `.app` 422MB installed · `.dmg` 176MB download
- **Savings**: 46MB installed (10%), 24MB download (12%)
- **Why the target of <250MB installed is unachievable**: The Electron Framework alone (Chromium + Node.js runtime) is 418MB of the 422MB total. Our app code is 340KB (app.asar). Reducing below 250MB installed would require abandoning Electron entirely. The DMG download at 176MB is well under 250MB.
- **Key findings from audit**:
  - No runtime `dependencies` — everything in `devDependencies` — so node_modules were never being bundled. File exclusion steps were already effective.
  - The `files` config was already minimal (5 files + dist-renderer only).
  - The only material savings available were locale file stripping and compression tuning.
- **Alternatives considered**: Two-package.json structure — rejected (no runtime deps, no benefit). Locale stripping beyond en-US — possible but may affect non-English macOS installs unexpectedly.
- **Impact on other tasks**: None. `npm run dist:unsigned` now produces 176MB DMG.
- **Approved by**: human
---

### D-FEATURE-016 — Uninstaller: shell script + tray + IPC
- **Date**: 2026-04-24 · **Task**: UNIN-001 to UNIN-008 · **Type**: scope-change
- **What was planned**: No uninstaller in original PLAN.md.
- **What was done**: Three uninstall surfaces — scripts/uninstall.sh (standalone, included in DMG via dmg.extraFiles), tray menu "Uninstall Promptly..." item (native confirmation dialog via handleUninstall() helper), and INSTALL.md manual instructions.
- **Why**: Dragging Promptly to Trash leaves behind ~/Library/Application Support/promptly, Logs, Preferences, Saved State, and the TCC microphone entry. No clean uninstall path existed.
- **Key decisions**:
  - handleUninstall() extracted as a shared function — both IPC handler and tray click call it; avoids code duplication.
  - dialog.showMessageBox called without a win reference — always visible even when window is hidden.
  - fs.rmSync with { recursive: true, force: true } for data dirs — no-op if not found, no error thrown.
  - tccutil reset run via exec — gracefully succeeds even if no TCC entry exists.
  - set -e omitted from uninstall.sh — each step uses || to handle failure independently without aborting the entire script.
- **Alternatives considered**: electron-store reset IPC — rejected; too narrow. AppleScript-only — rejected; doesn't handle ~/Library dirs.
- **Impact on other tasks**: None. Additive only.
- **Approved by**: human
---

### D-SPEC-REVIEW-FEATURE-013 — Spec review: path config panel
- **Date**: 2026-04-24 · **Type**: spec-review · **P0**: 1 · **P1**: 3 · **P2**: 2
- **Action**: All findings fixed before build began.
- **Key fix**: electron-store runtime dep (P0) replaced with native `readConfig()`/`writeConfig()` using built-in `fs` + `app.getPath('userData')` — zero runtime deps preserved.
- **Report**: vibe/spec-reviews/2026-04-24-add-feature-path-config.md
---

### D-FEATURE-013 — Path Configuration Panel
- **Date**: 2026-04-24
- **Decision**: Added gear icon (⚙) to splash top-right that opens a path configuration panel. Users can paste or browse to claude/whisper binary paths, see green/red live status dots, and Save & Recheck to retry without restarting the app.
- **Why**: Team members on nvm/pyenv/volta installs hit "not found" errors on the splash with no recourse — blocks onboarding and creates support burden.
- **Implementation**: `readConfig()`/`writeConfig()` using Node.js built-in `fs` + `app.getPath('userData')` — zero runtime npm dependencies. 4 new IPC channels: `get-stored-paths`, `save-paths`, `browse-for-binary`, `recheck-paths`. Tray menu "Path configuration..." + ⌘, shortcut send `open-settings` to renderer (console stub — full SETTINGS state deferred).
---

### D-FEATURE-017-MBAR-001 — Menu bar icon: PNG via zlib + single Tray instance
- **Date**: 2026-04-24 · **Task**: MBAR-001 · **Type**: tech-choice
- **What was planned**: Second Tray instance alongside existing tray, 44×44 RGBA PNG via zlib.
- **What was done**: Removed `createTray()` entirely — `menuBarTray` is the sole Tray instance. Context menu rebuilt inline in right-click handler. `createMicIcon()` draws 44×44 RGBA pixels with `nativeImage.createFromBuffer(buf, { scaleFactor: 2.0 })` — critical for correct 22pt display size in menu bar.
- **Why**: Two tray icons (old dotted circle + new mic) was confusing — user couldn't tell which to use. Single icon with click=show/hide + right-click=context menu matches macOS standard pattern.
- **Key decisions**:
  - `scaleFactor: 2.0` required — without it the 44px PNG renders at 44 points (too large, appears invisible or clipped).
  - `setTemplateImage(true)` on idle/hidden icons — macOS handles light/dark inversion automatically; dot-state icons are non-template with explicit white/black mic body.
  - Hidden state = 45% alpha (115/255) + diagonal slash — satisfies both "dimmed" and "distinct" acceptance criteria.
  - `eslint.config.js` updated to add `setInterval`/`clearInterval` globals — were missing, caused lint errors.
  - `win.on('hide'/'show')` handlers guard with `if (!menuBarTray || menuBarTray.isDestroyed())` — menuBarTray created after splash-done, handlers registered in createWindow() earlier.
- **Alternatives considered**: Canvas npm package — rejected (zero runtime deps constraint). Two separate tray instances — rejected by user (confusing UX).
- **Impact on other tasks**: MBAR-002 IPC handler targets `menuBarTray` only (not `tray` which is now null).
- **Approved by**: human

---

### D-FEATURE-017-MBAR-002-004 — Menu bar state IPC chain
- **Date**: 2026-04-24 · **Task**: MBAR-002/003/004 · **Type**: tech-choice
- **What was planned**: `ipcMain.handle('update-menubar-state')` + preload exposure + App.jsx call in `transition()`.
- **What was done**: Exactly as planned. `updateMenuBarIcon()` helper centralises pulse/tooltip/image logic. IPC handler maps STATES enum strings to icon states via `stateMap` with fallback to `'idle'`.
- **Key decisions**:
  - MBAR-002/003/004 implemented and committed together — they form one complete IPC chain; splitting commits adds no value.
  - `updateMenuBarIcon()` extracted as a standalone function (called by both IPC handler and nativeTheme listener).
  - Optional chaining (`?.`) in App.jsx — prevents errors if `window.electronAPI` is unavailable.
- **Approved by**: agent-autonomous

---

### D-BL-033 — Extract useRecording + useKeyboardShortcuts from App.jsx
- **Date**: 2026-04-24 · **Task**: BL-033 · **Type**: drift (SRP refactor)
- **What was planned**: P1 fix from FEATURE-015 review — extract recording + keyboard concerns from App.jsx.
- **What was done**: Created `src/renderer/hooks/useRecording.js` (171 lines) and `src/renderer/hooks/useKeyboardShortcuts.js` (107 lines). App.jsx reduced 654 → 478 lines.
- **Key decisions**:
  - `stopRecording` now uses `modeRef.current` instead of closing over `mode` directly — dep array `[]` instead of `[mode]`. Cleaner pattern consistent with other hooks; no behavior change since `modeRef` is kept current via `useEffect`.
  - `startTimer`/`stopTimer` exported from `useRecording` — needed by `handleIterate`/`dismissIterating` which stay in App.jsx (iteration logic, not base recording).
  - Theme effect (getTheme + onThemeChanged) stays in App.jsx as its own `useEffect` — conceptually separate from shortcut wiring.
  - `useKeyboardShortcuts` receives all refs/callbacks as params; uses `transitionRef.current()` throughout to avoid stale-closure issues.
- **CODEBASE.md update**: Yes — added two new hook rows, updated App.jsx row.
- **Alternatives considered**: Moving STATES to a shared constants file — deferred (out of scope for this extraction).
- **Approved by**: human

---

## — Feature Start: FEATURE-018 (Quick Copy from Menu Bar) — 2026-04-24
> Folder: vibe/features/2026-04-24-quick-copy/
> Adds "Copy last prompt" to menubar right-click menu — copies silently without opening bar.
> Tasks: QCPY-001 · QCPY-002 · QCPY-003 · QCPY-004 · QCPY-005 | Estimated: ~2 hours
> Drift logged below.

---
## — Feature Start: FEATURE-020 History Panel v2 — 2026-04-24
> Folder: vibe/features/2026-04-24-history-v2/
> Adds bookmarks, ratings (👍/👎 + tags), filter chips, stats bar to HistoryPanel.
> Tasks: HSTV2-001 through HSTV2-009 | Estimated: 14-18 hours
> Spec review: 0 P0, 2 P1 fixed (delete button collision, stats from getHistory())
> Report: vibe/spec-reviews/2026-04-24-add-feature-history-v2.md
> Drift logged below.
---

### D-FEATURE-018-001 — buildTrayMenu() shared helper replaces duplicate inline templates
- **Date**: 2026-04-24 · **Task**: QCPY-001/QCPY-002 · **Type**: tech-choice
- **What was planned**: Add "Copy last prompt" to createMenuBarIcon right-click inline menu and updateTrayMenu separately
- **What was done**: Extracted shared `buildTrayMenu()` function; both `createMenuBarIcon` right-click and `updateTrayMenu()` call it
- **Why**: The two menus had identical templates except for the new item. A single builder eliminates the duplication and ensures they stay in sync.
- **Alternatives considered**: Duplicate the template in both places — rejected (DRY violation, easy to drift)
- **Impact on other tasks**: None — tray is null so updateTrayMenu() is a no-op; change is forward-compatible

---
## — Feature Complete: FEATURE-020 History Panel v2 — 2026-04-24
> Tasks: HSTV2-001 through HSTV2-009 (9/9 complete)
> Files changed: `src/renderer/utils/history.js`, `src/renderer/components/HistoryPanel.jsx`

### D-FEATURE-020-001 — History v2: bookmarks + ratings + filters shipped as additive fields
- **Date**: 2026-04-24 · **Tasks**: HSTV2-001 through HSTV2-008 · **Type**: tech-choice
- **What was done**: Added `bookmarked`, `rating`, `ratingTag` as optional fields on existing history entries. Tab switcher (All/Saved), filter chips (All/👍/👎/Unrated), stats bar, bookmark toggle button, rating section (thumbs + tag chips), entry-level indicators, and updated footer all ship in HistoryPanel.jsx with no new IPC channels.
- **Why**: All new state is client-only (localStorage) — no IPC needed. Additive optional fields mean existing history entries without these fields work unchanged (undefined is falsy).
- **Alternatives considered**: Separate localStorage key for ratings/bookmarks — rejected (join complexity, extra reads). New IPC for rating — rejected (no main-process involvement needed).
- **Impact**: `promptly_history` entry shape extended; `bookmarkHistoryItem` and `rateHistoryItem` exported from utils/history.js; HistoryPanel.jsx gains hoveredEntry state, handleBookmark, handleRate, handleTag handlers.
- **Approved by**: agent-autonomous

---

## D-POLISH-TOGGLE — 2026-04-26 — Expand/Collapse toggle buttons
- **Type**: tech-choice
- **Branch**: feat/toggle-expand-collapse
- **What was done**: Added expand button to IdleState.jsx traffic lights row (top-right, 22×22px, four-corner arrow SVG) and collapse button to PromptReadyState.jsx + PolishReadyState.jsx (top-right, 26×26px, two-bar SVG, position:absolute). STATE_HEIGHTS.IDLE increased from 118 to 134px to give bottom breathing room. Bottom tagline moved from 8px to 10px clearance. Expand → transition(STATES.PROMPT_READY); Collapse → transition(STATES.IDLE). Window resize handled automatically by existing transition().
- **Why**: No affordance existed to toggle between minimized bar and expanded view. Pure visual change — zero logic, IPC, or hook changes.
- **Alternatives considered**: New EXPANDED state — rejected (no new state needed; PROMPT_READY is the expanded view). Width change to 760px — rejected (standard 520px window is correct for PROMPT_READY).
- **Impact**: IdleState height 118 → 134px. Both PROMPT_READY components gain onCollapse prop. PolishReadyState outer div gains position:relative to anchor absolute collapse button.
- **Approved by**: agent-autonomous

---

## 2026-04-26 — Spec review: POLISH-TOGGLE (on-demand post-build)
> P0: 0 · P1: 4 · P2: 5
> Action: findings logged; code already correct (build review caught what spec missed)
> Report: vibe/spec-reviews/2026-04-26-toggle.md
> Key lessons: (1) Every design task needs "Done when:" criteria. (2) "Zero logic changes" is too absolute — qualify as "no business logic". (3) Always spec empty-state UX for buttons that depend on async state.

---

### D-BUG-TOGGLE-002 — Tear down ExpandedIdleView, rebuild as three-zone ExpandedView
- **Date**: 2026-04-26 · **Task**: BUG-TOGGLE-002 · **Type**: drift (wrong implementation)
- **Root cause**: Previous agent built `ExpandedIdleView.jsx` as a generic centred mic screen (reskin of IdleState) instead of the specified three-zone layout. App.jsx only gated IDLE state on `isExpanded`; RECORDING/THINKING/PROMPT_READY all rendered their normal components in the 760px window, ignoring the layout mode. Window height was also 560 instead of specified 580.
- **Files in scope**: `src/renderer/components/ExpandedView.jsx` (new), `src/renderer/App.jsx`
- **Fix approach**: Created `ExpandedView.jsx` with three zones — top transport bar (record/stop/pause/waveform), left session-history panel (228px, getHistory()), right state-content panel (IDLE/RECORDING/THINKING/PROMPT_READY content). App.jsx: when `isExpanded=true`, renders `<ExpandedView>` as the sole renderer for ALL states. Fixed height 560→580 (STATE_HEIGHTS.EXPANDED=580). Removed inline collapse button (moved into ExpandedView top bar). Deleted `ExpandedIdleView.jsx`.
- **CODEBASE.md update**: Yes — added ExpandedView.jsx row, removed ExpandedIdleView.jsx, added EXPANDED=580 to state heights table.
- **ARCHITECTURE.md update**: Yes — added isExpanded layout mode section to state management rules.
- **Deviations from BUG_PLAN.md**: None.
- **Approved by**: human

---

### D-BUG-TOGGLE-003 — ExpandedView visual polish pass
- **Date**: 2026-04-27 · **Task**: BUG-TOGGLE-003 · **Type**: drift (visual spec not fully implemented)
- **Root cause**: Several visual details from the POLISH-TOGGLE spec were not implemented in the BUG-TOGGLE-002 pass: timer was 11px instead of 13px, pause button was conditionally shown instead of always visible, no settings button in right flank, history entries used borderRadius+margin layout instead of border-bottom compact rows, SESSION HISTORY label used fontWeight 500 instead of 700, idle right panel had plain text instead of centred mic icon circle, collapse button was inside the traffic-light row div instead of position absolute in the top-bar, and the breathing ring on the idle mic button was applied as SVG animation instead of a separate border div.
- **Files changed**: `src/renderer/components/ExpandedView.jsx` only (visual only — no logic changes)
- **What was fixed**:
  1. Top bar: confirmed #111113 (already correct)
  2. Transport row: pause button always visible (amber when recording, neutral otherwise); timer font-size 13px + letter-spacing 0.06em; settings button (sliders icon) added to right flank
  3. Idle mic button: breathing ring as separate absolutely-positioned div (border 1px rgba(255,255,255,0.06), breathe 3s keyframe); mic icon stroke changed to rgba(255,255,255,0.55)
  4. History entries: padding 10px 16px, border-bottom 0.5px rgba(255,255,255,0.04), no borderRadius; mode tag pill with per-mode colour (blue/green/purple); title 12.5px rgba(255,255,255,0.48), active rgba(255,255,255,0.82) weight 500
  5. SESSION HISTORY label: fontWeight 700, letterSpacing 0.12em, border-bottom 0.5px rgba(255,255,255,0.05)
  6. Right panel idle: centred column (flex, gap 16px) — 56px mic icon circle (rgba(10,132,255,0.08) bg + blue border) + title 16px + hint 12px
  7. Panel separator: already correct 0.5px rgba(255,255,255,0.06)
  8. Window height: already 580 in STATE_HEIGHTS
  9. Collapse button: moved to position absolute (top 14px, right 16px) inside top-bar div (position relative); traffic-light row is now a plain drag spacer with no children
- **Added keyframes**: breathe (3s ease-in-out, scale 1→1.08 + opacity 0.4→1)
- **Approved by**: human

---

### D-BUG-TOGGLE-004 — Waveform and skeleton visual fixes in ExpandedView
- **Date**: 2026-04-27 · **Task**: BUG-TOGGLE-004 · **Type**: drift (visual spec not fully implemented)
- **Root cause**: Five visual issues identified after BUG-TOGGLE-003: waveform canvas stretched full width (no breathing room), pixelated waveform lines due to missing devicePixelRatio scaling, line widths too thick, skeleton bars touched panel edges and lacked section grouping, pulse rings were too aggressive.
- **Files changed**: `src/renderer/components/WaveformCanvas.jsx`, `src/renderer/components/MorphCanvas.jsx`, `src/renderer/components/ExpandedView.jsx`
- **What was fixed**:
  1. **Waveform containment (FIX 1)**: Waveform zone div changed to `display: flex, alignItems: center, justifyContent: center, padding: 0 20%` — both red and blue waveforms now occupy 60% centre with 20% breathing room each side. Canvas `style.width: 100%` fills the inner 60% zone.
  2. **DPR crisp rendering (FIX 2)**: Both WaveformCanvas and MorphCanvas now read `canvas.offsetWidth` at mount, set `canvas.width = displayW * dpr`, `canvas.height = 36 * dpr`, and call `ctx.scale(dpr, dpr)`. Draw functions use display dimensions (not pixel dimensions). Removes all blocky/8-bit appearance.
  3. **Line style (FIX 3)**: Red waveform — glow layer lineWidth 3 (was 5) at rgba(200,50,35,0.07), sharp line lineWidth 1 (was 1.5) with gradient rgba(200,50,35,0)→rgba(200,50,35,0.65)→rgba(200,50,35,0). Blue morph — same lineWidth 3/1 pattern, gradient rgba(10,132,255,0)→rgba(10,132,255,0.4)→0, amplitude max ~4px (was ~5.5px).
  4. **Skeleton sections (FIX 4)**: Thinking state padding changed to `24px 15%`. Three skeleton sections, each with a label bar (8px, width 30%, rgba(100,170,255,0.08)) followed by two content bars (10px, borderRadius 5px, rgba(255,255,255,0.05)) at widths 88%/72%, 94%/65%, 80%/55%. Added `skeleton-pulse` keyframe (opacity 0.6→1→0.6).
  5. **Pulse rings (FIX 5)**: Replaced `pulse-inner` / `pulse-expand` animations with single `pulse-ring` keyframe (scale 1→1.8, opacity 0.6→0). Ring 1: 1px solid rgba(200,50,35,0.3), 2.2s, no delay. Ring 2: 1px solid rgba(200,50,35,0.15), 2.2s, 0.7s delay. Max scale 1.8 (was implied >2.2).
- **Approved by**: human

---

### D-BUG-TOGGLE-005 — ExpandedView resize to 1100×860 (Claude app dimensions)
- **Date**: 2026-04-27 · **Task**: BUG-TOGGLE-005 · **Type**: design (scale-up to match Claude desktop app window)
- **Root cause**: ExpandedView was 760×580 — too small relative to the Claude desktop app window users will compare it against. All elements felt cramped at that size.
- **Files changed**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx` (visual only — no logic changes)
- **What was changed**:
  1. **Window dimensions**: `STATE_HEIGHTS.EXPANDED` 580 → 860; `setWindowSize` 760×580 → 1100×860
  2. **Left panel width**: 228px → 300px
  3. **Top bar transport controls**: Mic/stop button 52px → 60px; flanking buttons (pause, settings) 34px → 38px; flanking group width 120px → 140px; timer 13px → 14px; mode pill 10px/4px 12px → 12px/6px 16px; waveform zone height 36px → 44px; transport row bottom padding 10px → 12px
  4. **Collapse button**: 26×26 → 28×28, positioned top 16px right 18px; SVG 12px → 13px
  5. **SESSION HISTORY label**: padding 12px 14px 10px → 16px 18px 12px; font-size 9px → 10px
  6. **History entries**: padding 10px 16px → 12px 18px; timestamp 10px → 11px; title 12.5px → 13.5px; mode tag 9px/1px 6px → 10px/2px 7px
  7. **Right panel idle**: mic circle 56px → 68px; title 16px → 20px; hint 12px → 13px; gap 16px → 20px
  8. **PROMPT_READY header**: padding 16px 20px 12px → 16px 24px 12px; green ✓ 15px → 17px; action links 11px/gap 14px → 12px/gap 18px
  9. **Two-column content**: grid gap 20px → 28px; content padding 16px 20px → 22px 28px; section label 9px → 10px; body 13px/1.75 → 14px/1.8; section gap 16px → 18px
  10. **Action row (PROMPT_READY)**: padding 12px 20px 16px → 14px 24px 20px; buttons 36px/12px → 40px/13px; copy button padding 0 20px → 0 32px; divider margin 0 20px → 0 28px
  11. **Entry detail right panel**: "You said" padding 18px 20px 14px → 22px 28px 14px; divider margin 0 20px → 0 28px; prompt content padding 14px 20px → 18px 28px; rating section 12px 20px → 12px 28px; action row padding 12px 20px 16px → 14px 24px 20px; buttons 36px/12px → 40px/13px
  12. **renderPromptSections**: label 9px → 10px, gap 14px → 18px; body 13px/1.75 → 14px/1.8; transcript text 13px/1.65 → 14px/1.7
- **Approved by**: human

---

### D-BUG-REC-001 — ExpandedView mic button dead after first recording
- **Date**: 2026-04-27 · **Type**: drift (guard condition too narrow)
- **Root cause**: `onStart` prop passed to `ExpandedView` had guard `stateRef.current === STATES.IDLE` — but after the first recording completes, state is `PROMPT_READY`. Transport bar mic is always visible in expanded mode, so clicking it from `PROMPT_READY` silently no-ops.
- **Files changed**: `src/renderer/App.jsx` (1 line — `onStart` prop for ExpandedView only)
- **Fix**: Guard changed to `s === STATES.IDLE || s === STATES.PROMPT_READY` — allows starting a new recording from either idle or prompt-ready state. IdleState's `onStart` (line 439) left unchanged — it is only ever rendered in IDLE state anyway.
- **Approved by**: human

---

## D-TYPING-EXPANDED — Typing state added to expanded view right panel

- **Date**: 2026-04-27 · **Type**: feature (visual — no logic changes)
- **Decision**: Implement full TYPING state UI in ExpandedDetailPanel.jsx right panel. Local `typingText` state owned by ExpandedDetailPanel — not lifted to App.jsx — since it is pure UI state. Two new props threaded from App.jsx → ExpandedView → ExpandedDetailPanel: `onTypingSubmit` (= existing `handleTypingSubmit`) and `onSwitchToVoice` (= `() => transition(STATES.IDLE)`). Transport bar dims mic (0.5), flanking buttons (0.35), and timer (0.2) via `isTyping = currentState === 'TYPING'` opacity — no new props, uses existing `currentState` prop.
- **Files changed**: `ExpandedDetailPanel.jsx`, `ExpandedTransportBar.jsx`, `ExpandedView.jsx`, `App.jsx`
- **Approved by**: human

---

### D-BUG-ITER-STOP — Iterating stop button missing in expanded view
- **Date**: 2026-04-27 · **Type**: drift (bug)
- **Root cause**: `ExpandedTransportBar.jsx` had no `isIterating` check — `isRecording` was `false` during ITERATING, so centre button called `onStart` (new recording) instead of `stopIterating`. `ExpandedView` never forwarded `stopIterating` from App.jsx.
- **Files changed**: `App.jsx` (add `onStopIterate` prop), `ExpandedView.jsx` (forward `onStopIterate`), `ExpandedTransportBar.jsx` (add `isIterating` + blue stop UI + MorphCanvas waveform)
- **Fix**: Added `onStopIterate` prop chain (App → ExpandedView → ExpandedTransportBar). In transport bar: `isIterating = currentState === 'ITERATING'`; centre button shows blue stop square + calls `onStopIterate`; blue pulse rings + `iterGlow` animation; MorphCanvas renders in waveform zone; pause/timer dimmed.
- **Approved by**: human

---

### D-BUG-TOGGLE-007 — Vertical clamping on expand: bottom edge clipped by screen boundary
- **Date**: 2026-04-27 · **Task**: BUG-TOGGLE-007 · **Type**: drift (positioning bug)
- **Root cause**: BUG-TOGGLE-006 centred the window horizontally but preserved `preExpandBounds.y` unchanged. If the compact bar was near the bottom of the screen, the 860px expanded window overflowed below the work area bottom edge.
- **Files changed**: `main.js` (set-window-size IPC handler, expand branch only)
- **Fix**: In the expand branch of `set-window-size`, compute `maxY = workArea.y + workArea.height - height` (lowest y where window fits fully). Apply `newY = Math.max(Math.min(currentY, maxY), workArea.y)` — shifts up only as much as needed; also clamps top edge to work area top. Collapse still restores `preExpandBounds.y` exactly (clamping is expand-only).
- **Logic**:
  1. `maxY` = bottom of workArea minus expanded window height
  2. `Math.min(currentY, maxY)` — keep current y if it fits, otherwise shift up just enough
  3. `Math.max(..., dy)` — prevent over-correction from pushing top edge off screen
- **Constraints**: Horizontal centering from BUG-TOGGLE-006 unchanged. No renderer changes. `animate: false` preserved. `preExpandBounds` store/restore unchanged.
- **Approved by**: human

---
### D-BUG-RELEASE-NODE-PATH — Bug fix: release.sh fails with "env: node: No such file or directory" on nvm machines
- **Date**: 2026-04-28 · **Type**: drift (bug)
- **Folder**: vibe/bugs/2026-04-28-bug-release-node-path/
- **Root cause**: `release.sh` called `node -e "..."` and `npx electron-builder` without sourcing nvm first. Running `bash release.sh` skips `.zshrc`, so nvm's shim dir is not in PATH → `/usr/bin/env node: No such file or directory`.
- **Files in scope**: `scripts/release.sh`
- **Fix approach**: Added nvm init block + preflight `command -v node/npx` checks at top of script, before arg check. Same pattern as `main.js` resolveClaudePath().
- **ARCHITECTURE.md update**: Yes — added shell scripts rule to PATH resolution section.
- **CODEBASE.md update**: No — release.sh is not in the file map.
- **Deviations from BUG_PLAN.md**: None.
- **Approved by**: human

---

## — Feature Start: FEATURE-IMAGE-BUILDER — 2026-04-27
> Folder: vibe/features/2026-04-27-image-builder/
> New "Image" mode — guided 3-tier question interview after speech recording → Claude assembles natural language image generation prompt for Nano Banana 2, Nano Banana Pro, and ChatGPT image gen.
> Tasks: IMG-001 through IMG-010 | Estimated: 8-10 hours (S: 7, M: 3)
> New states: IMAGE_BUILDER, IMAGE_BUILDER_DONE
> New components: ImageBuilderState.jsx, ImageBuilderDoneState.jsx
> New mode key: 'image' (purple accent rgba(139,92,246))
> Drift logged below.

---

### D-IMAGE-001 — Image mode passthrough in generate-prompt IPC
- **Date**: 2026-04-27 · **Task**: IMG-002 · **Type**: tech-choice
- **What was planned**: Standard generate-prompt call for all modes
- **What was done**: Added `passthrough: true` flag to image MODE_CONFIG. generate-prompt handler returns `{ success: true, prompt: transcript }` immediately for image mode — no Claude call.
- **Why**: Image mode flow is RECORDING → THINKING (Whisper) → IMAGE_BUILDER (questions) → THINKING (Claude assembly) → IMAGE_BUILDER_DONE. The Claude call happens after the user answers questions, not immediately after transcription. useRecording.js always calls generate-prompt after Whisper; the passthrough makes it a no-op so App.jsx can detect mode === 'image' in handleGenerateResult and route to IMAGE_BUILDER.
- **Alternatives considered**: Modify useRecording.js to skip generate-prompt for image mode (out of scope per spec); intercept in handleGenerateResult with a wasted Claude call (wasteful).
- **Impact on other tasks**: None — passthrough only applies when mode === 'image'.
- **Approved by**: agent-autonomous

### D-IMAGE-002 — imageBuilderProps bundle passed to ExpandedView → ExpandedDetailPanel
- **Date**: 2026-04-27 · **Task**: IMG-009 · **Type**: tech-choice
- **What was planned**: isExpanded prop on ImageBuilderState
- **What was done**: Bundled all image handler props into an `imageBuilderProps` object passed to ExpandedView, then forwarded to ExpandedDetailPanel. ExpandedDetailPanel renders ImageBuilderState/ImageBuilderDoneState with `isExpanded=true` when currentState matches.
- **Why**: Threading 8+ individual props through two component levels is unwieldy. A single `imageBuilderProps` object follows the pattern used for other cross-cutting concerns.
- **Approved by**: agent-autonomous

---

### D-SPEC-REVIEW-IMG — Spec review: FEATURE-IMAGE-BUILDER
- **Date**: 2026-04-27 · **Task**: spec-review (on demand) · **Type**: tech-choice
- **P0**: 0 · **P1**: 9 (all fixed) · **P2**: 5 (logged)
- **Action**: All P1 findings fixed inline during review session.
- **Key decisions captured**:
  - Custom chip text entry: inline text field revealed below chip row; Enter confirms; empty = Skip
  - "Copy now →" with empty answers: omit model/useCase lines from system prompt; never disabled
  - Tier 2→3 transition: "Important ✓" summary box added (mirrors tier 1→2 "Essential ✓" box)
  - Expand toggle mid-interview: currentTier/currentQuestion/imageAnswers are App.jsx state/refs; survive compact→expanded transition
  - IMAGE_BUILDER sub-state pattern: currentTier/currentQuestion/imageAnswers implemented as React useState/useRef alongside main currentState — NOT nested state machine states; avoids 17 discrete states
  - History entry shape: { prompt, transcript, mode: 'image', imageAnswers: {all 17 keys}, timestamp }
- **Report**: vibe/spec-reviews/2026-04-27-image-builder.md
- **Approved by**: agent-autonomous


---

### D-IMG-REDESIGN — IMAGE_BUILDER major redesign: smart defaults + all-params review screen
- **Date**: 2026-04-27 · **Task**: IMG-003/005/006/007/012 · **Type**: scope-change
- **What was planned**: Sequential question-by-question flow (tier 1 → tier 2 → tier 3, 17 discrete questions)
- **What was done**: Replaced entirely with two-phase THINKING approach — Claude pre-selects all params from transcript in phase 1, user reviews/edits all params at once on a single screen, Claude assembles final prompt in phase 2
- **Why**: All-at-once review is faster and less tedious; Claude's pre-fills remove most manual work; user only needs to correct/add rather than answer 17 sequential questions
- **Key state changes**: currentTier + currentQuestion removed; imageDefaults + imageAnswers + removedByUser + showAdvanced + activePickerParam + thinkingLabel added; two-phase THINKING via generate-raw IPC
- **Spec review findings fixed**: P0-001 subjectDetail row missing; P0-002 single-select picker behavior; P1-001 IPC channel naming; P1-002 thinkingLabel mechanism; P1-003 removedByUser state for merge; P1-004 IMG-009 scope correction
- **Report**: vibe/spec-reviews/2026-04-27-image-builder-redesign.md
- **Approved by**: human

---

### D-BUG-001 — Trivial fix: blank screen after Confirm & generate →
- **Date**: 2026-04-27 · **Type**: drift (trivial bug)
- **Root cause**: `win.on('blur')` handler called `win.hide()` for any `currentIconState !== 'recording'`. The animated window resize (IMAGE_BUILDER 520px → THINKING 320px via `win.setSize(w, h, true)`) emits a spurious macOS blur event, hiding the window before IMAGE_BUILDER_DONE could display. Additionally IMAGE_BUILDER/IMAGE_BUILDER_DONE were missing from the stateMap, so they fell back to 'idle' — meaning any accidental blur while reviewing params also hid the window.
- **Fix**: Added 'thinking' and 'builder' exclusions to the blur guard; added IMAGE_BUILDER/IMAGE_BUILDER_DONE → 'builder' to the stateMap in `update-menubar-state` IPC handler.
- **File**: main.js — 2 hunks, 4 additions, 2 deletions
- **Approved by**: human

---

### D-BUG-002 — Fix: IMAGE_BUILDER_DONE blank screen crash in expanded view
- **Date**: 2026-04-28 · **Type**: drift (trivial bug)
- **Root cause**: `ExpandedDetailPanel.jsx` passed `imageBuilderProps.answers` to `ImageBuilderDoneState`, but App.jsx names the prop `imageAnswers`. `answers` was always `undefined`, so `Object.entries(undefined)` threw a TypeError when transitioning to `IMAGE_BUILDER_DONE`, crashing the React tree and leaving a blank unrecoverable window.
- **Fix**: `ExpandedDetailPanel.jsx` — `imageBuilderProps.answers` → `imageBuilderProps.imageAnswers`. Defensive guard added to `ImageBuilderDoneState.jsx` — `Object.entries(answers || {})`.
- **Files**: `src/renderer/components/ExpandedDetailPanel.jsx`, `src/renderer/components/ImageBuilderDoneState.jsx`
- **Approved by**: human

---

### D-VIDEO-SPEC — Spec review: FEATURE-VIDEO-BUILDER
- **Date**: 2026-04-28 · **Type**: discovery
- **P0**: 4 · **P1**: 8 · **P2**: 3 — all resolved before build
- **Key decisions from review**:
  1. Dialogue duplication removed — Audio row has 4 options only (no Dialogue chip); Row 11 is sole dialogue entry
  2. thinkingLabel + thinkingAccentColor added to App.jsx state — ThinkingState.jsx gets override props to support multiple labels in video mode
  3. useVideoBuilder.js hook added (VID-000) — mirrors useImageBuilder.js pattern instead of inline App.jsx handlers
  4. ExpandedView.jsx, ExpandedDetailPanel.jsx, ExpandedTransportBar.jsx, ThinkingState.jsx added to files in scope
  5. Collapse button: disabled (opacity 0.4 + tooltip) not hidden
  6. Copy now behaviour defined: VIDEO_BUILDER → copies transcript; VIDEO_BUILDER_DONE → copies assembled prompt
- **Report**: vibe/spec-reviews/2026-04-28-video-builder.md
- **Approved by**: human

---

### D-VIDEO-BUILD — FEATURE-VIDEO-BUILDER implementation complete
- **Date**: 2026-04-28 · **Type**: tech-choice
- **Summary**: All 12 VID tasks (VID-000 through VID-011) implemented. Key wiring decisions:
  1. `thinkingAccentColor` state added to App.jsx alongside existing `thinkingLabel` — both cleared on transition away from THINKING
  2. `videoBuilderProps` bundle mirrors `imageBuilderProps` pattern — assembled in App.jsx and forwarded through ExpandedView → ExpandedDetailPanel
  3. ExpandedDetailPanel THINKING block updated to use `thinkingLabel`/`thinkingAccentColor` props instead of hardcoded "Generating prompt..."
  4. ThinkingState.jsx accentColor prop uses RGBA string manipulation to derive background/border variants from the passed color
  5. Non-expanded VIDEO_BUILDER/VIDEO_BUILDER_DONE paths not added — video auto-expands and these states are only reachable when expanded
- **Files**: src/renderer/App.jsx, src/renderer/hooks/useVideoBuilder.js, src/renderer/components/VideoBuilderState.jsx, src/renderer/components/VideoBuilderDoneState.jsx, src/renderer/components/ExpandedView.jsx, src/renderer/components/ExpandedDetailPanel.jsx, src/renderer/components/ExpandedTransportBar.jsx, src/renderer/components/ThinkingState.jsx, src/renderer/hooks/useMode.js, main.js

---

## D-ABORT-001 — 2026-04-28 — Abort button: always-visible overlay vs per-state controls
- **Date**: 2026-04-28 · **Type**: tech-choice
- **Summary**: Feature start — FEATURE-ABORT-RESET — abort/reset button that is always accessible.
  Key decisions:
  1. Single overlay button in App.jsx for collapsed mode + button in ExpandedTransportBar for expanded mode — avoids touching every state component; single implementation point for all abort states.
  2. `abortRef` flag in App.jsx guards `handleGenerateResult` — prevents stale Claude generation completing after user resets during THINKING.
  3. Collapsed-mode button placed as sibling to animated state wrapper (outside `{isExpanded ? ... : ...}` branch), positioned absolute inside `<div id="bar">`.
  4. Expanded-mode button placed in drag-spacer row of ExpandedTransportBar (always visible), dimmed at IDLE.
  5. `handleAbort` reads `stateRef.current` (not `currentState`) — stale-closure-safe event handler.
  6. Keyboard shortcut deferred — Escape is already claimed in Typing and Shortcuts states.
- **Tasks**: ABORT-001 through ABORT-005
- **Folder**: vibe/features/2026-04-28-abort-reset/

---
## D-HEMPTY-001 — 2026-04-28 — History empty state: no auto-selection on launch
> Folder: vibe/features/2026-04-28-history-empty-state/
> Right panel shows clock icon + "Select a history to view details" when no entry is selected on launch.
> Tasks: HEMPTY-001, HEMPTY-002 | Estimated: ~30 mins
> Decision: null initial state in ExpandedView rather than auto-selecting h[0]. Empty state rendered in ExpandedDetailPanel for IDLE + no selection. Mid-session selections preserved — empty state only appears before first selection per session.
---

---
## 2026-04-28 — Spec review: history-empty-state (add-feature)
> P0: 0 · P1: 0 · P2: 1
> Action: passed — proceeded to build
> Report: vibe/spec-reviews/2026-04-28-history-empty-state.md
---

---
### D-BUG-TOGGLE-008 — 2026-04-28 — Visual redesign: transport bar + right panel (pure history viewer)
- **Date**: 2026-04-28 · **Type**: scope-change (visual redesign)
- **Branch**: feat/bug-toggle-008 (fresh branch from main — prior branch feat/toggle-expand-collapse abandoned after merge conflict complexity)
- **What was planned**: centred flanking transport row; right panel with state-driven recording/thinking/mic UI
- **What was done**:
  1. **ExpandedTransportBar**: replaced 3-column flanking layout with `inline-flex` row that shrinks to content width. Added ResizeObserver on transport row `ref`; waveform `div` width set to measured pixel value for exact alignment. Text block (right of 0.5px divider) shows state-aware hint text. Mic 52px, pause/type 36px.
  2. **ExpandedDetailPanel**: converted right panel to pure history viewer. Removed RECORDING/PAUSED/ITERATING/THINKING/IDLE-mic content blocks. Added always-visible panel header (title + Copy/Export quick links, hidden during content states). Clock empty state shown for all non-content states when nothing selected. Kept TYPING/PROMPT_READY/IMAGE_BUILDER/VIDEO_BUILDER/DONE intact.
  3. **ExpandedView**: `selected` initialises to `null` (no auto-selection). Clicking active history entry toggles deselect. Removed stale `useEffect` that cleared `isViewingHistory` on state transitions (not needed — content states now bypass history viewer via `isContentState` flag in ExpandedDetailPanel).
- **Alternatives considered**: keeping flanking layout and adding text inline → rejected, too cramped; keeping recording UI in right panel → rejected, conflicts with "pure history viewer" spec requirement
- **Impact on other tasks**: none — purely visual, no logic changes to recording/generation flow
- **Approved by**: human
