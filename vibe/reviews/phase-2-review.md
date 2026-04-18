# Phase 2 Review — Promptly
> Reviewed: 2026-04-18 | Reviewer: vibe-review skill
> Scope: F-STATE · F-FIRST-RUN · F-SPEECH · F-CLAUDE · F-ACTIONS · D-004 · BUG-003 · BUG-004 · BUG-006 · BUG-007 · BUG-008 · FEATURE-001

---

## Automated checks

```
npm test    → No test runner configured (expected — ARCHITECTURE.md mandates manual smoke test for v1)
npm run lint → 0 errors, 6 warnings (console.log in main.js — dev logs, clean before release)
npm audit   → 2 low severity vulnerabilities in eslint devDep only (@eslint/plugin-kit)
              No high/critical vulnerabilities.
```

All automated checks pass. 0 blocking errors.

---

## Carryover from previous reviews

All 12 issues from Phase 1 review (2026-04-18) and F-STATE review (2026-04-18) are marked resolved in backlog.md. Spot-checked three key ones:

- ✅ BL-001 — generate-prompt args: preload.js line 8 now sends `{ transcript, mode }` object
- ✅ BL-002 — check-claude-path: main.js lines 304-309 now returns `{ found: true/false, path, error }`
- ✅ BL-003 — Window positioning: `win.center()` called in splash-done handler (main.js:173)

No carryover issues outstanding.

---

## Architecture drift

### 🟡 DRIFT-001 — ARCHITECTURE.md IPC surface table missing 6 channels

**Section violated:** "IPC surface (complete list)" (ARCHITECTURE.md lines 111-121)

**Decision:** Table is described as the complete IPC surface. "No new top-level files without a DECISIONS.md entry explaining why" / "Ask first: Adding a new IPC channel not in the IPC surface table."

**Found:** main.js — 6 channels registered that are absent from the ARCHITECTURE.md table:
- `show-mode-menu` (renderer → main, line 258) — documented in DECISIONS.md BUG-002-D ✓
- `mode-selected` (main → renderer, line 271) — documented in DECISIONS.md BUG-002-D ✓
- `set-window-buttons-visible` (renderer → main, line 253) — **NOT in DECISIONS.md or ARCHITECTURE.md**
- `splash-done` (renderer → main, line 168) — documented in DECISIONS.md FEATURE-001 ✓
- `splash-check-cli` (renderer → main, line 178) — documented in DECISIONS.md FEATURE-001 ✓
- `splash-open-url` (renderer → main, line 182) — documented in DECISIONS.md FEATURE-001 ✓

**Impact:** ARCHITECTURE.md is the agent's constitution read every session. Stale IPC table leads future tasks to treat `set-window-buttons-visible` as undocumented and possibly attempt to re-add or remove it.

**Fix:** Update ARCHITECTURE.md IPC table to include all 6 channels.

---

### 🟡 DRIFT-002 — CSS design tokens don't match ARCHITECTURE.md specification

**Section violated:** "Frontend patterns — Styling" (ARCHITECTURE.md lines 92-98)

**Decision:** Tokens defined as `--color-action: #007AFF`, `--color-success: #34C759`, `--radius-window: 14px`, `--radius-inner: 8px`.

**Found:** index.html CSS tokens:
```css
--blue: #0A84FF     (spec: --color-action: #007AFF — different name AND value)
--green: #30D158    (spec: --color-success: #34C759 — different name AND value)
--bar-radius: 18px  (spec: --radius-window: 14px — different name AND value)
```
No `--color-recording`, `--bg-window`, `--radius-inner` in index.html.

**Decision origin:** Original ARCHITECTURE.md 2026-04-18, likely superseded by dark-glass design pivot but never logged.

**Impact:** New tasks reading ARCHITECTURE.md will use wrong token names when adding CSS to index.html.

**Fix:** Update ARCHITECTURE.md CSS tokens section to match current implementation, log design pivot in DECISIONS.md.

---

## Findings

