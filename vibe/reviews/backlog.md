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
| ~~BL-024~~ | package.json | — | 2 low severity npm audit vulns in eslint devDep (@eslint/plugin-kit) | ✅ resolved — `npm audit` returns 0 vulnerabilities (resolved as part of BL-031 fix) |

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
| ~~BL-037~~ | src/renderer/components/ | multiple | React migration introduced new hardcoded hex instances bypassing CSS tokens | ✅ resolved — fix(backlog) a0d5dbf · all 8 instances replaced with var(--color-red/blue/green) |

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
| ~~BL-030~~ | src/renderer/App.jsx | ~561 | App.jsx over 500 lines (561) — SRP concern, pre-existing, grew +46 this feature. Consider extracting handleTypingSubmit + ⌘T keydown into useTextInput hook when App.jsx next hits a natural refactor point. | ✅ resolved — refactor(app) ed3f9b5 · App.jsx now 470 lines after useRecording + useKeyboardShortcuts extraction |
| ~~BL-031~~ | package.json (devDep) | — | @xmldom/xmldom high severity GHSA-crh6-fp67-6883 (ReDoS) — electron-builder devDep chain only, NOT present in packaged .dmg. Zero runtime risk. Track for electron-builder upgrade. | ✅ resolved — fix(deps) 13e214d · npm audit 0 vulnerabilities |

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
| ~~BL-033~~ | src/renderer/App.jsx | 652 lines | App.jsx now 652 lines — SRP concern, grew +91 lines this feature. Extract polish flow into usePolishMode hook at next refactor: parsePolishOutput call sites, polishResult+polishToneRef+effects, handlePolishToneChange, copied/setCopied. | ✅ resolved — refactor(app) ed3f9b5 · App.jsx reduced to 470 lines |
| ~~BL-031~~ | package.json (devDep) | — | @xmldom/xmldom high severity GHSA-crh6-fp67-6883 — carryover from FEATURE-014, no change in status | ✅ resolved — fix(deps) 13e214d · npm audit 0 vulnerabilities |

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
| ~~BL-031~~ | package.json (devDep) | — | @xmldom/xmldom HIGH severity — DoS + XML injection; `npm audit fix` resolves without breaking changes | ✅ resolved — fix(deps) 13e214d |
| ~~BL-033~~ | src/renderer/App.jsx | 1-653 | SRP — 653 lines, 8+ concerns; extract useKeyboardShortcuts + useRecording hooks | ✅ resolved — refactor(app) ed3f9b5 · App.jsx now 470 lines |

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-039~~ | src/renderer/App.jsx | 159-173 | `openHistory`/`closeHistory` bypass `transition()` — `updateMenuBarState()` never fires for HISTORY transitions | ✅ resolved — fix(backlog) a0d5dbf |
| ~~BL-040~~ | src/renderer/App.jsx | 150-321 | 9-line polish/non-polish branch duplicated 3× — extract `handleGenerateResult()` helper | ✅ resolved — handleGenerateResult useCallback + onGenerateResult ref pattern |
| ~~BL-041~~ | vibe/ARCHITECTURE.md | IPC table | Missing channels — 4 named were already present; added 8 more missing (show-shortcuts, shortcut-pause, update-menubar-state, uninstall-promptly, get-stored-paths, save-paths, browse-for-binary, recheck-paths) | ✅ resolved — docs(ARCHITECTURE+CODEBASE) 2026-04-24 |
| ~~BL-042~~ | vibe/ARCHITECTURE.md | State machine | States count "9 total" / TYPING+SETTINGS missing | ✅ resolved — already correct in file (11 total, TYPING+SETTINGS listed) |
| ~~BL-043~~ | vibe/ARCHITECTURE.md | Folder structure + Never list | Folder structure referenced old index.html single-file structure; Never list had duplicate + contradicted React | ✅ resolved — docs(ARCHITECTURE) 2026-04-24 |
| ~~BL-044~~ | vibe/ARCHITECTURE.md + CODEBASE.md | — | SettingsPanel.jsx and SETTINGS state absent | ✅ resolved — already correct in both files |
| ~~BL-045~~ | vibe/CODEBASE.md | DOM IDs | Stale language-pill DOM ID entry (F-LANGUAGE removed) | ✅ resolved — docs(CODEBASE) 2026-04-24 |
| ~~BL-046~~ | vibe/CODEBASE.md | State machine table | TYPING height 220px vs actual 244 | ✅ resolved — already correct in file (244–320px) |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-047~~ | main.js | 4 | Intentional `console.error` in uncaughtException handler triggers no-console lint warning | ✅ resolved — 0 warnings in final lint run |
| ~~BL-048~~ | main.js | 736, 779 | `const { spawn } = require('child_process')` inside handlers | ✅ resolved — spawn in top-level destructure at line 12 |
| ~~BL-051~~ | vibe/TASKS.md | 253-256 | BUG-017 entry duplicated twice | ✅ resolved — docs(TASKS+reviews) de78276 |

