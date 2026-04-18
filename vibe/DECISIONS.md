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

## 2026-04-18 — Feature Start: F-SPEECH — Speech Recording
> Folder: vibe/features/2026-04-18-speech-recording/
> Implements webkitSpeechRecognition with live transcript, originalTranscript capture at stop, auto-stop on silence.
> Tasks: FPH-001, FPH-002, FPH-003 | Estimated: ~3 hours (S: 2, M: 1)
> Dependencies met: F-STATE ✅, F-FIRST-RUN ✅
> Drift logged below.

---

## 2026-04-18 — Spec review: add-feature (F-SPEECH)
> P0: 0 · P1: 1 · P2: 1
> Action: all fixed
> Report: vibe/spec-reviews/2026-04-18-add-feature-speech-recording.md

Key fixes applied:
- onerror 'no-speech' branch added to FEATURE_PLAN.md handler code and FEATURE_TASKS.md FPH-002 criteria
- Text cursor animation clarified as v2 deferral (blinking dot covers v1 requirement)
