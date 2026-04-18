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

## 2026-04-18 — Spec review: new-app
> P0: 1 · P1: 3 · P2: 2
> Action: all fixed before build begins
> Report: vibe/spec-reviews/2026-04-18-new-app.md

Key fixes applied:
- Mode system prompts added to SPEC.md F4 (exact text for all 5 modes)
- Conformance checklist error condition count corrected
- ARCHITECTURE.md Always + Ask First sections added (three-tier complete)
- Git branch naming convention added to ARCHITECTURE.md
