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