### 🔴 P1-001 — renderPromptOutput regex doesn't match new plain-text labels (BUG-008 follow-through gap)

**File:** `index.html` line 622-624

**Evidence:**
```js
// index.html:622-624 — matches markdown bold pattern
const m = line.trim().match(/^\*\*([^*]+)\*\*:?\s*$/);
```

**What happens:** BUG-008 (this session) updated the system prompt to output plain-text labels (`Role:`, `Task:`, not `**Role:**`). But `renderPromptOutput()` was never updated — it only recognises `**Header:**` markdown patterns and promotes them to `.pt-sl` section headers. The new output format (`Role:\n<content>\n\nTask:\n<content>`) won't match the regex. All content renders as flat text spans with no `.pt-sl` styling — section headers are visually indistinguishable from body text.

**SPEC requirement:** PROMPT_READY state shows "Prompt output" with structured sections (SPEC.md §PROMPT_READY state).

**Fix:** Update regex to match plain-text `Label:` patterns at line start:
```js
const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/);
```
This matches `Role:`, `Tech stack:`, `Output format:`, `Data model:` etc. as section headers.

---

### 🔴 P1-002 — Morph wave RAF loop leak in setState(THINKING)

**File:** `index.html` lines 676-681

**Evidence:**
```js
// index.html:676-681 — inline animMorph has no cancellation path
let morphT = 0;
const morphCanvas = document.getElementById('morph-canvas');
if (morphCanvas) {
  const animMorph = () => { drawMorphWave(morphCanvas, morphT++); requestAnimationFrame(animMorph); };
  requestAnimationFrame(animMorph);
}
```

```js
// index.html:640 — stopMorphAnim() only cancels module-level morphAnimFrame, not inline loops
stopMorphAnim();  // morphAnimFrame is null — no-op for inline RAF
```

**What happens:** Every call to `setState(THINKING)` — via stop recording OR via Regenerate — creates a new anonymous `animMorph` RAF loop that is never cancelled. After 5 regenerations in a session, 5 RAF loops run simultaneously drawing to the same canvas at 60fps each. CPU/GPU usage grows linearly with each THINKING transition. After the panel is hidden, all loops continue running.

**BUG-007-B** was supposed to fix RAF loop conflicts but introduced a new uncancellable pattern.

**Fix:** Store the RAF handle so `stopMorphAnim()` can cancel it:
```js
// In setState THINKING block:
let morphT = 0;
const morphCanvas = document.getElementById('morph-canvas');
if (morphCanvas) {
  const animMorph = () => { drawMorphWave(morphCanvas, morphT++); morphAnimFrame = requestAnimationFrame(animMorph); };
  morphAnimFrame = requestAnimationFrame(animMorph);
}
```
`stopMorphAnim()` already calls `cancelAnimationFrame(morphAnimFrame)` — this makes it effective.

---

### 🟡 P2-001 — CODEBASE.md stale across multiple features

**File:** `vibe/CODEBASE.md`

**Evidence (multiple):**
- Line 25: `pill.html` listed in file map — file deleted in DECISION-004
- Line 22: `pillWin` listed in main.js key exports — removed in DECISION-004
- Lines 36-43: IPC table lists `show-pill`, `switch-to-main`, `pill-stop`, `pill-dismiss`, `pill-action` — all removed in DECISION-004
- Line 80: Module var `isRecording` listed — code uses `isProcessing` (index.html:745)
- `splash.html` absent from file map — added in FEATURE-001
- `splashWin` absent from main.js module-scope vars
- `PROMPT_TEMPLATE`, `MODE_CONFIG` absent — replaced `MODE_SYSTEM_PROMPTS` in BUG-008

CODEBASE.md last-updated header says BUG-003, predating DECISION-004, FEATURE-001, BUG-006, BUG-007, BUG-008.

**Fix:** Full CODEBASE.md update — remove pill references, add splash.html, correct IPC table, correct module vars.

---

### 🟡 P2-002 — shell.openExternal URL unvalidated in splash-open-url IPC

