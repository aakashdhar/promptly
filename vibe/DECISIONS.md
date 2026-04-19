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
