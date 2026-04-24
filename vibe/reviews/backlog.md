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

---

## From Phase 2 Review (2026-04-18)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-013~~ | index.html | 622-624 | renderPromptOutput regex matches `**bold:**` only — plain-text `Role:` labels from BUG-008 system prompt won't get `.pt-sl` styling; section headers render flat | ✅ resolved — regex updated to `/^([A-Za-z][A-Za-z\s]*):\s*$/` |
| ~~BL-014~~ | index.html | 676-681 | RAF loop leak in setState(THINKING) — inline animMorph never cancelled; each Regenerate adds an orphaned 60fps loop drawing to hidden canvas | ✅ resolved — handle stored in morphAnimFrame; stopMorphAnim() now cancels it |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-015~~ | vibe/CODEBASE.md | multiple | Stale: pill.html listed (deleted), pillWin listed (removed), wrong IPC channels, isRecording→isProcessing, missing splash.html, PROMPT_TEMPLATE/MODE_CONFIG | ✅ resolved — full rewrite |
| ~~BL-016~~ | main.js | 182-184 | shell.openExternal URL not validated — renderer can pass any URL; add `url.startsWith('https://')` guard | ✅ resolved |
| ~~BL-017~~ | main.js / SPEC.md | 207 / 88 | 30s SPEC timeout vs 60s code — document 60s decision in DECISIONS.md or revert to 30s | ✅ resolved — D-005 logged, SPEC.md updated |
| ~~BL-018~~ | main.js / ARCHITECTURE.md | 253 | set-window-buttons-visible IPC channel not in ARCHITECTURE.md table or DECISIONS.md | ✅ resolved — D-006 logged, ARCHITECTURE.md IPC table updated |
| ~~BL-019~~ | vibe/SPEC.md | 36, F8 | SPEC.md stale: vibrancy 'sidebar' vs 'fullscreen-ui'; F8 first-run in-bar vs splash.html | ✅ resolved — SPEC.md F1 + F8 updated |
| ~~BL-020~~ | vibe/DECISIONS.md | — | FIRST_RUN state removal from index.html is undocumented — no DECISIONS.md entry | ✅ resolved — D-007 logged |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-021~~ | index.html | 463-528 | Dead code: startMorphAnim, stopMorphAnim, module-scope morphAnimFrame never used as intended (clean up after BL-014 fix) | ✅ resolved — startMorphAnim removed; morphAnimFrame now stores inline RAF handle |
| ~~BL-022~~ | index.html | 787 | Error message truncated to 60 chars — may hide actionable CLI errors | ✅ resolved — truncation removed |
| ~~BL-023~~ | splash.html | 217 | inline onclick="openInstall()" — minor deviation from event-listener pattern | ✅ resolved — addEventListener added |
| BL-024 | package.json | — | 2 low severity npm audit vulns in eslint devDep (@eslint/plugin-kit) — not in .dmg, no runtime risk. Fix: `npm audit fix --force` upgrades eslint to 9.39.4 (outside stated dep range — manual decision needed) | ⬜ open (low priority — devDep only) |

---

## From Final Review (2026-04-18)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-025~~ | main.js | 71,74,86,92,97,138 | 6 console.log statements removed | ✅ resolved — RFX-001 |
| ~~BL-026~~ | vibe/TASKS.md | 113 | Manual smoke test complete — human-confirmed 2026-04-18 | ✅ resolved — RFX-002 |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-027~~ | index.html | 181, 188, 276 | CSS hardcoded hex values at those lines | ✅ resolved — original usages gone after React migration (FEATURE-004); root index.html now only has token definitions in `:root` |
| BL-037 | src/renderer/components/ | multiple | React migration introduced new hardcoded hex instances bypassing CSS tokens — `#0A84FF` in ThinkingState.jsx:10-11 + IteratingState.jsx:160; `#30D158` in PromptReadyState.jsx:156; `#FF3B30` in App.jsx:623, PausedState.jsx:47, RecordingState.jsx:49, ErrorState.jsx:11. Should use CSS custom props or Tailwind token refs. | ⬜ open (P2) |

---

---

## From FEATURE-009 Review (2026-04-19)

### Outstanding P2 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-028~~ | vibe/DECISIONS.md | — | closeHistory → IDLE undocumented | ✅ resolved — D-BUG-011-B added |
| ~~BL-029~~ | main.js | 181–182 | minWidth/maxWidth pattern undocumented | ✅ resolved — comment added |

---

## From FEATURE-014 Review (2026-04-23)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-030 | src/renderer/App.jsx | ~561 | App.jsx over 500 lines (561) — SRP concern, pre-existing, grew +46 this feature. Consider extracting handleTypingSubmit + ⌘T keydown into useTextInput hook when App.jsx next hits a natural refactor point. | ⬜ open |
| BL-031 | package.json (devDep) | — | @xmldom/xmldom high severity GHSA-crh6-fp67-6883 (ReDoS) — electron-builder devDep chain only, NOT present in packaged .dmg. Zero runtime risk. Track for electron-builder upgrade. | ⬜ open (devDep only) |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-032~~ | src/renderer/App.jsx | ~238 | handleTypingSubmit declared as plain async function — inconsistent with useCallback pattern. Wrapped in useCallback([mode]). | ✅ resolved — fix(text-input) 3eba286 |

