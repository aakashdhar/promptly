# Review Backlog — Promptly
> P1/P2/P3 findings that must resolve before deploy.
> P0 findings go directly to TASKS.md as blocking tasks.
> Updated after each phase review.

---

## From Phase 1 Review (2026-04-18)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-001 | preload.js | 7-8 | generate-prompt sends two separate args; main.js expects one object `{ transcript, mode }` — will break F-CLAUDE | ⬜ open |
| BL-002 | main.js | 79-83 | check-claude-path returns `{ path }` / `{ error }` — missing `found` boolean; F-FIRST-RUN checks `result.found` | ⬜ open |
| BL-003 | main.js | 13-29 | Window not positioned — SPEC F1 requires centred horizontally near bottom of screen | ⬜ open |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-004 | preload.js + main.js | 10-11, 74-77 | copy-to-clipboard payload/return diverge from SPEC (`{ text }` / `{ success }` vs raw string / `{ ok: true }`) | ⬜ open |
| BL-005 | main.js | 61 | shortcut-conflict sends no payload — SPEC requires `{ fallback }` with the active shortcut string | ⬜ open |
| BL-006 | package.json | 9 | index.html excluded from lint script — no DECISIONS.md entry for this intentional change | ⬜ open |

## Resolved Issues
(none yet)