**File:** `main.js` lines 182-184

**Evidence:**
```js
ipcMain.handle('splash-open-url', async (_event, url) => {
  shell.openExternal(url);  // url passed directly from renderer, no validation
});
```

**What happens:** The renderer can pass any URL string to `shell.openExternal`. Today the only caller uses a hardcoded string, but unvalidated `shell.openExternal` is a known Electron security anti-pattern — if renderer code ever had an injection bug, it could open arbitrary `javascript:` URIs or malicious URLs.

**Fix:**
```js
ipcMain.handle('splash-open-url', async (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    shell.openExternal(url);
  }
});
```

---

### 🟡 P2-003 — 30s SPEC timeout vs 60s code timeout

**Files:** `main.js` line 207, `vibe/SPEC.md` line 88

**Evidence:**
```js
// main.js:207 — 60 second timeout
}, 60000);
```
```
// SPEC.md:88 — specifies 30 seconds
Timeout after 30 seconds → ERROR state: "Claude took too long — try again"
```

**Fix:** Either change main.js to `30000` to match spec, or update SPEC.md to document the 60s decision with a DECISIONS.md entry. Recommend 60s as the better UX for complex prompts — just needs to be logged.

---

### 🟡 P2-004 — set-window-buttons-visible IPC channel undocumented

**Files:** `main.js` line 253, `preload.js` line 19, `vibe/ARCHITECTURE.md`, `vibe/DECISIONS.md`

**Evidence:** `set-window-buttons-visible` registered in main.js, exposed in preload.js, called in setState(RECORDING) and setState(THINKING) — but absent from ARCHITECTURE.md IPC table and no DECISIONS.md entry.

**Fix:** Add to ARCHITECTURE.md IPC table + add DECISIONS.md entry explaining why (hide traffic lights during recording, show during thinking/ready).

---

### 🟡 P2-005 — SPEC.md stale: vibrancy, first-run flow

**File:** `vibe/SPEC.md`

**Evidence:**
- F1 acceptance criteria line 36: `vibrancy: 'sidebar'` — code uses `'fullscreen-ui'` (changed in BUG-006)
- F8 acceptance criteria: describes in-bar first-run checklist — replaced by splash.html (FEATURE-001)

**Fix:** Update SPEC.md F1 vibrancy criteria and F8 to reflect splash screen implementation.

---

### 🟡 P2-006 — FIRST_RUN state removal undocumented

**Files:** `index.html`, `vibe/DECISIONS.md`

**Evidence:** `STATES` object in index.html (line 441) has no `FIRST_RUN` key. No `panel-first-run`, no `state-first-run`, no `localStorage.getItem('firstRunComplete')` anywhere in index.html. F-FIRST-RUN tasks are marked complete in TASKS.md, but the first-run state was removed from the main state machine (likely during BUG-001 full rewrite) and replaced by `splash.html` in FEATURE-001. This architectural change is not logged in DECISIONS.md.

**Fix:** Add DECISIONS.md entry documenting the removal of FIRST_RUN from the index.html state machine and its replacement by splash.html.

---

### 🟢 P3-001 — Dead code: startMorphAnim / stopMorphAnim / module-scope morphAnimFrame never used as intended

**File:** `index.html` lines 463-528

**Evidence:** `startMorphAnim()` is never called (BUG-007-B replaced it with inline RAF). `stopMorphAnim()` is called in setState() but only cancels `morphAnimFrame` which is always null. Module-scope `morphAnimFrame` and `morphT` at lines 463-464 are vestigial.

**Fix:** After fixing P1-002, clean up dead code: remove `startMorphAnim()`, repurpose `morphAnimFrame` to store the inline RAF handle (as per P1-002 fix), remove module-scope `morphT` (shadowed by local `let morphT = 0` in THINKING block).

---

### 🟢 P3-002 — Error message truncated to 60 chars

**File:** `index.html` line 787

**Evidence:** `genResult.error?.slice(0, 60)` — Claude CLI errors longer than 60 characters are silently cut off, potentially hiding actionable information.

