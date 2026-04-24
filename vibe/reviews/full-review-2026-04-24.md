# Full Codebase Review — Promptly
> Reviewed: 2026-04-24
> Scope: Full codebase — all Phase 4 features shipped since final-review (2026-04-18)
> FEATURE-004 React migration, FEATURE-006 through FEATURE-017, BUG-012 through BUG-019
> Reference documents: vibe/ARCHITECTURE.md, vibe/SPEC.md, vibe/CODEBASE.md

---

## Automated checks

### ESLint (`npm run lint`)
```
1 warning (main.js:4 — no-console on intentional console.error in uncaughtException handler)
0 errors
```
✅ No blocking lint errors.

### npm audit
```
@xmldom/xmldom <=0.8.12 — HIGH severity
  4 CVEs: DoS (uncontrolled recursion), XML injection (DocumentType, processing instruction, comment)
  Fix available: npm audit fix

eslint 9.10.0-9.26.0 — low severity (dev-only tool)
3 vulnerabilities total: 2 low, 1 high
```
⚠️ HIGH vulnerability in @xmldom/xmldom is carryover BL-031. Still unresolved.

---

## Carryover from previous reviews

| ID | Finding | Status |
|----|---------|--------|
| BL-031 | npm audit @xmldom/xmldom HIGH — DoS + XML injection | ❌ NOT RESOLVED — remains P1 |
| BL-033 | App.jsx SRP violation — 653 lines, too many concerns | ❌ NOT RESOLVED — remains P1 |
| BL-034 | ARCHITECTURE.md modes table missing polish/refine entries | ✅ RESOLVED — ARCHITECTURE.md updated |
| BL-035 | `copied` state not reset when transitioning away | ✅ RESOLVED — `setCopied(false)` in onReset |
| BL-036 | SPEC.md conformance checklist boxes not ticked | ✅ PARTIALLY — not reviewable without manual run |

---

## Architecture drift detection

### ✅ Patterns correctly followed
- `contextBridge` / preload IPC pattern: correct throughout — `nodeIntegration: false`, `contextIsolation: true` in both BrowserWindows
- `claudePath` / `whisperPath` always cached and used, never bare exec — compliant
- `dangerouslySetInnerHTML` / `innerHTML` with user content: absent — all user/Claude text via JSX text nodes
- localStorage accessed only via `useMode`, `useTone`, `utils/history.js` — no direct access anywhere
- PATH resolution follows documented 3-step pattern (static paths → nvm scan → shell fallback) — compliant
- Double mic permission layer (setPermissionCheckHandler + setPermissionRequestHandler) — both present at lines 641-647 of main.js
- `originalTranscript.current` set once in `stopRecording` — compliant (iteration exception documented per D-ITER-003)

### 🔴 ARCHITECTURE DRIFT — Window lifecycle / `window-all-closed` handler

**Decision:** "Keep app alive when window closed + hide Dock icon" — BUG-018, `menuBarTray` is the live Tray instance.

**Found:** `main.js:1037-1041`
```js
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !tray) {
    app.quit();
  }
});
```
`tray` is always `null` (the old Tray instance was replaced by `menuBarTray` in FEATURE-017). On macOS, `process.platform === 'darwin'` is always true, so the condition reduces to `false || !null` = `true`. If the main window is ever actually closed (not hidden), the app will quit instead of staying alive via `menuBarTray`. The guard should check `!menuBarTray`.

**Impact:** Single-instance Tray app quits when it shouldn't. BUG-018 fix intended to prevent this.

**Fix:** Change `!tray` to `!menuBarTray` at main.js:1040.

---

### 🟡 DOCUMENTATION DRIFT — IPC surface table (ARCHITECTURE.md)

**Decision:** IPC surface table in ARCHITECTURE.md is the canonical list of all channels.

**Missing from table (channels exist in code):**
- `show-tone-menu` — main.js:879, preload.js:28
- `tone-selected` — main.js:889, preload.js:29
- `check-mic-status` — main.js:713
- `open-settings` — main → renderer push, preload.js:99