---

---

## From FEATURE-015 Review (2026-04-23)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-033 | src/renderer/App.jsx | 652 lines | App.jsx now 652 lines — SRP concern, grew +91 lines this feature. Extract polish flow into usePolishMode hook at next refactor: parsePolishOutput call sites, polishResult+polishToneRef+effects, handlePolishToneChange, copied/setCopied. | ⬜ open |
| BL-031 | package.json (devDep) | — | @xmldom/xmldom high severity GHSA-crh6-fp67-6883 — carryover from FEATURE-014, no change in status | ⬜ open (devDep only) |

### Outstanding P2 — Fix this sprint

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-034~~ | vibe/ARCHITECTURE.md | ~238 | Prompt modes table missing `polish` row + IPC options passthrough note | ✅ resolved — already present at ARCHITECTURE.md:119,239 (landed with FEATURE-015) |
| ~~BL-035~~ | src/renderer/App.jsx | 583 | `copied` state not reset on PolishReadyState exit | ✅ resolved — `setCopied(false)` already in `onReset` at App.jsx:583 (landed with FEATURE-015) |
| ~~BL-036~~ | vibe/features/2026-04-23-polish-mode/FEATURE_TASKS.md | 666–683 | Conformance checklist 18 items unchecked | ✅ resolved — all 18 items already ticked `[x]` in FEATURE_TASKS.md:666–683 |

---

---

## From Full Codebase Review (2026-04-24)

### Outstanding P1 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-038~~ | main.js | 1040 | `window-all-closed` checks `!tray` (always null) instead of `!menuBarTray` — app quits on forced window close instead of staying alive in menu bar | ✅ resolved — fix(main) a1ee6e9 |
| BL-031 | package.json (devDep) | — | @xmldom/xmldom HIGH severity — DoS + XML injection; `npm audit fix` resolves without breaking changes | ⬜ open (carryover — escalated, now confirmed HIGH via latest npm audit) |
| BL-033 | src/renderer/App.jsx | 1-653 | SRP — 653 lines, 8+ concerns; extract useKeyboardShortcuts + useRecording hooks | ⬜ open (carryover) |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-039 | src/renderer/App.jsx | 242-256 | `openHistory`/`closeHistory` bypass `transition()` — call `setCurrentState()` directly; `updateMenuBarState()` never fires for HISTORY transitions | ⬜ open (NEW) |
| BL-040 | src/renderer/App.jsx | 150-321 | 9-line polish/non-polish branch duplicated 3× in stopRecording, handleTypingSubmit, handleRegenerate; extract `handleGenerateResult()` helper | ⬜ open (NEW) |
| BL-041 | vibe/ARCHITECTURE.md | IPC table | Missing 4 channels (show-tone-menu, tone-selected, check-mic-status, open-settings); stale 2 channels (show-language-menu, language-selected — F-LANGUAGE removed) | ⬜ open (NEW) |
| BL-042 | vibe/ARCHITECTURE.md | State machine | States count says "9 total" — actual is 11; TYPING + SETTINGS states/transitions not listed | ⬜ open (NEW) |
| BL-043 | vibe/ARCHITECTURE.md | Never list | "Introducing a framework, bundler, or build step (Vite, Webpack, React, etc.)" contradicts the now-mainlined React migration | ⬜ open (NEW) |
| BL-044 | vibe/ARCHITECTURE.md + CODEBASE.md | — | SettingsPanel.jsx (PCFG-003, 128 lines) and SETTINGS state absent from both architecture docs | ⬜ open (NEW) |
| BL-045 | vibe/CODEBASE.md | IPC table | show-language-menu / language-selected shown as ✅ registered but not present in code (F-LANGUAGE removed) | ⬜ open (NEW) |
| BL-046 | vibe/CODEBASE.md | State machine table | STATE_HEIGHTS.TYPING listed as 220px; App.jsx:43 is 244 | ⬜ open (NEW) |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-047 | main.js | 4 | Intentional `console.error` in uncaughtException handler triggers no-console lint warning; add `// eslint-disable-next-line no-console` | ⬜ open (NEW) |
| BL-048 | main.js | 736, 779 | `const { spawn } = require('child_process')` inside handlers; add to top-level destructure at line 11 | ⬜ open (NEW) |
| BL-049 | src/renderer/App.jsx | 576 | `onDismiss={(target) => {...}}` — `target` unused; change to `onDismiss={() => ...}` | ⬜ open (NEW) |
| BL-050 | preload.js | 25-101 | `ipcRenderer.on()` listeners return no cleanup; App never unmounts so not a functional bug, but each `on*` should return `() => ipcRenderer.removeListener(...)` for correctness | ⬜ open (NEW) |
| BL-051 | vibe/TASKS.md | 253-256 | BUG-017 entry duplicated twice | ⬜ open (NEW) |

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
