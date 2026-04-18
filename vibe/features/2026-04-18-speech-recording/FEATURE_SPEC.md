# FEATURE_SPEC.md — F-SPEECH: Speech Recording
> Feature: Speech recording with live transcript
> Folder: vibe/features/2026-04-18-speech-recording/
> Created: 2026-04-18
> SPEC.md ref: F3 (Speech recording), F9 (Error states)

---

## 1. Feature overview

Implements speech recording via `webkitSpeechRecognition`. When the user presses ⌥Space from IDLE, the bar enters RECORDING state showing a blinking red dot and a live transcript as the user speaks. Pressing ⌥Space again or silence auto-stop ends the session — `originalTranscript` is captured once and frozen. The bar transitions to THINKING, leaving a stub that F-CLAUDE will replace. This feature is the sole data-source layer: every subsequent feature reads `originalTranscript` but never writes to it.

---

## 2. User stories

- As a user, I press ⌥Space and the bar turns into a recording view with a blinking red dot and "Listening…" text, which updates live as I speak.
- As a user, I press ⌥Space again when done — the bar transitions to a spinner while my prompt is being generated.
- As a user, if I pause long enough, recording auto-stops and transitions to THINKING.
- As a user, if mic is denied or no speech is detected, I see an in-bar error I can dismiss by tapping.

---

## 3. Acceptance criteria

1. `webkitSpeechRecognition` initialised with `continuous: true`, `interimResults: true`, `lang: 'en-US'`
2. If `webkitSpeechRecognition` is undefined → ERROR "Speech recognition not available"
3. Pressing shortcut from IDLE → calls `startRecording()` → RECORDING state
4. `transcript` module var reset to `''` at start of each `startRecording()` call
5. `#recording-transcript` textContent initialised to `'Listening…'` at recording start
6. `onresult`: combines all final + current interim results into `transcript`, updates `#recording-transcript` via `textContent` in real time
7. Pressing shortcut from RECORDING → calls `stopRecording()`
8. `stopRecording()`: sets `isRecording = false`, calls `recognition.stop()`, captures `originalTranscript = transcript.trim()`
9. If `originalTranscript` is empty after stop → ERROR state: `"No speech detected — try again"`
10. If `originalTranscript` has content → `setState('THINKING')` then `setTimeout(() => setState('IDLE'), 1500)` — stub for F-CLAUDE to replace
11. `recognition.onend` fires (auto-stop/silence): if `isRecording` is still `true` → executes same stop flow as criteria 8–10
12. `recognition.onerror` with `event.error === 'not-allowed'` → `isRecording = false` → ERROR: `"Microphone access denied"`
12b. `recognition.onerror` with `event.error === 'no-speech'` → `isRecording = false` → ERROR: `"No speech detected — try again"`
13. `recognition.onerror` with any other `event.error` → `isRecording = false` → ERROR: `"Speech recognition error — try again"`
14. `isRecording` flag ensures `onend` is a no-op when stop was already handled by `stopRecording()` or `onerror`
15. All DOM text updates use `textContent` — never `innerHTML`
16. No new IPC channels added
17. `npm run lint` passes

---

## 4. Scope boundaries

**Included:**
- `startRecording()` and `stopRecording()` functions in `index.html`
- `recognition.onresult`, `onerror`, `onend` handlers
- Shortcut wiring: IDLE → `startRecording()`, RECORDING → `stopRecording()`
- `webkitSpeechRecognition` availability guard
- CODEBASE.md update (FPH-003)

**Explicitly deferred (not in this feature):**
- THINKING → PROMPT_READY transition — F-CLAUDE
- `generate-prompt` IPC call — F-CLAUDE
- Recording cancel (Escape) — v2
- Language selection — v2
- Waveform animation — v2
- Text cursor animation on transcript — v2 (the blinking red `#recording-dot` satisfies SPEC.md F3 "blinking cursor animation" for v1)

---

## 5. Integration points

| Point | Detail |
|-------|--------|
| Replaces | Shortcut stub at DOMContentLoaded listener (index.html:411-419) |
| Reads | `currentState` — to decide startRecording vs stopRecording |
| Writes | `transcript` (live), `originalTranscript` (once at stop) |
| DOM | `#recording-transcript` — textContent updated by onresult |
| State transitions | `setState('RECORDING')`, `setState('THINKING')`, `setState('ERROR', {message})` |
| Stub left for F-CLAUDE | `setTimeout(() => setState('IDLE'), 1500)` after THINKING — to be replaced |

---

## 6. New data model changes

No new localStorage keys. Two module-scope vars added to `index.html`:

| Variable | Type | Initial value | Written by | Read by |
|----------|------|---------------|-----------|---------|
| `recognition` | `webkitSpeechRecognition\|null` | `null` | `startRecording()` | `stopRecording()` |
| `isRecording` | `boolean` | `false` | `startRecording()`, `stopRecording()`, `onerror` | `onend` |

---

## 7. New API endpoints / IPC

None. `webkitSpeechRecognition` is a Web API — operates entirely in the renderer. No new IPC channels.

---

## 8. Edge cases and error states

| Scenario | Trigger | Handling |
|----------|---------|----------|
| Mic permission denied | `onerror('not-allowed')` | `isRecording = false` → ERROR "Microphone access denied" |
| No speech detected (silence from start) | `onerror('no-speech')` | `isRecording = false` → ERROR "No speech detected — try again" |
| Silence after some speech | `onend` with non-empty transcript | Stop flow → THINKING → stub to IDLE |
| Empty transcript on manual stop | `stopRecording()`, `transcript.trim() === ''` | ERROR "No speech detected — try again" |
| Other recognition error | `onerror(other)` | `isRecording = false` → ERROR "Speech recognition error — try again" |
| `webkitSpeechRecognition` undefined | `startRecording()` guard | ERROR "Speech recognition not available" |
| Double-stop (onerror then onend) | `onend` fires after `onerror` | `isRecording` is already `false` → onend is a no-op |
| Shortcut while in THINKING/PROMPT_READY | `currentState` !== IDLE or RECORDING | No-op — shortcut handler ignores other states |

**Error message reference (must match these exactly):**
- `"Microphone access denied"` — matches SPEC.md F3 and F9
- `"No speech detected — try again"` — new v1 message (em dash, not hyphen)
- `"Speech recognition error — try again"` — generic fallback
- `"Speech recognition not available"` — availability guard

---

## 9. Non-functional requirements

- Recognition session starts (visual RECORDING state) within one render frame of shortcut press
- Live transcript updates are synchronous with `onresult` events — no debounce
- No internet connectivity check — `webkitSpeechRecognition` may use Google servers; out of scope for v1
- `recognition` object created fresh on each `startRecording()` call — not reused

---

## 10. Conformance checklist

> Tick after every task. All items ✅ before feature is shippable.

- [ ] `webkitSpeechRecognition` initialised with `continuous: true`, `interimResults: true`, `lang: 'en-US'`
- [ ] Availability guard fires correct error when API unavailable
- [ ] Live transcript updates in real time via `onresult`
- [ ] `originalTranscript` captured once at stop — never mutated after
- [ ] Manual stop (shortcut) works correctly
- [ ] Auto-stop (silence / `onend`) works correctly
- [ ] All 4 error conditions surface with exact messages from §8
- [ ] `isRecording` flag prevents double-stop from `onend` after explicit stop
- [ ] No new IPC channels
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access
- [ ] Existing states IDLE, PROMPT_READY (stub), ERROR dismiss still work
- [ ] CODEBASE.md updated: `recognition`, `isRecording`, `startRecording()`, `stopRecording()`
- [ ] `npm run lint` passes
