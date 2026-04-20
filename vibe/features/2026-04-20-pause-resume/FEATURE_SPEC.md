# FEATURE_SPEC.md — FEATURE-011: Pause and Resume Recording
> Created: 2026-04-20 | Folder: vibe/features/2026-04-20-pause-resume/

---

## 1. Feature overview

Add pause and resume capability to the recording flow. When the user taps Pause (or presses Alt+P), the microphone recording suspends in place — the timer freezes, the waveform collapses to a flat amber line, and a PAUSED state displays clearly. Tapping Resume (or Alt+P again) continues recording from where it left off — all audio chunks (pre-pause and post-pause) are combined into one Blob when Stop is eventually pressed.

---

## 2. User stories

- As a user mid-recording, I can pause without losing what I've already said, then resume and continue.
- As a user who paused accidentally, I can see exactly when I'm paused and immediately resume.
- As a keyboard user, Alt+P toggles pause/resume so I never need to reach for the mouse.

---

## 3. Acceptance criteria

- [ ] RECORDING state shows three buttons: dismiss (X), pause (amber ⏸), stop (red ■)
- [ ] Tapping pause transitions to PAUSED state — waveform replaced by flat amber horizontal line
- [ ] PAUSED state timer color is amber (rgba(255,189,46,0.7)); timer does NOT reset
- [ ] PAUSED state shows status message: "Paused — tap resume to continue" with amber dot indicator
- [ ] Pause button becomes a resume (play triangle) button in PAUSED state
- [ ] Tapping resume returns to RECORDING state — red waveform restarts, timer continues from paused time
- [ ] Timer keeps counting continuously across pause/resume cycles — never resets until stop or dismiss
- [ ] Tapping stop from PAUSED state processes all audio (pre-pause + post-resume chunks)
- [ ] Tapping dismiss from either RECORDING or PAUSED state cancels and returns to IDLE
- [ ] Alt+P global shortcut: if RECORDING → pause; if PAUSED → resume; otherwise no-op
- [ ] PAUSED state height = 89px (same as RECORDING)
- [ ] Traffic lights hidden during PAUSED (same as RECORDING)

---

## 4. Scope boundaries

**Included:**
- PAUSED state (new 8th state)
- Amber UI for PausedState component
- Pause button in RecordingState
- Timer lifted to App.jsx (persists across RECORDING↔PAUSED transitions)
- Alt+P IPC wired via onShortcutPause (preload.js + App.jsx)

**Explicitly deferred:**
- Visual audio waveform freeze frame (we show a flat line, not a frozen waveform)
- Pause from THINKING or any other non-recording state
- Auto-pause on window focus loss
- Keyboard shortcut hint in ShortcutsPanel for Alt+P (can be a follow-up)

---

## 5. Integration points

- `src/renderer/App.jsx` — STATES, STATE_HEIGHTS, timer logic, pauseRecording(), resumeRecording(), onShortcutPause handler
- `src/renderer/components/RecordingState.jsx` — add pause button, accept duration + onPause props
- `src/renderer/components/PausedState.jsx` — new component
- `src/renderer/index.css` — add @keyframes pauseGlow
- `preload.js` — add onShortcutPause listener method
- `main.js` — already sends `shortcut-pause` on Alt+P (no changes needed)

---

## 6. New data model changes

No new localStorage keys or IPC channels.

New React state/refs in App.jsx:
- `recSecs` — useState(0) — drives timer display; persists across RECORDING↔PAUSED
- `recTimerRef` — useRef(null) — holds setInterval handle; cleared on pause, restarted on resume
- `isPausedRef` — useRef(false) — guard for pauseRecording/resumeRecording logic

---

## 7. New API endpoints / IPC

None new. `shortcut-pause` IPC already exists (main.js → renderer).
`onShortcutPause` added to preload.js to expose the existing channel to the renderer.

---

## 8. Edge cases and error states

- Pause called when not recording → guarded by `mediaRecorderRef.current?.state === 'recording'`
- Resume called when not paused → guarded by `mediaRecorderRef.current?.state === 'paused'`
- Alt+P in any state other than RECORDING or PAUSED → no-op (checked via stateRef)
- Stop from PAUSED → stopRecording() must work: MediaRecorder.stop() works from 'paused' state natively
- Dismiss from PAUSED → handleDismiss() stops tracks, clears timer, transitions to IDLE
- Multiple rapid pause/resume → MediaRecorder state machine prevents double-pause (guard on state)

---

## 9. Non-functional requirements

- Window height: 89px for PAUSED (identical to RECORDING — no resize needed on pause)
- Traffic lights hidden during PAUSED (same rule as RECORDING)
- Amber color: #FFBD2E / rgba(255,189,46,…) — consistent throughout PausedState
- Timer continues without drift (uses setInterval in App.jsx, same as before but lifted up)
- No new runtime npm dependencies

---

## 10. Conformance checklist

- [ ] All acceptance criteria above ticked
- [ ] Smoke test checklist (11 items) in FEATURE_TASKS.md passed
- [ ] Lint clean (npm run lint)
- [ ] No regressions in RECORDING, THINKING, PROMPT_READY flows
- [ ] CODEBASE.md updated (PAUZ-003)
- [ ] DECISIONS.md entry written
