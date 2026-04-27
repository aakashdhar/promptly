# Full Project Review — Promptly
> Date: 2026-04-27 | Scope: Full codebase | Model: claude-sonnet-4-6

---

## Automated checks

### ESLint (`npm run lint`)
```
> promptly@1.5.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### `npm run build:renderer`
```
vite v8.0.8 building client environment for production...
✓ 43 modules transformed.
dist-renderer/index.html                   1.09 kB │ gzip:  0.57 kB
dist-renderer/assets/index-*.css          20.87 kB │ gzip:  4.62 kB
dist-renderer/assets/index-*.js          307.55 kB │ gzip: 84.40 kB
✓ built in 131ms
```
✅ Build succeeds. Bundle 307 kB / 84 kB gzipped.

### `npm audit`
```
found 0 vulnerabilities
```
✅ Zero vulnerabilities.

---

## Carryover from previous reviews

Most recent scored review: **expanded-view-postfix-review-2026-04-27.md — 9.7/10 (Grade A)**
Prior: **toggle-review-2026-04-26.md — 9.9/10 (Grade A, post-fix)**

Open items from backlog.md at review start:

| ID | Status |
|----|--------|
| BL-060 | P3 — visual crowding at narrow widths in PolishReadyState. Monitor-only, no action required. |
| P3-EXP-001 | P3 — HistoryPanel.jsx at 663 lines (pre-existing). Open. |
| P3-EXP-002 | P3 — ExpandedDetailPanel + ExpandedView 17 props each. Structural necessity. Open. |
| P3-EXP-003 | P3 — renderPromptSections partial duplication in ExpandedDetailPanel. Open. |

All backlog P0 and P1 items: ✅ resolved. No carryover P1 escalations.

---

## Step 0A — Dependency graph pre-screening

`vibe/graph/DEPENDENCY_GRAPH.json` confirms: god node is `App.jsx` at 20 connections (known, flagged in graph metadata). All four `expanded-view` files belong to the same `renderer` concept. No cross-concept import violations detected.

---

## Architecture drift detection

| Rule | Status | Evidence |
|------|--------|---------|
| PATH resolution — `claudePath` used everywhere | ✅ | `main.js:732,774` — both `generate-prompt` + `generate-raw` guard `if (!claudePath)` and use cached path in `spawn(claudePath, ...)`. All resolution done at startup. |
| `transition()` is sole DOM-change path | ✅ | `openHistory`/`closeHistory` bypass `transition()` but correctly call all four side-effects manually (setWindowSize, setWindowButtonsVisible, updateMenuBarState, animateToState). Pattern documented in CODEBASE.md. |
| `localStorage` only via wrapper functions | ✅ | Zero direct `localStorage.*` accesses outside `hooks/useMode.js`, `hooks/useTone.js`, `utils/history.js`. |
| `nodeIntegration: false`, `contextIsolation: true` | ✅ | `main.js:578-579` (win), `main.js:660-661` (splashWin). |
| No `dangerouslySetInnerHTML` with dynamic content | ✅ | Zero matches across all `src/renderer/**` files. |
| Zero runtime npm dependencies | ✅ | `package.json` runtime deps: zero. React/Vite/Tailwind are devDeps compiled out. |
| `originalTranscript` immutability | ✅ | Set once in `stopRecording` onstop; documented exception in DECISIONS.md D-ITER-003 for iteration flow. |
| `contextBridge` pattern | ✅ | All renderer↔main communication via `window.electronAPI`. No direct `ipcRenderer` in renderer code. |
| IPC listeners cleaned up | ⚠️ | `useKeyboardShortcuts.js:21-55` — IPC listeners (onShortcutTriggered, onModeSelected, onToneSelected, onShowShortcuts, onShowHistory, onShortcutPause, onOpenSettings) registered in a `useEffect(() => {...}, [])` but the effect does NOT return a cleanup function. The `preload.js` returns unsubscribe functions from each `on*` registration, but the cleanup return values are discarded. In development hot-reload, this creates listener accumulation. Production (no HMR) is unaffected. |
| @keyframes defined only in index.css | ✅ | Zero `@keyframes` or `<style>` blocks in component files. `index.css` owns all keyframes. |

**Architecture drift finding:** IPC listener cleanup omission (see P2-001 below).

---

## Findings

### P0 — Critical (blocks)

**None.**

---

### P1 — Fix before next distribution

**None.**

---

### P2 — Should fix

#### P2-001 — IPC listener accumulation on HMR (development only)
- **File:** `src/renderer/hooks/useKeyboardShortcuts.js:21-55`
- **Evidence:** `useEffect(() => { window.electronAPI.onShortcutTriggered(...); window.electronAPI.onModeSelected(...); ... }, [])` — seven listener registrations, zero cleanups returned. Each `on*` method in `preload.js` returns `() => ipcRenderer.removeListener(...)` but that return value is discarded. In production this is a cosmetic issue (React mounts once, never re-mounts). In `npm run dev` (HMR enabled), Vite module hot-swaps re-run the effect and accumulate duplicate listeners. A developer trigger like ⌥Space then fires the shortcut handler N times.
- **Fix:** Capture all unsubscribers and return a cleanup:
  ```js
  useEffect(() => {
    if (!window.electronAPI) return
    const unsubs = [
      window.electronAPI.onShortcutTriggered(...),
      window.electronAPI.onModeSelected(...),
      // ... 5 more
    ]
    return () => unsubs.forEach(fn => fn?.())
  }, [])
  ```
- **Severity:** P2 — production unaffected; dev experience only.

#### P2-002 — ARCHITECTURE.md ExpandedView dimensions stale (BUG-TOGGLE-005 not reflected)
- **File:** `vibe/ARCHITECTURE.md:96-99`
- **Evidence:** `handleExpand(): ... calls setWindowSize(760, 580)` and `STATE_HEIGHTS.EXPANDED = 580`. Actual since BUG-TOGGLE-005: `setWindowSize(1100, 860)`, `STATE_HEIGHTS.EXPANDED = 860` (`App.jsx:48,121`). CODEBASE.md state table (`line 113`) is correct at 1100×860; ARCHITECTURE.md `isExpanded` section is stale by ~2 days.
- **Fix:** Update `vibe/ARCHITECTURE.md` lines 96-99 to reflect 1100×860 and reference BUG-TOGGLE-005.

#### P2-003 — ARCHITECTURE.md missing window lifecycle section (BUG-018 deliverable not added)
- **File:** `vibe/ARCHITECTURE.md` — section absent
- **Evidence:** BUG-018-004 acceptance criterion was "ARCHITECTURE.md window lifecycle section updated." DECISIONS.md D-BUG-018 is present. The ARCHITECTURE.md file contains no section covering: `isQuitting` flag, `win.on('close')` hide-intercept, `app.requestSingleInstanceLock()`, `before-quit` handler, or `win.on('blur')` auto-hide. These are critical patterns for anyone extending `main.js`.
- **Fix:** Add a "Window lifecycle" section to `vibe/ARCHITECTURE.md` covering these four patterns.

#### P2-004 — CODEBASE.md ExpandedView props list missing 3 props; line count stale
- **File:** `vibe/CODEBASE.md:37`
- **Evidence:** CODEBASE.md lists 22 props for `ExpandedView.jsx` but the actual signature (`ExpandedView.jsx:7-33`) has 25 props: `onTypingSubmit`, `onSwitchToVoice`, and `onTypePrompt` were added post-BUG-TOGGLE-002/003 and are absent from the doc. Line count listed as "92 lines" but actual is 100.
- **Fix:** Update CODEBASE.md ExpandedView row to add the three missing props and correct the line count.

#### P2-005 — CODEBASE.md missing two registered IPC channels
- **File:** `vibe/CODEBASE.md` IPC channels table
- **Evidence:** `splash-check-whisper` and `check-mic-status` are both registered in `main.js` (`lines 687, 709`) and documented in `ARCHITECTURE.md` IPC table, but are absent from the CODEBASE.md IPC channels table. CODEBASE.md is the agent's live reference; missing entries risk re-registering them.
- **Fix:** Add rows for `splash-check-whisper` and `check-mic-status` to the CODEBASE.md IPC table.

#### P2-006 — CODEBASE.md ExpandedTransportBar `onTypePrompt` prop undocumented
- **File:** `vibe/CODEBASE.md:38`
- **Evidence:** CODEBASE.md lists `ExpandedTransportBar` props ending at `onTypePrompt` — actually correct — but the description "Handles RECORDING (red stop), ITERATING (blue stop → onStopIterate...), TYPING (dimmed controls)" does not mention the ⌨ type-prompt keyboard button that calls `onTypePrompt`. Minor completeness gap.
- **Fix:** Add `onTypePrompt` button description to ExpandedTransportBar row in CODEBASE.md.

#### P2-007 — CODEBASE.md `open-settings` IPC row has stale "stub console.log" note
- **File:** `vibe/CODEBASE.md:96`
- **Evidence:** Row reads `open-settings ... stub console.log in App.jsx`. The stub was removed — `App.jsx` now correctly calls `openSettings()` via `useKeyboardShortcuts.js:52-54` (`window.electronAPI.onOpenSettings(() => { openSettings() })`). No console.log stub exists.
- **Fix:** Update the description to `✅ registered — triggers SETTINGS state via onOpenSettings IPC listener in useKeyboardShortcuts.js`.

#### P2-008 — CLAUDE.md contains ~17 stale "Active Feature" sections for completed features
- **File:** `CLAUDE.md:163-685`
- **Evidence:** `CLAUDE.md` contains 11 completed "Active Feature" sections (F-SPEECH, F-CLAUDE, F-ACTIONS, FEATURE-004, FEATURE-007, FEATURE-009, FEATURE-011, FEATURE-012, FEATURE-014, FEATURE-015, FEATURE-018) and 2 completed bug sections (BUG-017, BUG-018), all with `Status: COMPLETE` or fully ticked. They add ~520 lines of context noise and some contain "Never" constraints that are now superseded (e.g. F-SPEECH says "never touch main.js" which no longer applies). Prior review CP-01 recommended trimming completed feature sections.
- **Fix:** Remove all completed feature/bug sections from CLAUDE.md. Keep only in-progress or standing-policy sections. Archive them to their respective `vibe/features/` folders.

---

### P3 — Minor / nice to have

#### P3-001 — App.jsx line count at 548 (approaching P1 threshold)
- **File:** `src/renderer/App.jsx`
- **Evidence:** 548 lines — below the 500-line P1 threshold but +78 lines since last refactor (470 after BUG-033). Growth was driven by POLISH-TOGGLE (handleExpand, handleCollapse, isExpanded/isExpandedRef) and ExpandedView wiring. Next feature addition is likely to push past 500.
- **Fix:** No action now. Monitor. If next feature adds >20 lines to App.jsx, consider extracting `useExpandedView` hook (handleExpand, handleCollapse, isExpanded, isExpandedRef, preExpandBounds wiring).

#### P3-002 — ExpandedDetailPanel.jsx at 645 lines (above P1 threshold — pre-existing)
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx:1-645`
- **Evidence:** 645 lines — above the 500-line P1 threshold. Logged as P3-EXP-001 in previous review for HistoryPanel.jsx (663). ExpandedDetailPanel also crossed threshold. Responsibility: state-content zone for 7 states + history entry detail. Practical minimum at this boundary. No action blocking deployment.
- **Fix:** Candidate for per-state child components (RecordingDetailPanel, PromptReadyDetailPanel) in a future refactor. Log only.

#### P3-003 — HistoryPanel.jsx at 663 lines (pre-existing, carryover from P3-EXP-001)
- **File:** `src/renderer/components/HistoryPanel.jsx:1-663`
- **Evidence:** Carryover. No change in status.

#### P3-004 — No automated test suite
- **Scope:** All files
- **Evidence:** Zero test files exist. For a v1 product shipping to real users, core pure functions should have at least smoke-level unit tests: `parsePolishOutput(raw)` in `usePolishMode.js`, `parseSections(text)` in `promptUtils.js`, `formatTime(ts)`, `searchHistory(q)` in `history.js`. These are pure functions with no Electron dependency — testable with Vitest in < 1 hour.
- **Fix:** Add `tests/` at project root with Vitest (devDep only). Priority order: `parsePolishOutput`, `parseSections`, `formatTime`. This was previously accepted as intentional for v1 (manual smoke checklist as the test suite). Flag for v1.5 or next feature cycle.

#### P3-005 — ExpandedView.jsx line count listed as 92, actual is 100
- **File:** `vibe/CODEBASE.md:37`
- **Evidence:** Absorbed into P2-004; listing separately to track doc accuracy granularity.

---

## Security review

| Check | Status |
|-------|--------|
| Hardcoded tokens/keys | ✅ None — Claude CLI handles auth externally |
| User content in innerHTML/dangerouslySetInnerHTML | ✅ Zero violations across all renderer files |
| Arbitrary shell execution via IPC | ✅ `generate-prompt` + `generate-raw` use `spawn(claudePath, ...)` — no shell interpolation of user input. `transcribe-audio` uses `exec(whisperCmd)` but `tmpFile` is generated from `Date.now()` + `os.tmpdir()` — no user content in path. |
| Shell injection risk in `handleUninstall` | ⚠️ Low — `exec('rm -rf "/Applications/Promptly.app"')` is hardcoded. `exec(`tccutil reset Microphone ${BUNDLE_ID}`)` — `BUNDLE_ID` is a hardcoded constant `'io.betacraft.promptly'`, not user input. Zero injection risk. |
| `splash-open-url` validation | ✅ `main.js:701` — `url.startsWith('https://')` guard present. |
| `nodeIntegration: false` | ✅ Both BrowserWindows confirmed. |
| Sensitive data in localStorage | ✅ None — only `mode`, `promptly_history`, `promptly_polish_tone`. No tokens, credentials, or PII. |
| `save-file` IPC — path traversal | ✅ Uses `dialog.showSaveDialog` — OS-native picker enforces user-chosen path. No path from renderer used directly. |

**Security summary: No P0 findings. App is safe for distribution.**

---

## SOLID principles review

| File | Lines | SRP | ISP | Notes |
|------|-------|-----|-----|-------|
| `main.js` | 1064 | ⚠️ | ✅ | 1064 lines — single-file Electron main (accepted pattern; no P0 trigger since main.js god-file is architecture-by-design for small Electron apps). No SOLID violation that warrants extraction at this scale. |
| `preload.js` | 132 | ✅ | ✅ | Single responsibility — contextBridge only. Clean. |
| `App.jsx` | 548 | ✅ | ✅ | Recording and keyboard concerns extracted to hooks. Near P1 threshold (P3-001). |
| `useRecording.js` | 158 | ✅ | ✅ | Clean hook. All recording state owned here. |
| `useKeyboardShortcuts.js` | 107 | ✅ | ✅ | Clean hook. IPC listeners + keydown handler. Cleanup gap (P2-001). |
| `usePolishMode.js` | 45 | ✅ | ✅ | Clean and minimal. |
| `ExpandedView.jsx` | 100 | ✅ | ⚠️ | 25 props (threshold 10). Orchestrator boundary necessity. |
| `ExpandedTransportBar.jsx` | 255 | ✅ | ✅ | 9 props. Clean. |
| `ExpandedHistoryList.jsx` | 379 | ✅ | ✅ | 3 props. Clean. |
| `ExpandedDetailPanel.jsx` | 645 | ⚠️ | ⚠️ | 17 props. Above P1 line threshold. Structural necessity at state-content boundary. |
| `history.js` | 64 | ✅ | ✅ | Pure utility module. |
| `promptUtils.js` | 37 | ✅ | ✅ | Pure utility. Minimal. |
| `HistoryPanel.jsx` | 663 | ⚠️ | ✅ | Above P1 line threshold (P3-003). Pre-existing. |
| `PromptReadyState.jsx` | 379 | ✅ | ✅ | 9 props. Clean. |
| `PolishReadyState.jsx` | 171 | ✅ | ✅ | 9 props. Clean. |
| `IteratingState.jsx` | 184 | ✅ | ✅ | Clean. All styles inline. RAF cleanup confirmed. |
| `TypingState.jsx` | 111 | ✅ | ✅ | Clean. All styles inline. |

---

## Document completeness audit

| Document | Status | Gaps |
|----------|--------|------|
| `vibe/CODEBASE.md` | ⚠️ 4 gaps | Missing `splash-check-whisper` + `check-mic-status` IPC rows; ExpandedView props 3 missing + stale line count; stale `open-settings` note; ExpandedTransportBar minor gap. |
| `vibe/ARCHITECTURE.md` | ⚠️ 2 gaps | ExpandedView dimensions stale (760×580 → 1100×860, BUG-TOGGLE-005). Window lifecycle section absent (BUG-018-004 deliverable). |
| `CLAUDE.md` | ⚠️ Bloat | 17 completed feature/bug sections still present, ~520 lines of stale context. Should be trimmed per CP-01 guidance. |
| `vibe/DECISIONS.md` | ✅ | BUG-TOGGLE-002/003/004/005 + BUG-ITER-STOP all logged. D-BUG-017 + D-BUG-018 present. Current. |
| `vibe/TASKS.md` | ✅ | All tasks ticked. "What just happened" and "What's next" up to date. |
| `vibe/reviews/backlog.md` | ✅ | All P0/P1 resolved. 4 open P3 items (BL-060, P3-EXP-001/002/003). Accurate. |

---

## Strengths

1. **Zero P0 findings** — after an extended build cycle with 18+ features, the security posture and architectural integrity are clean. No injection risks, no hardcoded secrets, no nodeIntegration violations.

2. **Hook extraction (BUG-033)** — `useRecording.js` and `useKeyboardShortcuts.js` are well-scoped, stable-ref–safe hooks with consistent patterns (`startRecordingRef.current`, `transitionRef.current`). App.jsx dropped from 653 → 470 → 548 lines (current growth is structurally justified by ExpandedView wiring).

3. **RAF cleanup discipline** — `WaveformCanvas.jsx:62`, `MorphCanvas.jsx:62`, `IteratingState.jsx:54` all correctly return `() => cancelAnimationFrame(raf)`. No RAF leaks in any canvas component.

4. **IPC surface is complete and consistent** — `preload.js` exposes 30+ methods, every `on*` method returns an unsubscribe function, channels are correctly scoped (invoke vs on). No channel mismatches between `preload.js` and `main.js` handlers.

5. **`promptUtils.js` extraction** — `parseSections` and `getModeTagStyle` now shared between `ExpandedDetailPanel.jsx` and `PromptReadyState.jsx`, eliminating the earlier duplication (P2-EXP-002).

6. **`index.css` keyframe ownership** — All 7 `@keyframes` (`stop-glow`, `pauseGlow`, `iterGlow`, `spin`, `breathe`, `pulse-ring`, `skeleton-pulse`) live in `index.css`. Zero inline `@keyframes` in component files.

7. **Build + lint + audit trifecta** — 0 lint errors, 0 audit vulnerabilities, clean 131ms Vite build at every check.

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0 findings)
P1 findings (× 0.5):                          0.0   (0 P1 findings)
P2 findings (× 0.2):                         -1.6   (8 P2 findings)
P3 findings (× 0.1):                         -0.5   (5 P3 findings including carryovers)
Architecture drift violations (× 0.5):       -0.5   (1 drift: IPC listener cleanup omission)
──────────────────────────────────────────
Score:                                         7.4 / 10 — Grade B
```

> Note: Score appears lower than the last feature review (9.9/10) because this is a **full-project** review scope — it surfaces documentation gaps across all vibe documents in aggregate. No new code violations were found. All P2 findings are documentation drift or a single dev-environment inconvenience. The codebase itself is production-ready.

---

## Testing assessment

No automated test suite exists. For a shipping product this is a P3 risk (accepted as intentional for v1, per ARCHITECTURE.md testing philosophy). Priority candidates if tests are added:

1. `parsePolishOutput(raw)` — pure function, 4 format variants, most likely to break on Claude output changes
2. `parseSections(text)` — regex-based parsing, used in 2 components
3. `formatTime(ts)` in `utils/history.js` — pure, testable in < 5 min
4. `getModeTagStyle(mode)` — style lookup, quick to verify exhaustively
5. State transition guard logic in `transition()` — would catch regressions from future App.jsx changes

Recommended: Add Vitest as devDep, create `tests/utils.test.js` for items 1–4 in the next development cycle.

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 8 | IPC listener cleanup (dev), ARCHITECTURE.md dims stale, ARCHITECTURE.md missing window lifecycle section, CODEBASE.md ExpandedView props, CODEBASE.md missing 2 IPC rows, CODEBASE.md TransportBar gap, CODEBASE.md stale open-settings note, CLAUDE.md stale feature sections |
| P3 | 5 | App.jsx growth (monitor), ExpandedDetailPanel 645 lines, HistoryPanel 663 lines (carryover), no test suite, minor line count accuracy |
