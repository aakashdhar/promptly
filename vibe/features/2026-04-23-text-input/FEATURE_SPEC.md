# FEATURE_SPEC.md — FEATURE-014: Text Input (Type Prompt)
> Added: 2026-04-23 | Folder: vibe/features/2026-04-23-text-input/
> Status: Specced — not yet built

---

## 1. Feature overview

Users can type a prompt directly into the bar instead of speaking it. A keyboard icon button in the IDLE state opens a TYPING state with a textarea, mode-aware submit button, and a "switch to voice" escape hatch. Submitted text flows through the same `generate-prompt` IPC pipeline as a voice transcript — same modes, same THINKING → PROMPT_READY flow, same history saving. No new IPC channels are needed.

---

## 2. User stories

- As a user in a quiet environment, I want to type my prompt instead of speaking, so I can use Promptly without a microphone.
- As a user, I want ⌘T to open the typing panel from IDLE, so I can reach it without touching the mouse.
- As a user in TYPING state, I want a "Switch to voice" button, so I can fall back to recording without dismissing and re-opening.
- As a user, I want my typed prompts to appear in history and be regenerable, so the two input methods are interchangeable.

---

## 3. Acceptance criteria

- [ ] A keyboard icon button appears in the IDLE bar, positioned between the text block and the mode pill
- [ ] Clicking the button transitions to TYPING state at 220px height
- [ ] ⌘T keyboard shortcut opens TYPING state from IDLE
- [ ] Textarea auto-focuses within 50ms of TYPING state entering
- [ ] Textarea border turns blue (`rgba(10,132,255,0.25)`) when text is present
- [ ] "Generate prompt" button is disabled (grey, no cursor) when textarea is empty
- [ ] "Generate prompt" button is enabled (blue gradient) when textarea has text
- [ ] ⌘↵ submits text (same as clicking "Generate prompt")
- [ ] Esc in TYPING state dismisses back to IDLE
- [ ] "Switch to voice" button starts recording (transition to RECORDING state)
- [ ] "×" dismiss button returns to IDLE
- [ ] Submitting text transitions: TYPING → THINKING → PROMPT_READY
- [ ] YOU SAID in ThinkingState and PromptReadyState shows the typed text
- [ ] History entry saved with the typed text as transcript
- [ ] Mode selection applies to typed prompts identically to voice prompts
- [ ] Window expands dynamically (up to 320px) when textarea has more than 4 lines
- [ ] Window resets to 220px when text is cleared below 4 lines
- [ ] ⌘T shortcut listed in ShortcutsPanel

---

## 4. Scope boundaries

**Included:**
- TYPING state with textarea + submit + dismiss + switch-to-voice
- ⌘T global shortcut from IDLE
- Keyboard icon button in IdleState
- Dynamic window height based on text line count (220–320px)
- Same history + mode pipeline as voice

**Explicitly excluded:**
- Markdown rendering in textarea
- Saving draft text across sessions (textarea resets each open)
- Typing from any state other than IDLE
- Any new IPC channel (generate-prompt already handles text)
- Auto-paste of output (separate feature)

---

## 5. Integration points

- **App.jsx**: add `TYPING` to `STATES`, add `STATE_HEIGHTS.TYPING = 220`, add ⌘T keydown handler, add `handleTypingSubmit()`, render `<TypingState>` when `displayState === STATES.TYPING`
- **IdleState.jsx**: add keyboard icon button with `onTypePrompt` prop; update subtitle copy
- **TypingState.jsx** (new): `src/renderer/components/TypingState.jsx` — self-contained component, all inline styles; props: `{ onDismiss, onSubmit, resizeWindow }` (no `mode` — App.jsx closure handles it)
- **ShortcutsPanel.jsx**: add `{ desc: 'Type prompt', keys: ['⌘', 'T'] }` to shortcuts array
- **IPC**: no changes — `generate-prompt` already accepts any string transcript
- **history.js**: no changes — `saveToHistory({ transcript, prompt, mode })` already generic

---

## 6. New data model changes

None. No new localStorage keys. No new IPC channels. `originalTranscript.current` is set to the typed text (same as voice transcript assignment in `stopRecording`).

---

## 7. New API endpoints

None.

---

## 8. Edge cases and error states

| Scenario | Handling |
|----------|----------|
| User submits empty text | Button disabled; ⌘↵ guard (`text.trim()`) no-ops |
| Claude returns error | Transition to ERROR state with `genResult.error` — same as voice path |
| User opens TYPING while RECORDING | ⌘T only fires from IDLE (guard: `stateRef.current === STATES.IDLE`) |
| User switches to voice from TYPING | `startRecording()` called directly — transitions TYPING → RECORDING via startRecording's transition() |
| Textarea has 100+ lines pasted | Window height capped at 320px |
| Esc pressed mid-submit (async) | Dismiss is synchronous; the pending generatePrompt IPC will resolve but transition(THINKING) has already been called so it will complete normally |

---

## 9. Non-functional requirements

- Auto-focus must fire via `setTimeout(..., 50)` to allow state animation to settle
- No `dangerouslySetInnerHTML` — textarea value via `value` prop only
- `WebkitAppRegion: 'drag'` on top row only; `'no-drag'` on interactive elements
- All styles inline — no Tailwind classes (matches IteratingState pattern for dynamic components)
- Zero new npm dependencies

---

## 10. Conformance checklist

- [ ] TYPING state added to STATES and STATE_HEIGHTS
- [ ] ⌘T shortcut fires only from IDLE
- [ ] Auto-focus on textarea within 50ms
- [ ] Submit disabled when empty, enabled with text
- [ ] ⌘↵ shortcut submits
- [ ] Esc dismisses to IDLE
- [ ] Switch to voice triggers startRecording()
- [ ] Typed text flows through generate-prompt IPC unchanged
- [ ] History saved with typed transcript
- [ ] Dynamic height 220–320px based on line count
- [ ] ⌘T listed in ShortcutsPanel
- [ ] Lint clean (0 errors)
- [ ] Manual smoke checklist passes (13 items)
- [ ] CODEBASE.md updated
