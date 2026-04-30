# FEATURE-EMAIL-MODE Review — Promptly
> Date: 2026-04-30 | Scope: FEATURE-EMAIL-MODE (EMAIL-001 through EMAIL-008)
> Previous gate: final-review-2026-04-29 — Score 8.9/10 (B+) — 0 P0, 1 P1 (open), 1 P2 (open)
> New since last review: FEATURE-EMAIL-MODE — email drafting mode (speak situation → Claude drafts email)

---

## Step 0A — Dependency graph pre-screening

Graph present at `vibe/graph/CONCEPT_GRAPH.json`. No agent-imports-agent violations found. Proceeding with full review.

---

## Step 0 — Automated checks

### ESLint (`npm run lint`)
```
> promptly@1.9.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### Vitest (`npm test`)
```
> promptly@1.9.0 test
> vitest run

 RUN  v4.1.5 /Users/aakash-anon/Documents/GitHub-personal/promptly

 Test Files  1 passed (1)
       Tests  23 passed (23)
    Duration  180ms
```
✅ All 23 tests pass. Count grew from 22 → 23 (email getModeTagStyle case added in EMAIL-008).

### npm audit
```
found 0 vulnerabilities
```
✅ Zero vulnerabilities.

---

## Carryover check

Previous review: final-review-2026-04-29.md — Score 8.9/10 — 0 P0, 1 P1, 1 P2, 4 P3.

| ID | Finding | Status |
|----|---------|--------|
| BL-FINAL-001 | App.jsx 721 lines (P1) — extract useOperationHandlers | ⚠️ STILL OPEN — now 756 lines (+35 from email). Escalated. |
| BL-FINAL-002 | splash.html missing CSP meta tag (P2) | ⚠️ Still open — no change |
| BL-FINAL-003 | CODEBASE.md OperationErrorPanel stale 105→128 (P3) | ⚠️ Still open |
| BL-FINAL-004 | ExpandedDetailPanel 495/500 lines (P3 monitor) | 🔴 ESCALATED TO P1 — now 531 lines, over threshold |
| P3-EXP-002 | ExpandedDetailPanel ISP 27 props (P3) | ⚠️ Still open — now 30 props with email additions |
| P3-WFL-DEL-001 | × delete button no hover state in WorkflowBuilderState (P3) | ⚠️ Still open |

---

## Architecture drift detection

Checked all ARCHITECTURE.md invariants against email-mode additions.

| Rule | Status | Evidence |
|------|--------|---------|
| State transitions via `transition()` only | ✅ | EMAIL_READY added to STATES; all transitions via `transition()` or `transitionRef.current()` |
| `localStorage` only via wrappers | ✅ | No direct localStorage in any email-mode files |
| No `dangerouslySetInnerHTML` with user/Claude content | ✅ | EmailReadyState uses JSX text nodes for all output |
| `contextBridge` / `nodeIntegration: false` | ✅ | No changes to preload.js or main.js security config |
| PATH resolution via cached `claudePath` | ✅ | email mode uses `standalone: true` in MODE_CONFIG — same spawn path as polish/design |
| One component per file | ✅ | EmailReadyState.jsx — single export |
| No runtime npm dependencies | ✅ | package.json unchanged |
| `originalTranscript` captured once | ✅ | email branch reads `originalTranscript.current` at generation time only |
| `shell.openExternal` URL validation | ✅ | No new openExternal calls |
| email mode always expanded (arch constraint) | ✅ | `isFullViewMode = isVideo || isWorkflow || isEmail` in ExpandedTransportBar — collapse disabled |
| Auto-expand on mode-selected | ✅ | App.jsx:140 useEffect([mode]) auto-expands when mode becomes 'email' |

**No P0-level architecture drift detected.**

---

## SOLID principles review

### Component size audit

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `App.jsx` | **756** | 🔴 P1 | Was 721 (BL-FINAL-001 open) — email added ~35 lines; now 256 over threshold |
| `ExpandedDetailPanel.jsx` | **531** | 🔴 P1 | Was 495 (P3 monitor) — email added ~36 lines; crossed 500-line threshold |
| `EmailReadyState.jsx` | 342 | ✅ | New file, within threshold. Well-contained. |
| `ExpandedTransportBar.jsx` | 380 | ✅ | Within threshold |
| `ExpandedView.jsx` | 118 | ✅ | Thin orchestrator unchanged |
| `IdleState.jsx` | 221 | ✅ | Within threshold |
| `main.js` | 1496 | ✅ (accepted) | Single Electron main — architectural necessity |

### ISP check

- `ExpandedDetailPanel.jsx`: now 30 props — grew from 27. `emailOutput`, `emailSaved`, `onEmailSave`, `onEmailIterate` added. Boundary-layer necessity; all consumed.

---

## Security review

| Check | Status |
|-------|--------|
| Hardcoded secrets/tokens | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Zero occurrences in new files |
| `localStorage` direct access | ✅ None outside wrappers |
| `nodeIntegration` | ✅ Both BrowserWindows: `nodeIntegration: false` — unchanged |
| npm audit | ✅ 0 vulnerabilities |
| `navigator.clipboard.writeText()` in EmailReadyState | ✅ Spec-prescribed; no user-provided URL or injection vector |
| JSON.parse of Claude output in App.jsx:318 | ✅ Wrapped in try/catch → GENERATION_ERROR on parse failure |
| `console.log` in production code | ✅ None in email-mode files |

---

## Testing review

| Check | Status |
|-------|--------|
| Test runner | ✅ Vitest v4.1.5 |
| All tests pass | ✅ 23/23 |
| email getModeTagStyle test added | ✅ tests/utils.test.js:92–95 |
| Test names describe behaviour | ✅ |
| React component tests | ⚠️ None — accepted per ARCHITECTURE.md v1 philosophy |

---

## Code quality analysis

**EmailReadyState.jsx (342 lines)** — solid implementation.
- Props interface clean — 7 props, all consumed.
- Inline edit mode with `contentEditable` + `bodyRef` is correct pattern (matches ExpandedPromptReadyContent).
- `copiedSubject` / `copiedEmail` independent states for two copy buttons — correct.
- `suppressContentEditableWarning` correctly present.

**main.js email MODE_CONFIG** — system prompt is pragmatically improved vs spec:
- Added newline escape rule (rule 9: "body field must use actual newline characters") — prevents `\n` rendering as literal strings.
- Slightly different wording; functionally equivalent to spec intent.

**Dead code found:**
- `EmailReadyState.jsx:3` — `const TEAL = 'rgba(20,184,166)'` — malformed (`rgba` requires 4 values) and never used. Dead constant.
- `ExpandedDetailPanel.jsx:521` — `onCopy={() => {}}` passed to `<EmailReadyState>` — EmailReadyState doesn't consume an `onCopy` prop; copy logic is internal. Dead prop.

---

## Findings

### P0 — Critical

**None.**

---

### P1 — Fix before deploy

#### P1-001 (escalation) — App.jsx SRP violation: 756 lines
- **File:** `src/renderer/App.jsx`
- **Evidence:** `wc -l src/renderer/App.jsx` → 756. Email feature added ~35 lines to the 721-line file from BL-FINAL-001 (open since 2026-04-29). Now 256 lines over P1 threshold (500).
- **Fix:** Extract `useOperationHandlers` hook as spec'd in BL-FINAL-001: `handleRetryTranscription`, `handleRetryGeneration`, `abortRef`, `handleAbort`, `transcriptionError`, `generationError`, `transcriptionSlow`, `generationSlow` state + slow-warning IPC listeners → `src/renderer/hooks/useOperationHandlers.js`. Expected reduction: ~60–70 lines.
- **Severity:** P1 — carryover escalation; no further features may land in App.jsx until this is resolved.

#### P1-002 (escalation) — ExpandedDetailPanel.jsx SRP violation: 531 lines
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx`
- **Evidence:** `wc -l` → 531. Was 495 (P3 "monitor" in BL-FINAL-004). Email-007 added the email standby panel + EMAIL_READY routing (~36 lines) pushing it over the 500-line threshold.
- **Fix:** Extract the error + email routing block (lines ~432–530) into `ExpandedErrorEmailContent.jsx`. This block handles TRANSCRIPTION_ERROR, GENERATION_ERROR, EMAIL_READY, and the email RECORDING standby — all cohesive "expanded content state" concerns. Expected reduction: ~80–90 lines → ExpandedDetailPanel ≈ 440 lines.
- **Severity:** P1 — crossed SRP threshold this feature. Fix before next feature touches this file.

