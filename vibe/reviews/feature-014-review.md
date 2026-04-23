# FEATURE-014 Review — Text Input (Type Prompt)
> Date: 2026-04-23 | Reviewer: vibe-review skill
> Commits reviewed: 724c5d8 (code) · 5cee544 (docs)
> Files reviewed: src/renderer/App.jsx · src/renderer/components/TypingState.jsx ·
>                 src/renderer/components/IdleState.jsx · src/renderer/components/ShortcutsPanel.jsx

---

## Step 0 — Automated checks

### Lint
```
npm run lint → 0 errors, 1 pre-existing warning
  main.js: no-unused-vars 'shell' (pre-existing, unrelated to this feature)
```

### TypeScript
Not applicable — project is vanilla JS + JSX.

### npm audit
```
1 high: @xmldom/xmldom GHSA-crh6-fp67-6883 (ReDoS)
  Path: electron-builder > @xmldom/xmldom (devDep chain only)
  NOT present in packaged .dmg — zero runtime risk
2 low: in eslint devDep chain (@eslint/plugin-kit)
```

---

## Step 1 — Concept boundary pre-screening

No DEPENDENCY_GRAPH.json found for TypingState.jsx (new file, not yet indexed).
Full standard review performed on all modified files.

---

## Step 2 — Carryover check

Previous feature reviews checked. No carryover items apply to this feature.

BL-024 (2 low audit vulns, eslint devDep) and BL-027 (hardcoded hex CSS) remain open — unrelated to this feature, no change in status.

---

## Step 3 — Architecture drift detection

### ARCHITECTURE.md compliance

**State machine pattern — ✅ compliant**
- `TYPING` added to STATES object correctly
- `STATE_HEIGHTS.TYPING = 220` follows exact pattern
- `transition(STATES.TYPING)` used correctly, never direct DOM mutation

**Component pattern — ✅ compliant**
- TypingState.jsx is a single-responsibility functional component
- All styles are inline (matches IteratingState.jsx, PausedState.jsx pattern)
- No dangerouslySetInnerHTML anywhere
- Controlled textarea with `value` + `onChange` — correct React pattern

**IPC pattern — ✅ compliant**
- `window.electronAPI.generatePrompt()` called via contextBridge
- No new IPC channels introduced
- `window.electronAPI` null-check present before use

**originalTranscript pattern — ✅ compliant**
- `originalTranscript.current = typedText` set once in handleTypingSubmit before generatePrompt
- Semantically equivalent to the voice path's onstop assignment
- Not mutated after submission

**isIterated pattern — ✅ compliant**
- `isIterated.current = false` reset at top of handleTypingSubmit
- Mirrors stopRecording onstop reset exactly

**stateRef pattern — ✅ compliant**
- ⌘T keydown guard: `stateRef.current === STATES.IDLE` checked correctly
- Escape double-fire is NOT a bug: `transition()` sets stateRef synchronously on first call; global window keydown listener reads stateRef on subsequent Escape and finds IDLE, skips

**Traffic light spacer — ✅ compliant**
- `<div style={{height:'28px'}}/>` spacer present in TYPING render block
- Matches RECORDING, PAUSED, ITERATING pattern exactly

**localStorage — ✅ compliant**
- `mode` read from App.jsx closure (useMode hook) — never accessed directly

**No runtime npm deps — ✅ clean**

---

## Step 4 — SOLID principles review

### SRP

**App.jsx — ⚠️ P1 (pre-existing, grew this feature)**
- File: `src/renderer/App.jsx`
- Lines: ~561 (500-line P1 threshold exceeded)
- This feature added ~46 lines: TYPING state, handleTypingSubmit, ⌘T keydown branch, render block
- SRP concern pre-dates this feature (was ~515 lines before). Logged to backlog.
- No action needed before this feature ships — tracked as BL-030.

**TypingState.jsx — ✅ clean**
- 107 lines. Single responsibility: textarea input with submit/dismiss/switch-to-voice.
- All styling inline. No external concerns.

**IdleState.jsx — ✅ clean**
- Keyboard icon button added cleanly. Subtitle text updated. No SRP violation.

**ShortcutsPanel.jsx — ✅ clean**
- Single row addition. No SRP concerns.

### OCP ✅
- New TYPING state added without modifying existing state transition logic
- STATES object extended additively
- STATE_HEIGHTS extended additively

### LSP ✅
- TypingState props `{ onDismiss, onSubmit, resizeWindow }` consistent with other state components

### ISP ✅
- TypingState has 3 props — well within the 10-prop threshold

### DIP ✅
- `window.electronAPI.generatePrompt()` abstraction — not direct IPC call
- No direct localStorage access

---

## Step 5 — Platform-specific review (Electron + React)

