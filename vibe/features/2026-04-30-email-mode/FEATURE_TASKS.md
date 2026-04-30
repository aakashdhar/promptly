# FEATURE-EMAIL-MODE Tasks

> **Estimated effort:** 8 tasks — S: 5 (<2hrs each), M: 3 (2-4hrs each) — approx. 9–11 hours total

---

### EMAIL-001 · useMode.js — add 'email' mode + teal accent
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#mode-identity
- **Dependencies**: None
- **Touches**: `src/renderer/hooks/useMode.js`

**What to do**: Add `email: 'Email'` to MODE_LABELS object in useMode.js. No other changes needed — accent colour is handled at the component level, not in this hook.

**Acceptance criteria**:
- [ ] `email` key added to MODE_LABELS with value `'Email'`
- [ ] No other modes affected

**Self-verify**: Read useMode.js. Confirm email entry present. Confirm no other entries changed.
**Test requirement**: None — pure data change; getModeTagStyle test in tests/utils.test.js covers tag style (add email case in EMAIL-008 docs step).
**⚠️ Boundaries**: Only touch useMode.js. Do not add accent/subtitle logic here — that goes in components.
**CODEBASE.md update?**: Yes — update useMode.js row to include `email: 'Email'` in MODE_LABELS.
**Architecture compliance**: localStorage accessed only via hook wrapper (useMode). No direct localStorage access.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-002 · main.js — MODE_CONFIG + show-mode-menu + email system prompt
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#claude-system-prompt-for-email-generation
- **Dependencies**: EMAIL-001
- **Touches**: `main.js`

**What to do**:
1. Add `email` entry to `MODE_CONFIG` with `standalone: true` and the full email generation system prompt from the spec. The prompt embeds `{TRANSCRIPT}` placeholder — use same replacement pattern as polish mode.
2. Add `'email'` to the `show-mode-menu` IPC handler array so it appears in the right-click mode menu.
3. The `generate-prompt` handler for email mode must: use the system prompt directly (standalone), call Claude with the transcript, return `{ success: true, prompt: rawJsonString }`. The renderer (App.jsx) will parse the JSON — main.js returns the raw Claude output string.

**Acceptance criteria**:
- [ ] `email` in MODE_CONFIG with `standalone: true`
- [ ] Email system prompt matches spec exactly (all 10 rules, JSON shape)
- [ ] `'email'` appears in show-mode-menu items array
- [ ] Lint passes

**Self-verify**: Read main.js MODE_CONFIG and show-mode-menu handler. Verify email present in both.
**Test requirement**: Manual smoke: switch to email mode via right-click menu — menu item appears.
**⚠️ Boundaries**: Only touch MODE_CONFIG and show-mode-menu. Do not add new IPC channels.
**CODEBASE.md update?**: Yes — update main.js MODE_CONFIG note to include email (standalone: true).
**Architecture compliance**: Use cached `claudePath`. Use `standalone: true` pattern (same as polish, design, refine). No new IPC channels.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-003 · EmailReadyState.jsx — two-column email output component
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#email_ready-layout--expanded-view
- **Dependencies**: EMAIL-001, EMAIL-002
- **Touches**: `src/renderer/components/EmailReadyState.jsx` (new file)

**What to do**: Create EmailReadyState.jsx as a new functional React component.

Props interface:
```
emailOutput: { subject, body, toneAnalysis: { recipient, tone, coreMessage, approach, whyThisTone } }
transcript: string
onCopySubject: () => void
onCopy: () => void  (copies subject + '\n\n' + body)
onIterate: () => void
onReset: () => void
onSave: () => void
isSaved: boolean
isExpanded: boolean
```

Layout (all inline styles per architecture):
- Panel header: teal dot + "Email ready" + tone badge | "Iterate ↻" + "Reset" links
- Two-column grid (1fr 1.4fr): left panel + right panel
- Left panel: YOU SAID (italic transcript) + divider + TONE ANALYSIS rows + WHY THIS TONE box
- Right panel: SUBJECT LINE section (copy button) + EMAIL BODY section
- Action row: Edit + Save (left) | Copy subject + Copy email (right)

Copy button behaviour: own `copiedSubject` and `copiedEmail` useState booleans.
When clicked: set true, use `navigator.clipboard.writeText()`, setTimeout 2000ms → false.
Button text: "Copied ✓" when true, original label when false.

All text rendered via JSX text nodes — no dangerouslySetInnerHTML.
Body: `white-space: pre-wrap` to preserve line breaks.