**Present in table but removed from code (F-LANGUAGE removed per D-LANGUAGE-REMOVE):**
- `show-language-menu` — ARCHITECTURE.md:137, CODEBASE.md:77
- `language-selected` — ARCHITECTURE.md:138, CODEBASE.md:78
  Neither channel appears in main.js or preload.js.

**Fix:** Add 4 channels, remove 2 from both ARCHITECTURE.md and CODEBASE.md IPC tables.

---

### 🟡 DOCUMENTATION DRIFT — State machine section (ARCHITECTURE.md)

**Found:** ARCHITECTURE.md states: "States (9 total — 6 original + SHORTCUTS, HISTORY, PAUSED, ITERATING added via features)"

**Actual state count in App.jsx:19-31:** 11 states — IDLE, RECORDING, PAUSED, THINKING, PROMPT_READY, ERROR, SHORTCUTS, HISTORY, ITERATING, TYPING, SETTINGS.

TYPING (FEATURE-014) and SETTINGS (FEATURE-013) are not listed in the state machine diagram or documented in ARCHITECTURE.md.

**Fix:** Update ARCHITECTURE.md state machine section to 11 states and add TYPING/SETTINGS transitions.

---

### 🟡 DOCUMENTATION DRIFT — "Never list" contradicts React migration

**Found:** ARCHITECTURE.md Never list, item 7: "Introducing a framework, bundler, or build step (Vite, Webpack, React, etc.)"

React + Vite are now the renderer stack (mainlined from FEATURE-004). This rule creates confusion for future sessions.

**Fix:** Rephrase to: "Adding runtime npm dependencies (React, Vite, Tailwind are devDeps — renderer only — this constraint is about zero runtime deps in the packaged .app)."

---

### 🟡 DOCUMENTATION DRIFT — SettingsPanel and SETTINGS state undocumented

**Found:** `src/renderer/components/SettingsPanel.jsx` (128 lines) imported in App.jsx but missing from CODEBASE.md file map and ARCHITECTURE.md state machine.

SETTINGS state at App.jsx:30 and STATE_HEIGHTS.SETTINGS = 322 at App.jsx:44 — not in any architecture document.

**Fix:** Add SettingsPanel row to CODEBASE.md file map; add SETTINGS state to ARCHITECTURE.md state machine section.

---

### 🟡 DOCUMENTATION DRIFT — CODEBASE.md STATE_HEIGHTS.TYPING wrong

**Found:** CODEBASE.md state machine table says: "TYPING | TypingState | 220px" but App.jsx:43 has `TYPING: 244`.

**Fix:** Update CODEBASE.md TYPING height from 220 to 244.

---

## SOLID principles review

### SRP

**App.jsx — 653 lines (P1 carryover BL-033)**
File: `src/renderer/App.jsx`
Responsibilities: state machine, recording flow, iteration flow, typing flow, history open/close, settings open/close, IPC event wiring, keyboard shortcut handling, theme management, timer logic, pause/resume, menu bar state updates.

This was flagged as BL-033 and remains unaddressed. The natural extraction is:
- `useKeyboardShortcuts.js` — consolidates the keydown handler (lines 471-519) and IPC shortcut listeners (lines 438-468)
- `useRecording.js` — consolidates startRecording, stopRecording, pauseRecording, resumeRecording, handleDismiss, timer logic (lines 102-240)

All other components are under 400 lines — no SRP violations in components.

**main.js — 1049 lines (P2, below P1 threshold)**
Large but each section is well-separated (PATH resolution, icon drawing, IPC handlers, window lifecycle). Not recommended for extraction given zero-deps constraint.

### OCP / LSP / ISP / DIP
- No DIP violations — no localStorage access outside abstraction layers
- No direct DB imports in components (there is no DB)
- Props interfaces are reasonable — PromptReadyState has 8 props (within ISP threshold)
- `generatePrompt` / `generateRaw` / `transcribeAudio` correctly go through IPC — no direct child_process in renderer

