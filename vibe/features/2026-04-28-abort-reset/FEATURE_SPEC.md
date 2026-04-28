# FEATURE_SPEC.md — Abort / Reset Button
> Feature folder: vibe/features/2026-04-28-abort-reset/
> Added: 2026-04-28 | Status: planned

---

## 1. Feature overview

Adds a persistent "reset" button that is always reachable regardless of which state the app is in.
Clicking it immediately aborts any in-progress activity (recording, generation, iteration, builder flow)
and returns to the IDLE screen for the current mode — without changing the mode.
Removes the need to collapse and re-expand to escape a stuck state.

---

## 2. User stories

- **As a user who finished generating an image prompt**, I want to start a new recording immediately
  without hunting for an escape route, so I can use the app repeatedly without friction.
- **As a user watching a long generation spin**, I want to cancel it instantly and go back to the mic,
  so I'm not locked out while waiting for Claude.
- **As a user in any state**, I want a single consistent button in the same corner every time,
  so I never have to think about how to get back to the start.

---

## 3. Acceptance criteria

- [ ] AC-001: The reset button is visible in every state except `IDLE`, `HISTORY`, `SETTINGS`, `SHORTCUTS`, and `ERROR`.
- [ ] AC-002: In expanded mode the button sits in the `ExpandedTransportBar` drag spacer row, left side — always on screen.
- [ ] AC-003: In collapsed mode the button sits at `top: 10px, right: 14px` as an absolute overlay in the App container — always on screen regardless of which state component is rendered.
- [ ] AC-004: Clicking the button from `RECORDING` stops the mic without submitting (calls `handleDismiss`) and transitions to `IDLE`.
- [ ] AC-005: Clicking from `PAUSED` calls `handleDismiss` and transitions to `IDLE`.
- [ ] AC-006: Clicking from `THINKING` sets `abortRef.current = true` before transitioning to `IDLE`, so that when the in-flight Claude call completes, `handleGenerateResult` detects the abort and does nothing.
- [ ] AC-007: Clicking from `ITERATING` calls `dismissIterating` and transitions to `IDLE`.
- [ ] AC-008: Clicking from `TYPING`, `PROMPT_READY` transitions to `IDLE`.
- [ ] AC-009: Clicking from `IMAGE_BUILDER` or `IMAGE_BUILDER_DONE` calls `handleImageStartOver()` which resets builder state and transitions to `IDLE`.
- [ ] AC-010: Clicking from `VIDEO_BUILDER` or `VIDEO_BUILDER_DONE` calls `handleVideoStartOver()` which resets builder state and transitions to `IDLE`.
- [ ] AC-011: After reset, `isExpanded` is unchanged — if the user was in expanded mode they stay expanded (at IDLE), if collapsed they stay collapsed.
- [ ] AC-012: The button has a `title="Reset to start"` tooltip.
- [ ] AC-013: `handleGenerateResult` bails out immediately (no state transition) if `abortRef.current` is true when the async call completes. It resets `abortRef.current = false` after bailing.
- [ ] AC-014: `abortRef.current` is reset to `false` at the start of every new recording so stale aborts don't affect subsequent flows.
- [ ] AC-015: The button is `WebkitAppRegion: 'no-drag'` so it is always clickable even in drag-region areas.
- [ ] AC-016: Lint passes with 0 errors after all changes.

---

## 4. Scope boundaries

**In scope:**
- Single `handleAbort()` function in App.jsx branching by `stateRef.current`
- `abortRef` flag with guard in `handleGenerateResult`
- Reset button in `ExpandedTransportBar` (expanded mode)
- Reset button overlay in App.jsx (collapsed mode)
- No new IPC channels, no new hooks, no new files

**Explicitly deferred:**
- Keyboard shortcut for abort (Escape is already claimed by Typing and Shortcuts states)
- Confirmation dialog before abort (adds friction for a quick-escape action)
- Undo / restore-after-abort

---

## 5. Integration points

| File | Change |
|------|--------|
| `src/renderer/App.jsx` | Add `abortRef`, `handleAbort()`, guard in `handleGenerateResult`, collapsed-mode overlay button, `onAbort` prop to ExpandedView |
| `src/renderer/components/ExpandedView.jsx` | Accept + forward `onAbort` prop to `ExpandedTransportBar` |
| `src/renderer/components/ExpandedTransportBar.jsx` | Add abort button to drag-spacer row left side; accept `onAbort` + `currentState` already present |

No new files. No IPC changes. No new hooks.

---

## 6. New data model changes

None.

---

## 7. New API endpoints

None.

---

## 8. Edge cases and error states

| Scenario | Expected behaviour |
|----------|--------------------|
| Abort fires while THINKING, Claude call completes 200ms later | `abortRef` is true → `handleGenerateResult` returns immediately, no transition |
| Abort fires while THINKING, Claude call completes 2s later | Same — `abortRef` is already false (reset at next recording start) so a subsequent flow works normally |
| User aborts from IMAGE_BUILDER_DONE, then immediately records again | `handleImageStartOver()` resets all builder state; new recording starts clean |
| User aborts from expanded VIDEO_BUILDER | Stays expanded (IDLE), window remains 1100×860; new recording available |
| Abort button clicked from IDLE (not shown, but defensive) | `handleAbort` is a no-op when `stateRef.current === IDLE` |
| Button appears briefly during state animation (stateClass transition) | Acceptable — button is always safe to click; worst case is a second no-op click |

---

## 9. Non-functional requirements

- Button must not interfere with drag region (`WebkitAppRegion: 'no-drag'`)
- Zero new IPC calls — all abort logic is pure React state transitions
- No visible flash: transition to IDLE must use the existing `animateToState` path
- Button opacity and position must not overlap state-specific controls (RecordingState stop button, ThinkingState content, etc.)

---

## 10. Conformance checklist

- [ ] Button visible in all required states (AC-001 through AC-003)
- [ ] All state transitions correct per AC-004 through AC-010
- [ ] `abortRef` guard prevents stale-generation side effects (AC-013, AC-014)
- [ ] `isExpanded` untouched — mode stays as-is after abort (AC-011)
- [ ] Button is no-drag (AC-015)
- [ ] Lint 0 errors (AC-016)
- [ ] No regressions in existing recording, builder, or iteration flows
- [ ] CODEBASE.md updated