**Acceptance criteria**:
- [ ] Two-column layout renders (1fr 1.4fr grid)
- [ ] Left: YOU SAID italic transcript, TONE ANALYSIS 4 rows, WHY THIS TONE teal box
- [ ] Right: SUBJECT LINE + copy button, EMAIL BODY with pre-wrap
- [ ] Action row: all 4 buttons present
- [ ] "Copy subject" copies subject only; "Copy email" copies subject + '\n\n' + body
- [ ] Both copy buttons show "Copied ✓" for 2 seconds then revert
- [ ] Tone badge shows toneAnalysis.tone in header
- [ ] No dangerouslySetInnerHTML

**Self-verify**: Re-read FEATURE_SPEC.md email_ready layout section. Tick every layout item.
**Test requirement**: Manual smoke: EMAIL_READY renders, both copy buttons work.
**⚠️ Boundaries**: New file only. Do not touch any existing components. All styles inline.
**CODEBASE.md update?**: Yes — add EmailReadyState.jsx row with props description.
**Architecture compliance**: Functional component, one file, inline styles for dynamic values, JSX text nodes only, no runtime deps.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-004 · App.jsx — EMAIL_READY state + email mode flow + auto-expand
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#flow--start-to-end, FEATURE_SPEC.md#auto-expand-on-mode-switch
- **Dependencies**: EMAIL-003
- **Touches**: `src/renderer/App.jsx`

**What to do**:
1. Add `EMAIL_READY` to `STATES` constant.
2. Add `emailOutput` useState: `{ subject: '', body: '', toneAnalysis: {} }` or `null`.
3. In `handleGenerateResult`: add `email` branch — parse raw JSON string from Claude into `emailOutput`, then `transition(STATES.EMAIL_READY)`. Handle JSON parse errors → `transition(STATES.GENERATION_ERROR, { errorType: 'unknown', ... })`.
4. In the `email` branch, BEFORE transitioning to THINKING, call `setThinkingAccentColor('rgba(20,184,166,0.85)')` and `setThinkingLabel('Drafting your email...')` — same pattern as video (orange) and workflow (green). This drives the teal morph wave + teal spinner in ThinkingState.jsx.
5. Auto-expand on mode change: in the `mode-selected` IPC listener in App.jsx, if new mode is `'email'` and `!isExpandedRef.current`, call `handleExpand()`.
6. Auto-expand on shortcut trigger: in App.jsx's `shortcut-triggered` listener callback, BEFORE calling `startRecordingRef.current()`, add:
   ```js
   if (modeRef.current === 'email' && !isExpandedRef.current) {
     handleExpand()
     return // handleExpand triggers re-render; shortcut re-fires or user taps again
   }
   ```
   If the expand+record-in-one-shot pattern is preferred, call handleExpand() then use setTimeout(startRecordingRef.current, 350) to wait for window animation. Match the pattern used by video/workflow modes — check useKeyboardShortcuts.js onShortcutTriggered for the exact insertion point.
7. Add `emailOutput` to the props bundle passed to ExpandedView → ExpandedDetailPanel.
8. Handle iterate from EMAIL_READY: `onIterate` clears `emailOutput` (set to null) and transitions to RECORDING in expanded view.
9. Add `emailSaved` useState boolean + `handleEmailSave` that calls `bookmarkHistoryItem(lastSavedEmailId)`. Pass as `isSaved` + `onSave` props.

**Acceptance criteria**:
- [ ] `EMAIL_READY` in STATES
- [ ] `emailOutput` state initialized
- [ ] `handleGenerateResult` email branch parses JSON → sets emailOutput → transitions EMAIL_READY
- [ ] JSON parse error → GENERATION_ERROR with errorType 'unknown'
- [ ] `setThinkingAccentColor('rgba(20,184,166,0.85)')` called before THINKING transition
- [ ] `setThinkingLabel('Drafting your email...')` called before THINKING transition
- [ ] THINKING in email mode shows teal spinner and teal morph wave (not default blue)
- [ ] Auto-expand when mode switches to 'email'
- [ ] Auto-expand when ⌥ Space fired with mode === 'email' and not expanded
- [ ] emailOutput forwarded to ExpandedView → ExpandedDetailPanel
- [ ] Iterate clears emailOutput and goes to RECORDING
- [ ] Save: bookmarks history entry; isSaved→true → "Saved ✓" label

**Self-verify**: Re-read FEATURE_SPEC.md flow section. Check all 4 steps are covered.
**Test requirement**: Manual smoke: full flow from IDLE → RECORDING → THINKING → EMAIL_READY.
**⚠️ Boundaries**: Only App.jsx. Do not touch hooks. Use transition() for all state changes.
**CODEBASE.md update?**: Yes — update App.jsx row: add EMAIL_READY to STATES list, emailOutput to state vars table.
**Architecture compliance**: All state transitions via `transition()`. Use `transitionRef.current` inside callbacks. Parse JSON in renderer (not main.js). No stale closures — use refs.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-005 · App.jsx — STATE_HEIGHTS.EMAIL_READY = 860
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#critical-behaviour--always-expanded-never-minimized
- **Dependencies**: EMAIL-004
- **Touches**: `src/renderer/App.jsx`