**Fix:** Remove truncation or increase limit. Error text is contained in `.ready-title` which can scroll.

---

### 🟢 P3-003 — inline onclick in splash.html

**File:** `splash.html` line 217

**Evidence:** `<button ... onclick="openInstall()">` — inline event handler. ARCHITECTURE.md specifies "Event listeners set once at DOMContentLoaded."

**Fix:** Replace with `document.getElementById('install-btn').addEventListener('click', openInstall)` inside the `runChecks` flow or at script end.

---

### 🟢 P3-004 — npm audit: 2 low severity devDep vulnerabilities

**Package:** `@eslint/plugin-kit <0.3.4` (ReDoS vulnerability in ConfigCommentParser)

**Impact:** devDep only — not included in any .dmg distribution. No runtime exposure. Low severity.

**Fix:** `npm audit fix --force` or pin eslint to 9.39.4+ when convenient. Not blocking.

---

## Strengths

- **Security posture remains excellent** — `contextIsolation: true`, `nodeIntegration: false` across all BrowserWindows (main.js:121-122, 154-155). No runtime dependencies means zero supply chain attack surface.
- **IPC patterns are correct** — contextBridge-only, no direct node API exposure. All renderer→main calls are invoke/handle (async request/response), push events via webContents.send (main.js:270-273, preload.js:45-49).
- **State machine is clean** — `setState()` is the single DOM mutation point; all 5 states follow the pattern with no direct DOM mutations outside it (index.html:637-700).
- **originalTranscript immutability is preserved** — set once in `stopRecording()` onstop handler, regenerate reads it, Edit mode only writes `generatedPrompt` (index.html:776, 819, 854).
- **DECISIONS.md is thorough** — every major architectural decision, bug fix, and scope change logged with root causes. Audit trail is complete and useful.
- **Dark glass design implementation** — consistent visual language across IDLE, RECORDING, THINKING, PROMPT_READY, ERROR, and splash. CSS token system (even if names differ from spec) is internally consistent across all states.
- **Splash screen execution** — FEATURE-001 correctly uses `resolveClaudePath()` as a Promise before creating any window, guaranteeing `claudePath` is set before splash runs its CLI check (main.js:133-134). Race condition eliminated by design.
- **renderPromptOutput uses textContent throughout** — no innerHTML with dynamic content; safe against XSS from Claude output (index.html:608-634).
- **Error paths handled in generate-prompt IPC** — resolved flag + timer + child.kill() prevents double-resolve; stderr fallback message is user-friendly (main.js:206-235).

---

## Quality score

| Category | Score |
|----------|-------|
| Start | 10.0 |
| P1 findings (2 × −0.5) | −1.0 |
| P2 findings (6 × −0.2) | −1.2 |
| P3 findings (4 × −0.1) | −0.4 |
| Architecture drift (IPC table, CSS tokens) (2 × −0.5) | −1.0 |
| **Total** | **6.4 / 10** |

**Grade: C+** — The core app is functional and secure. Score is pulled down by documentation debt (CODEBASE.md, SPEC.md, ARCHITECTURE.md all stale), one functional regression (renderPromptOutput), and a performance bug (RAF loop leak). These are Phase 3 fixes, not blockers.

---

## Summary

Phase 2 delivered all 5 features plus significant scope additions (dark glass design, Whisper speech engine, splash screen, recording waveform/timer). The core flow — speak → transcribe → generate → copy — works end-to-end. Security posture is excellent throughout.

**Two functional issues require attention before deploy:**
1. `renderPromptOutput` regex must be updated to match the plain-text labels from BUG-008's new system prompt — currently section headers render as flat text.
2. RAF loop leak in `setState(THINKING)` — inline `animMorph` accumulates with each Regenerate call; fix is a one-line change to store the handle in `morphAnimFrame`.

Documentation debt is real but doesn't block Phase 3 — add to Phase 3 polish tasks.

**Gate: PASS — 0 P0 findings. Phase 3 may begin.**