#### P1-003 — THINKING state shows blue throughout email generation; teal accent never displayed
- **File:** `src/renderer/App.jsx` — `handleGenerateResult` email branch, lines 313–327
- **Evidence:** In `handleGenerateResult` (called when Claude returns a result), the email branch calls:
  ```js
  setThinkingAccentColor('rgba(20,184,166,0.85)')  // line 315
  setThinkingLabel('Drafting your email...')         // line 316
  // ... JSON.parse ...
  transitionRef.current(STATES.EMAIL_READY)          // line 322
  ```
  The `transition()` function at App.jsx:147 clears both when `newState !== THINKING`:
  ```js
  if (newState !== STATES.THINKING) { setThinkingLabel(''); setThinkingAccentColor(''); ... }
  ```
  So the teal accent is set and immediately cleared in the same event loop tick. The user sees blue for the entire email generation period (~5–30 seconds). Neither the teal morph wave nor the "Drafting your email..." label ever renders.
- **Root cause:** Unlike video/workflow modes (which use a two-phase flow where the second phase re-enters THINKING), email mode is single-phase. The accent must be set BEFORE the THINKING transition, not after the result arrives.
- **Fix:** In `useRecording.js` (around line 67), before `transitionRef.current(STATES.THINKING)`, check mode and set the accent:
  ```js
  const mode = modeRef.current
  if (mode === 'email') {
    setThinkingAccentColor?.('rgba(20,184,166,0.85)')
    setThinkingLabel?.('Drafting your email...')
  }
  transitionRef.current(STATES.THINKING)
  ```
  This requires passing `setThinkingAccentColor` and `setThinkingLabel` as params to `useRecording`. Remove the redundant calls from the email branch in `handleGenerateResult`.