---

## Security review

| Check | Status |
|-------|--------|
| `nodeIntegration: false` in all BrowserWindows | ✅ main.js:588, main.js:664 |
| `contextIsolation: true` in all BrowserWindows | ✅ main.js:589, main.js:665 |
| No user content via innerHTML/dangerouslySetInnerHTML | ✅ — all user text via JSX nodes or textContent |
| No hardcoded secrets or tokens | ✅ |
| `splash-open-url` validates https:// prefix before openExternal | ✅ main.js:705 |
| Audio tmp files cleaned up after transcription | ✅ main.js:942-944 |
| `handleUninstall` uses hardcoded BUNDLE_ID, not user input | ✅ no injection risk |
| @xmldom/xmldom HIGH vulnerability | ❌ **BL-031 — unresolved P1** |

---

## Code quality

### Duplication
`stopRecording` (App.jsx:150-207) and `handleTypingSubmit` (App.jsx:265-293) and `handleRegenerate` (App.jsx:295-321) all contain the same polish/non-polish branch pattern:
```js
if (mode === 'polish') {
  const parsed = parsePolishOutput(genResult.prompt)
  setPolishResult(parsed); setGeneratedPrompt(parsed.polished)
  saveToHistory({ ..., polishChanges: parsed.changes })
} else {
  setPolishResult(null); setGeneratedPrompt(genResult.prompt)
  saveToHistory({ ... })
}
transition(STATES.PROMPT_READY)
```
This 9-line block appears 3× with only the `transcript` argument varying. A `handleGenerateResult(genResult, transcript)` helper would eliminate the duplication. P2.

### No-console lint warning
`main.js:4` — `console.error` inside `uncaughtException` handler triggers `no-console` warning. This is intentional production logging. Add `// eslint-disable-next-line no-console` to silence it cleanly. P3.

### Unused parameter
`src/renderer/App.jsx:576` — `onDismiss={(target) => { transition(STATES.IDLE) }}` — `target` is never used. P3.

### `spawn` re-required inside handlers
`main.js:736`, `main.js:779` — `const { spawn } = require('child_process')` inside each IPC handler. `exec` is imported at module top (line 11) but `spawn` is not. Node.js caches `require` so there's no runtime cost, but the pattern is inconsistent. Add `spawn` to the top-level destructure. P3.

### TASKS.md duplicate entry
`vibe/TASKS.md:253-256` — BUG-017 entry appears twice (lines 253 and 255). P3.

---

## Testing review

Manual smoke tests documented and performed before commits — consistent with ARCHITECTURE.md testing philosophy. No automated test runner for v1 — intentional and documented (D-001 equivalent). No regression on this front.

---

## Strengths

- **Security posture is solid.** Both permission layers (setPermissionCheckHandler + setPermissionRequestHandler) are present. All IPC channels validate `window`/`win.isDestroyed()` before use. No unsafe HTML rendering anywhere in the codebase.
- **PATH resolution is production-hardened.** The 3-step resolver (static paths → nvm scan → NVM_DIR-initialized shell fallback) in both `resolveClaudePath()` and `resolveWhisperPath()` correctly handles the most common failure modes for packaged Electron apps.
- **React migration is clean.** The IPC surface is identical between vanilla and React builds. No IPC regressions. All STATES/STATE_HEIGHTS consistent with what old index.html documented. Hook abstractions (useMode, useTone, usePolishMode, useWindowResize) are well-scoped.
- **usePolishMode hook is well-extracted.** 45 lines, one concern, clear interface. BL-033 would be fully fixed if the same discipline were applied to App.jsx recording and keyboard logic.
- **menuBarTray cleanup is correct.** `win.on('hide')` → clears pulseInterval + sets hidden icon; `win.on('show')` → clears and resets. BUG-018 close intercept (isQuitting flag + before-quit) is correctly placed.

---

## Findings summary

### P1 — Fix before deploy