---

## From Final Review (2026-04-24)

### Outstanding P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-052~~ | src/renderer/App.jsx | 394 | TypingState "Switch to voice" silently broken — `onDismiss('voice')` arg discarded; user lands in IDLE not RECORDING | ✅ by design — IDLE landing is intentional; gives user chance to switch mode before recording starts |
| ~~BL-053~~ | src/renderer/App.jsx | 317 | `onThemeChanged` IPC listener registered in useEffect with no cleanup return — leak on hot-reload | ✅ resolved — fix(backlog) a0d5dbf |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| ~~BL-054~~ | src/renderer/components/HistoryPanel.jsx | 83 | `navigator.clipboard.writeText()` bypasses `electronAPI.copyToClipboard()` IPC — minor pattern inconsistency | ✅ resolved — fix(backlog) a0d5dbf |
| ~~BL-055~~ | src/renderer/index.html | — | No CSP meta tag in Vite HTML entry | ✅ resolved — fix(backlog) a0d5dbf |
| ~~BL-056~~ | package.json | 27 | `canvas` devDependency unused | ✅ resolved — fix(backlog) a0d5dbf |

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

---

## From POLISH-TOGGLE Review (2026-04-26)

### Outstanding P2 — Fix before deploy

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-057 | vibe/CODEBASE.md | 107 | IDLE height listed as 101px — actual STATE_HEIGHTS.IDLE is now 134px (was already wrong at 118px; this change widens the gap) | ✅ resolved — docs(CODEBASE) 2026-04-26 |
| ~~BL-058~~ | src/renderer/App.jsx | 383 | Expand button unconditionally transitions to PROMPT_READY — shows empty UI ("✓ Prompt ready" + empty content) if no prompt generated yet. Fix: hide expand when `generatedPrompt` is empty. | ✅ resolved — `onExpand={generatedPrompt ? () => transition(...) : null}` App.jsx:383 |
| ~~BL-059~~ | IdleState.jsx:22-41, PromptReadyState.jsx:147-167, PolishReadyState.jsx:11-28 | — | No hover feedback on expand/collapse buttons — inconsistent with existing button pattern (keyboard, Edit, Copy all have onMouseEnter/Leave). | ✅ resolved — onMouseEnter/onMouseLeave added to all three buttons |

### Outstanding P3

| ID | File | Line | Finding | Status |
|----|------|------|---------|--------|
| BL-060 | src/renderer/components/PolishReadyState.jsx | 31-35 | At narrow widths, top-row tone toggle and collapse button could appear visually crowded — not a bug at 520px, noting for awareness. | Open / monitor |

---

## From POLISH-TOGGLE Spec Review (2026-04-26)

### Spec P1/P2 — All resolved 2026-04-26

| ID | File | Finding | Status |
|----|------|---------|--------|
| ~~P1-001~~ | DESIGN_TASKS.md | All 5 tasks had no acceptance criteria | ✅ resolved — "Done when:" blocks added to TOG-001/002/003/005 |
| ~~P1-002~~ | DESIGN_TASKS.md / DESIGN_PLAN.md | TOG-004 was non-actionable ("no extra code needed") | ✅ resolved — TOG-004 removed; resize verification absorbed into TOG-003 criteria |
| ~~P1-003~~ | DESIGN_SPEC.md | Empty-state behaviour for expand button undefined | ✅ resolved — opacity 0.35 / cursor default / onExpand null spec added |
| ~~P1-004~~ | DESIGN_SPEC.md | "Zero logic changes" constraint too absolute | ✅ resolved — replaced with qualified constraint allowing minimal conditional display logic |
| ~~P2-SR-001~~ | DESIGN_SPEC.md | margin-right: 2px (actual: 14px) | ✅ resolved — updated to 14px |
| ~~P2-SR-002~~ | DESIGN_SPEC.md | Container padding 0 14px 0 0 (actual: no parent padding) | ✅ resolved — spec updated to match |
| ~~P2-SR-003~~ | DESIGN_SPEC.md | No hover states specified | ✅ resolved — hover spec added to both buttons |
| ~~P2-SR-004~~ | DESIGN_TASKS.md | Smoke checklist not embedded in design docs | ✅ resolved — 11-item checklist embedded in DESIGN_TASKS.md |
| ~~P2-SR-005~~ | DESIGN_SPEC.md | No user type defined | ✅ resolved — "power users returning to a previously generated prompt" added |