**What to do**: Add `EMAIL_READY: 860` to `STATE_HEIGHTS` constant. This follows the same pattern as `VIDEO_BUILDER`, `VIDEO_BUILDER_DONE`, `WORKFLOW_BUILDER`, `WORKFLOW_BUILDER_DONE` — all 860px because they are expanded-only states.

**Acceptance criteria**:
- [ ] `STATE_HEIGHTS.EMAIL_READY === 860`

**Self-verify**: Read App.jsx STATE_HEIGHTS. Confirm EMAIL_READY: 860 present.
**Test requirement**: Verify window stays at 860px after email generation.
**⚠️ Boundaries**: One line change only.
**CODEBASE.md update?**: No — the 860px note in the state table row added in EMAIL-004 covers this.
**Architecture compliance**: Consistent with expanded-only mode pattern.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-006 · History saving — email entries with teal tag
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#history-saving
- **Dependencies**: EMAIL-004
- **Touches**: `src/renderer/App.jsx`, `src/renderer/utils/promptUtils.js`

**What to do**:
1. In App.jsx email branch of handleGenerateResult (after parsing emailOutput), call `saveToHistory({ transcript: originalTranscript.current, prompt: emailOutput.subject + '\n\n' + emailOutput.body, mode: 'email' })`.
2. In `promptUtils.js`, add `email` case to `getModeTagStyle`: `background: 'rgba(20,184,166,0.1)', color: 'rgba(45,212,191,0.65)'`.

**Acceptance criteria**:
- [ ] Email history entry saved after successful generation
- [ ] `getModeTagStyle('email')` returns teal colours
- [ ] History panel shows teal "Email" tag on email entries

**Self-verify**: Check promptUtils.js getModeTagStyle for email case. Check saveToHistory call in handleGenerateResult email branch.
**Test requirement**: Manual smoke: generate email → check history panel shows entry with teal tag.
**⚠️ Boundaries**: Only App.jsx email branch + promptUtils.js getModeTagStyle. Do not touch history.js utility.
**CODEBASE.md update?**: Yes — update promptUtils.js row: note getModeTagStyle now includes email (teal) case.
**Architecture compliance**: saveToHistory via utils/history.js (already imported). getModeTagStyle extended following existing pattern.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-007 · Expanded view — hide collapse button + RECORDING standby + THINKING skeleton + EMAIL_READY routing
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#critical-behaviour--always-expanded-never-minimized, FEATURE_SPEC.md#flow--start-to-end
- **Dependencies**: EMAIL-003, EMAIL-004
- **Touches**: `src/renderer/components/ExpandedTransportBar.jsx`, `src/renderer/components/ExpandedDetailPanel.jsx`

**What to do**:
1. In `ExpandedTransportBar.jsx`, extend the collapse-button disable logic. Currently `mode === 'video'` disables it — add `|| mode === 'email'` to the same condition. Check existing code for exact pattern.
2. In `ExpandedDetailPanel.jsx`, add `EMAIL_READY` to the `isContentState` flag (the array/condition that routes content states to their dedicated component). Wire: when `currentState === STATES.EMAIL_READY`, render `<EmailReadyState>` with the appropriate props from `emailOutput` + `thinkTranscript`.
3. Add the recording standby panel for email mode in ExpandedDetailPanel: when `currentState === STATES.RECORDING && mode === 'email'`, show the envelope icon + prompt text panel described in the spec.

**Acceptance criteria**:
- [ ] Collapse button hidden/disabled when mode === 'email' (same visual as video/workflow)
- [ ] EMAIL_READY renders EmailReadyState in right panel
- [ ] RECORDING in email mode shows envelope icon + standby text in right panel
- [ ] THINKING in email mode shows teal skeleton (subject skeleton + body skeleton bars)

**Self-verify**: Read ExpandedTransportBar collapse button logic. Read ExpandedDetailPanel isContentState logic. Confirm email cases handled.
**Test requirement**: Manual smoke: collapse button hidden in email mode; recording right panel shows standby; email_ready shows two-column layout.
**⚠️ Boundaries**: ExpandedTransportBar + ExpandedDetailPanel only. Do not touch ExpandedView.jsx or ExpandedHistoryList.
**CODEBASE.md update?**: Yes — update ExpandedTransportBar row: note collapse disabled for email mode too. Update ExpandedDetailPanel row: add EMAIL_READY to isContentState list.
**Architecture compliance**: Follow existing `mode === 'video'` pattern exactly. One component per file.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EMAIL-008 · Docs — CODEBASE.md + DECISIONS.md + TASKS.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: All
- **Dependencies**: EMAIL-001 through EMAIL-007
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `tests/utils.test.js`