| ID | File | Line | Finding | Carryover? |
|----|------|------|---------|------------|
| P1-001 | main.js | 1040 | `window-all-closed` checks `tray` (always null) not `menuBarTray` — app quits on forced window close instead of staying alive in menu bar | New |
| P1-BL031 | package.json (dep chain) | — | @xmldom/xmldom HIGH severity — DoS + XML injection CVEs; `npm audit fix` resolves | Carryover |
| P1-BL033 | src/renderer/App.jsx | 1-653 | SRP violation — 653 lines with 8+ concerns; extract useKeyboardShortcuts + useRecording hooks | Carryover |

### P2 — Fix before deploy (lower priority)

| ID | File | Line | Finding |
|----|------|------|---------|
| P2-001 | src/renderer/App.jsx | 242-256 | `openHistory`/`closeHistory` bypass `transition()` — call `setCurrentState()` directly; `updateMenuBarState()` never fires for HISTORY transitions |
| P2-002 | src/renderer/App.jsx | 150-321 | 9-line polish/non-polish branch duplicated 3× in stopRecording, handleTypingSubmit, handleRegenerate — extract `handleGenerateResult()` helper |
| P2-003 | vibe/ARCHITECTURE.md | IPC table | Missing 4 channels: show-tone-menu, tone-selected, check-mic-status, open-settings; stale 2 channels: show-language-menu, language-selected (F-LANGUAGE removed) |
| P2-004 | vibe/ARCHITECTURE.md | State machine section | States count says "9 total" — actual is 11 (TYPING + SETTINGS missing); state transition diagram incomplete |
| P2-005 | vibe/ARCHITECTURE.md | Never list | "Introducing a framework, bundler, or build step (Vite, Webpack, React, etc.)" contradicts the now-mainlined React migration |
| P2-006 | vibe/ARCHITECTURE.md + vibe/CODEBASE.md | — | SettingsPanel.jsx (128 lines, PCFG-003) and SETTINGS state absent from both documents |
| P2-007 | vibe/CODEBASE.md | IPC table (rows 77-78) | show-language-menu / language-selected shown as ✅ registered but not present in main.js or preload.js (F-LANGUAGE removed) |
| P2-008 | vibe/CODEBASE.md | State machine table | STATE_HEIGHTS.TYPING listed as 220px; App.jsx:43 is 244 |

### P3 — Polish

| ID | File | Line | Finding |
|----|------|------|---------|
| P3-001 | main.js | 4 | Intentional `console.error` triggers no-console warning — add `// eslint-disable-next-line no-console` |
| P3-002 | main.js | 736, 779 | `const { spawn } = require('child_process')` inside IPC handlers — add `spawn` to top-level destructure at line 11 |
| P3-003 | src/renderer/App.jsx | 576 | `onDismiss={(target) => { ... }}` — `target` parameter unused; change to `onDismiss={() => ...}` |
| P3-004 | preload.js | 25-101 | `ipcRenderer.on()` listeners never return cleanup — App never unmounts so not a functional bug, but pattern violates future-safety; each `on*` method should return `() => ipcRenderer.removeListener(...)` |
| P3-005 | vibe/TASKS.md | 253-256 | BUG-017 entry duplicated twice |

---

## Quality score

```
Start:                 10.0
P1 × 3 (×-0.5):       -1.5
P2 × 8 (×-0.2):       -1.6
P3 × 5 (×-0.1):       -0.5
Architecture drift × 1 (×-0.5): -0.5  [openHistory/closeHistory bypass transition()]
─────────────────────────────────────
Score:                  5.9 / 10 — Grade D
```

**Note:** 6 of 8 P2 findings are documentation drift — the implementation code itself is clean. If scored on implementation quality alone the codebase would be approximately 7.5/C+. The documentation debt is the dominant drag.

---

## Gate decision

🔴 BLOCKED — 3 P1 issues, 1 of which is a new regression (P1-001 `window-all-closed`).

Fix P1-001 + BL-031 + BL-033 before next distribution. P2 docs can be addressed in a single cleanup commit.