- **WebkitAppRegion drag/no-drag**: TypingState top row has `WebkitAppRegion:'drag'`, interactive elements override with `WebkitAppRegion:'no-drag'` — correct
- **contextIsolation**: All IPC through `window.electronAPI` — correct
- **useEffect cleanup**: Single useEffect in TypingState (focus call with setTimeout) — no subscription or RAF to clean up. ✅
- **Controlled component**: textarea is fully controlled via `value={text}` + `onChange={handleChange}` — correct

---

## Step 6 — Code quality

### handleTypingSubmit — P2: missing useCallback

**File:** `src/renderer/App.jsx` line ~238
**Issue:** `handleTypingSubmit` is declared as a plain `async function`, not wrapped in `useCallback`.
Every other submit/action handler in App.jsx uses `useCallback`:
`startRecording`, `stopRecording`, `handleDismiss`, `pauseRecording`, `resumeRecording`,
`handleRegenerate`, `handleIterate`, `stopIterating` — all `useCallback`.
This is an inconsistency that will produce a new function reference on every render,
though TypingState.memo is not used so there is no correctness bug — it's a style inconsistency.

### resizeWindow(320) double-call — P3

**File:** `src/renderer/App.jsx` line ~246 (inside handleTypingSubmit)
**Issue:** `resizeWindow(320)` is called explicitly after `transition(STATES.THINKING)`.
`transition()` already calls `resizeWindow(STATE_HEIGHTS[THINKING])` which is 320.
The explicit call is redundant — produces two identical IPC calls per submit.
No user-visible effect, but adds unnecessary IPC traffic.

### text.trim() multiple evaluations — P3

**File:** `src/renderer/components/TypingState.jsx` lines 88–103
**Issue:** `text.trim()` is evaluated 5× in the submit button JSX:
- `onClick` condition
- `disabled` prop
- `background` style condition
- `color` style condition
- `cursor` style condition
- `boxShadow` condition

Consider `const hasText = text.trim()` hoisted before the return. Minor; no correctness issue.

---

## Step 7 — Security review

- No hardcoded secrets or tokens — ✅
- No innerHTML with user content — ✅ (textContent via JSX text nodes throughout)
- No new IPC channels bypassing contextBridge — ✅
- @xmldom/xmldom high severity: devDep only, not in .dmg — ⚠️ P1 (tracked as BL-031, pre-existing)

---

## Step 8 — Testing review

No automated test suite configured in this project — consistent with all previous reviews.
Manual smoke test is the verification mechanism per CLAUDE.md.

---

## Step 9 — Quality score

| Category | Deductions |
|----------|-----------|
| P0 findings (×1.0 each) | 0 |
| P1 findings (×0.5 each) | −1.0 (BL-030 App.jsx SRP + BL-031 @xmldom) |
| P2 findings (×0.2 each) | −0.2 (BL-032 handleTypingSubmit useCallback) |
| P3 findings (×0.1 each) | −0.2 (resizeWindow double-call + text.trim() × 5) |
| Architecture drift (×0.5 each) | 0 |
| **Score** | **8.6 / 10 — Grade B+** |

---

## Strengths

- **TypingState.jsx** (`src/renderer/components/TypingState.jsx`): clean, self-contained, 107 lines. Exactly matches the inline-style pattern of IteratingState.jsx. Controlled textarea, escape/submit keyboard handling, switch-to-voice button — all correct.
- **handleTypingSubmit** (`src/renderer/App.jsx` ~238): correctly mirrors the voice path — resets isIterated, sets originalTranscript once, transitions THINKING, calls generatePrompt, saves to history, transitions PROMPT_READY. Parity with voice path is exact.
- **Escape double-fire non-issue**: stateRef.current is updated synchronously inside transition(), so the global window keydown handler reads the post-transition state and correctly skips.
- **Spec review P1/P2 fixes were applied correctly**: right:140px placement math, mode prop removed from TypingState, resizeWindow prop deviation documented.

---

## Findings summary

| ID | Severity | File | Line | Finding |
|----|----------|------|------|---------|
| BL-030 | P1 | src/renderer/App.jsx | ~561 | App.jsx over 500 lines (561) — SRP concern, pre-existing, grew +46 this feature |
| BL-031 | P1 | package.json (devDep) | — | @xmldom/xmldom high severity GHSA-crh6-fp67-6883 — devDep chain only, not runtime |
| BL-032 | P2 | src/renderer/App.jsx | ~238 | handleTypingSubmit is plain async function — inconsistent with useCallback pattern on all other handlers |
| — | P3 | src/renderer/App.jsx | ~246 | resizeWindow(320) redundant call — transition() already sets it via STATE_HEIGHTS.THINKING |
| — | P3 | src/renderer/components/TypingState.jsx | 88–103 | text.trim() evaluated 5× in button JSX — hoist to const |

---

## Gate decision

**✅ PASS — 0 P0 findings**

2 P1 findings logged to backlog (BL-030, BL-031 — both pre-existing).
1 P2 logged to backlog (BL-032).
2 P3 findings noted above — fix opportunistically.

FEATURE-014 Text Input is cleared.
Manual smoke test is the remaining step before broader distribution.