- **Acceptance criteria violated:** "Thinking: teal spinner + 'Drafting your email...' in top bar" and "Thinking: teal morph wave (not default blue)" — both failing.
- **Severity:** P1 — core email mode UX identity broken; user sees default blue thinking with wrong label.

---

### P2 — Fix before next distribution

#### P2-001 — Auto-expand on ⌥ Space shortcut missing for email mode
- **File:** `src/renderer/hooks/useKeyboardShortcuts.js` — lines 25–29
- **Evidence:** The `onShortcutTriggered` handler:
  ```js
  window.electronAPI.onShortcutTriggered(() => {
    if (stateRef.current === STATES.IDLE) startRecordingRef.current()
    ...
  })
  ```
  Has no check for `modeRef.current === 'email'` + `!isExpandedRef.current` before calling `startRecordingRef`. The spec (FEATURE_SPEC.md#auto-expand-on-shortcut-trigger) requires this guard. The mode-selected auto-expand (App.jsx:140 useEffect) handles switching modes, but not the shortcut-triggered path.
- **Fix:** Pass `handleExpand` and `isExpandedRef` to `useKeyboardShortcuts`. In the `onShortcutTriggered` callback, add:
  ```js
  if (modeRef.current === 'email' && !isExpandedRef.current) {
    handleExpand()
    return
  }
  ```
- **Conformance item violated:** "⌥ Space in email mode auto-expands if minimized"
- **Severity:** P2 — edge case (mode-selected path works; window is typically already expanded); but spec requires it and conformance item is marked failing.

#### P2-002 — IdleState.jsx missing teal visual identity for email mode
- **File:** `src/renderer/components/IdleState.jsx` — lines 13–15, 68–69, 119, 193–195
- **Evidence:** Email mode has no arm in:
  - `ringColor` (line 13): falls through to blue `'rgba(10,132,255,'`
  - `micStroke` (line 14): falls through to `'rgba(100,180,255,1)'`
  - `micStrokeFaded` (line 15): falls through to `'rgba(100,180,255,0.85)'`
  - Ring glow `boxShadow` (line 68–69): no email arm, uses blue glow
  - Subtitle (line 119): no email case, shows `'⌥ Space to speak · ⌘T to type'`
  - Mode pill `background/border/color` (lines 193–195): no email arm, blue defaults
- **Fix:** Add `isEmail = mode === 'email'` (line 6). Extend all ternary chains:
  - `ringColor`: add `isEmail ? 'rgba(20,184,166,' :`
  - `micStroke` / `micStrokeFaded`: add email arm with `'rgba(45,212,191,0.8)'`
  - `boxShadow`: add email arm with `'0 0 12px rgba(20,184,166,0.2)'`
  - Subtitle: add `isEmail ? 'Describe your email situation naturally' :`
  - Mode pill background/border/color: add email teal arms
- **Conformance items violated:** "Idle bar shows teal dot + 'Describe your email situation naturally'" and "Idle bar: teal pulse ring + teal mode pill text + correct subtitle"
- **Severity:** P2 — impact limited by auto-expand (user rarely sees idle bar in email mode), but spec requires teal identity and conformance items are failing.

#### P2-003 — handleEmailSave doesn't call bookmarkHistoryItem
- **File:** `src/renderer/App.jsx` — lines 361–363
- **Evidence:**
  ```js
  function handleEmailSave() {
    setEmailSaved(true)
  }
  ```
  The `Save` button shows "Saved ✓" visually but does not call `bookmarkHistoryItem()`. `saveToHistory` (utils/history.js:4) returns `undefined` — no ID is captured at save time. The spec (EMAIL-004) says "handleEmailSave that calls `bookmarkHistoryItem(lastSavedEmailId)`". The bookmark is never written to localStorage.
- **Fix:** Capture the history entry ID when saving. `saveToHistory` uses `Date.now()` as ID — store it: 
  ```js
  const emailHistoryId = useRef(null)
  // In email branch of handleGenerateResult, after saveToHistory:
  emailHistoryId.current = Date.now()  // must be called before saveToHistory so ID matches
  ```
  Or modify `saveToHistory` to return the generated ID. Then `handleEmailSave` calls `bookmarkHistoryItem(emailHistoryId.current)`.
- **Conformance item violated:** "Save button: bookmarks the history entry; label changes to 'Saved ✓'"
- **Severity:** P2 — Save appears to work (UI updates) but bookmark is never persisted. Silent data loss.

#### P2-004 — Escape key not handled in EmailReadyState edit mode
- **File:** `src/renderer/components/EmailReadyState.jsx` — `handleEditToggle` function (lines 40–63)
- **Evidence:** Edit mode (`isEditing = true`) makes the body `contentEditable`. There is no `onKeyDown` handler on the editable div to catch Escape and cancel. The spec (FEATURE_SPEC.md#action-row) says: "Escape key: cancels edit, restores previous body text."
- **Fix:** Add state to store pre-edit body: `const [preEditBody, setPreEditBody] = useState('')`. In `handleEditToggle` when entering edit: `setPreEditBody(editedBody)`. Add `onKeyDown` to the contentEditable div:
  ```jsx
  onKeyDown={e => {
    if (e.key === 'Escape') { setEditedBody(preEditBody); setIsEditing(false) }
  }}
  ```
- **Conformance item violated:** "Edit button: body becomes contenteditable; Done saves edit; Escape cancels"
- **Severity:** P2 — standard edit UX expectation; matches ExpandedPromptReadyContent's escape handling pattern.

---

### P3 — Minor / monitor

#### P3-001 — Dead TEAL constant in EmailReadyState.jsx
- **File:** `src/renderer/components/EmailReadyState.jsx` — line 3
- **Evidence:** `const TEAL = 'rgba(20,184,166)'` — malformed (rgba requires 4 values) and never used. `TEAL_FULL`, `TEAL_85`, `TEAL_60`, `TEAL_12`, `TEAL_06` are used throughout; `TEAL` is not.
- **Fix:** Delete line 3.
- **Severity:** P3 — dead code only, no functional impact.

#### P3-002 — Dead `onCopy` prop passed to EmailReadyState
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx` — line 521
- **Evidence:** `onCopy={() => {}}` is passed to `<EmailReadyState>` but `EmailReadyState` does not declare or consume an `onCopy` prop (clipboard logic is handled internally via `handleCopyEmail`). The prop is silently ignored.
- **Fix:** Remove `onCopy={() => {}}` from the JSX call site.
- **Severity:** P3 — dead code, no functional impact.

#### P3-003 (carryover) — Conformance checklist items not ticked in FEATURE_TASKS.md
- **File:** `vibe/features/2026-04-30-email-mode/FEATURE_TASKS.md` — lines 302–336
- **Evidence:** All 32 conformance checklist items remain `- [ ]` (unchecked). The per-task sequence requires ticking conformance items before shipping. Several items are not fully met (P1-003, P2-001, P2-002, P2-003, P2-004 above).
- **Fix:** After fixing P1-003 and P2 issues above, go through the checklist and tick verified items. Leave failing items unchecked until resolved.
- **Severity:** P3 — process finding; the unchecked items correctly reflect the open issues above.

---

## Strengths

1. **EmailReadyState.jsx is clean and self-contained (342 lines)** — two-column layout, independent copy states, correct `pre-wrap` for body line breaks, `suppressContentEditableWarning` present. Follows established patterns from ExpandedPromptReadyContent.

2. **JSON parse error handling is correct** — `try { JSON.parse(...) } catch { transition(GENERATION_ERROR) }` at App.jsx:318 correctly falls back to the error state instead of crashing.

3. **Always-expanded enforcement is solid** — Three independent guards in place: (1) useEffect([mode]) in App.jsx auto-expands on mode switch, (2) `isFullViewMode = isVideo || isWorkflow || isEmail` disables collapse button in ExpandedTransportBar, (3) handleGenerateResult email branch has `if (!isExpandedRef.current) handleExpand()` as a belt-and-suspenders guard.

4. **Teal identity correct in expanded transport bar** — `pillBg/pillBorder/pillColor` all have email arms with correct teal values; dot color for `email-ready` state (`rgba(20,184,166,0.85)`) is correctly wired.

5. **Test suite extended correctly** — `getModeTagStyle('email')` test case added in EMAIL-008 with correct teal background/color values; all 23 tests pass.

6. **System prompt is pragmatically better than spec** — Added newline escape rule prevents `\n` rendering as literal backslash-n in JSON; cleaner instruction phrasing.

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0)
P1 findings (× 1.0):                         -3.0   (P1-001: App.jsx 756 lines; P1-002: ExpandedDetailPanel 531 lines; P1-003: THINKING teal never shown)
P2 findings (× 0.2):                         -0.8   (P2-001: shortcut auto-expand; P2-002: IdleState teal; P2-003: Save doesn't bookmark; P2-004: Escape key)
P3 findings (× 0.1):                         -0.3   (P3-001: dead TEAL const; P3-002: dead onCopy prop; P3-003: checklist unchecked)
Architecture drift violations (× 0.5):        0.0
─────────────────────────────────────────────
Score:                                         5.9 / 10 — Grade F

Note: 2 of 3 P1s are pre-existing escalations (App.jsx SRP was already P1; ExpandedDetailPanel was P3 "monitor").
      The email feature introduced 1 new P1 (THINKING teal), 4 P2s, and 2 P3s.
      Addressing P1-003 + all P2s would bring the effective new-code score to ~8.5.
```

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 3 | App.jsx 756 lines (escalation); ExpandedDetailPanel.jsx 531 lines (escalation); THINKING accent never teal |
| P2 | 4 | Shortcut auto-expand missing; IdleState teal identity missing; Save doesn't bookmark; Escape key not handled |
| P3 | 3 | Dead TEAL constant; dead onCopy prop; conformance checklist unchecked |
