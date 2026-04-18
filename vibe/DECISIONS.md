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
