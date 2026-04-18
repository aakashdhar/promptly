# Review Backlog — Promptly
> P1/P2/P3 findings that must resolve before deploy.
> P0 findings go directly to TASKS.md as blocking tasks.
> Updated after each phase review.

---

## From Phase 1 Review (2026-04-18)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-001~~ | preload.js | 7-8 | generate-prompt sends two separate args; main.js expects one object `{ transcript, mode }` | ✅ resolved (FST-004/005) |
| ~~BL-002~~ | main.js | 79-83 | check-claude-path missing `found` boolean | ✅ resolved (FST-004/005) |
| ~~BL-003~~ | main.js | 13-29 | Window not positioned | ✅ resolved (FST-004/005) |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-004~~ | preload.js + main.js | 11, 80-83 | copy-to-clipboard payload/return diverge from SPEC | ✅ resolved — preload sends `{ text }`, main returns `{ success: true }` |
| ~~BL-005~~ | main.js | 67 | shortcut-conflict sends no payload | ✅ resolved — sends `{ fallback: SHORTCUT_FALLBACK }` |
| ~~BL-006~~ | DECISIONS.md | — | index.html lint exclusion undocumented | ✅ resolved — D-001 added |

---

## From F-STATE Review (2026-04-18)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-007~~ | vibe/ARCHITECTURE.md | 112-120 | `resize-window` IPC channel missing from IPC surface table | ✅ resolved inline (F-STATE review) |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-008~~ | index.html | 363 | Direct DOM visibility mutation outside setState() — conflict notice | ✅ resolved — routed through setState() with `conflictNotice` payload |
| ~~BL-009~~ | vibe/ARCHITECTURE.md | 76-77 | localStorage wrappers section only mentions getMode/setMode — getFirstRunComplete/setFirstRunComplete not documented | ✅ resolved inline (F-STATE review) |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-010~~ | vibe/CODEBASE.md | 10 | Phase status stale — says "4/5 tasks done", F-STATE is 5/5 complete | ✅ resolved inline (F-STATE review) |
| ~~BL-011~~ | index.html | 372-373 | getMode() called twice in boot sequence — store in variable before use | ✅ resolved inline (F-STATE review) |
| ~~BL-012~~ | index.html | 322 | setState guard `!STATE_HEIGHTS[newState]` — truthiness check | ✅ resolved — uses `=== undefined` |

---

## Resolved Issues

| ID | Finding | Resolved in |
|----|---------|-------------|
| BL-001 | generate-prompt arg mismatch | F-STATE (FST-004/005) |
| BL-002 | check-claude-path missing `found` field | F-STATE (FST-004/005) |
| BL-003 | Window not positioned | F-STATE (FST-004/005) |
| BL-006 | index.html lint exclusion undocumented | D-001 in DECISIONS.md |
| BL-007 | ARCHITECTURE.md missing resize-window IPC row | F-STATE review inline |
| BL-008 | Conflict notice direct DOM mutation outside setState() | Backlog fix — conflictNotice payload |
| BL-009 | ARCHITECTURE.md localStorage wrappers incomplete | F-STATE review inline |
| BL-010 | CODEBASE.md phase status stale | F-STATE review inline |
| BL-011 | getMode() called twice in boot | F-STATE review inline |
| BL-004 | copy-to-clipboard SPEC mismatch | Backlog fix |
| BL-005 | shortcut-conflict no fallback payload | Backlog fix |
| BL-012 | setState guard truthiness check | Backlog fix |