**What to do**:
1. `vibe/CODEBASE.md`:
   - Add `EmailReadyState.jsx` row to file map with props description
   - Update `App.jsx` row: add EMAIL_READY to STATES, emailOutput to state vars
   - Update `useMode.js` row: add email to MODE_LABELS
   - Update `main.js` row: note email in MODE_CONFIG (standalone: true)
   - Update `promptUtils.js` row: note getModeTagStyle includes email (teal)
   - Update `ExpandedTransportBar.jsx` row: collapse disabled for email mode
   - Update `ExpandedDetailPanel.jsx` row: EMAIL_READY in isContentState
   - Update `IdleState.jsx` row: note teal visual identity for email mode
   - Update state machine table: add EMAIL_READY row (860px, expanded only)
2. `vibe/DECISIONS.md`: Add D-EMAIL-001 entry — feature start, rationale (email drafting via direct output, no prompt intermediary, teal accent to distinguish from existing modes).
3. `vibe/TASKS.md`: Mark all EMAIL-001 through EMAIL-007 as complete [x]. Add "What just happened" + "What's next" sections.
4. `tests/utils.test.js`: Add `getModeTagStyle('email')` test case:
   ```js
   it('returns teal style for email mode', () => {
     const style = getModeTagStyle('email')
     expect(style.background).toBe('rgba(20,184,166,0.1)')
     expect(style.color).toBe('rgba(45,212,191,0.65)')
   })
   ```
   This extends the existing 8-case getModeTagStyle test suite and prevents future regressions.

**Acceptance criteria**:
- [ ] CODEBASE.md reflects all 7 tasks' file changes
- [ ] DECISIONS.md has D-EMAIL-001 entry
- [ ] TASKS.md shows all tasks complete
- [ ] `getModeTagStyle('email')` test case added to tests/utils.test.js
- [ ] `npm run lint` passes after test addition

**Self-verify**: Read CODEBASE.md. Verify every file touched in EMAIL-001 through EMAIL-007 has an updated entry.
**Test requirement**: Add getModeTagStyle('email') test case to tests/utils.test.js (see What to do step 4).
**⚠️ Boundaries**: Only doc files. No code changes.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: CODEBASE.md update rule: never let it drift more than one task behind.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-EMAIL-MODE
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Email appears in right-click mode menu with teal accent
- [ ] Idle bar shows teal dot + "Describe your email situation naturally"
- [ ] Idle bar: teal pulse ring + teal mode pill text + correct subtitle
- [ ] ⌥ Space in email mode auto-expands if minimized
- [ ] Collapse button hidden in email mode
- [ ] Recording: right panel shows envelope icon + prompt text
- [ ] Thinking: teal spinner + "Drafting your email..." in top bar
- [ ] Thinking: teal morph wave (not default blue)
- [ ] Thinking: right panel shows skeleton matching email layout
- [ ] EMAIL_READY: right panel shows two-column grid (1fr 1.4fr)
- [ ] Left column: transcript shown in italic
- [ ] Left column: tone analysis rows (recipient, tone, core msg, approach)
- [ ] Left column: "Why this tone" teal box with explanation
- [ ] Right column: subject line with individual copy button
- [ ] Right column: full email body with line breaks preserved
- [ ] Header: tone badge shows inferred tone
- [ ] "Copy subject" copies subject only
- [ ] "Copy email" copies subject + double newline + body
- [ ] Both copy buttons show "Copied ✓" for 2 seconds after click
- [ ] Edit button: body becomes contenteditable; Done saves; Escape cancels
- [ ] Save button: bookmarks entry; label shows "Saved ✓"
- [ ] Iterate returns to recording, clears output
- [ ] History saves with teal Email tag
- [ ] Top bar properly dimmed in EMAIL_READY state
- [ ] Waveform is flat teal hairline in EMAIL_READY
- [ ] No minimized bar state for email mode
- [ ] Auto-expand works from minimized bar
- [ ] getModeTagStyle('email') test case passes in tests/utils.test.js
- [ ] All existing tests still pass
- [ ] Linter clean
- [ ] No regressions in other modes
- [ ] CODEBASE.md updated for all structural changes
- [ ] DECISIONS.md D-EMAIL-001 entry present
---
