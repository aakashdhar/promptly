# FEATURE_TASKS.md — F-SPEECH: Speech Recording
> Feature: Speech recording with live transcript
> Folder: vibe/features/2026-04-18-speech-recording/
> Created: 2026-04-18

> **Estimated effort:** 3 tasks — S: 2, M: 1 — approx. 3 hours total

---

### FPH-001 · Module vars + `startRecording()`
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3 (criteria 1–6), FEATURE_SPEC.md#6
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

1. Add two module-scope vars directly after `let micOk = false;`:
   ```js
   let recognition = null;
   let isRecording = false;
   ```

2. Add `startRecording()` immediately after `checkFirstRunCompletion()` (before DOMContentLoaded):
   ```js
   function startRecording() {
     if (typeof webkitSpeechRecognition === 'undefined') {
       setState('ERROR', { message: 'Speech recognition not available' });
       return;
     }
     transcript = '';
     document.getElementById('recording-transcript').textContent = 'Listening…';
     recognition = new webkitSpeechRecognition();
     recognition.continuous = true;
     recognition.interimResults = true;
     recognition.lang = 'en-US';
     recognition.onresult = null;  // wired in FPH-002
     recognition.onerror = null;   // wired in FPH-002
     recognition.onend = null;     // wired in FPH-002
     recognition.start();
     isRecording = true;
     setState('RECORDING');
   }
   ```

   Note: handlers are stubbed `null` here — FPH-002 fills them in.

**Acceptance criteria**:
- [x] `recognition` and `isRecording` declared as module-scope vars (after `micOk`)
- [x] `startRecording()` calls availability guard — returns early with ERROR if `webkitSpeechRecognition` undefined
- [x] `transcript` reset to `''` at start of `startRecording()`
- [x] `#recording-transcript` textContent set to `'Listening…'` at recording start
- [x] `recognition` created fresh: `continuous: true`, `interimResults: true`, `lang: 'en-US'`
- [x] `recognition.start()` called, `isRecording = true`, `setState('RECORDING')` called
- [x] `npm run lint` passes

**Self-verify**: Re-read FEATURE_SPEC.md#3 criteria 1-6. From DevTools console: call `startRecording()` → bar should show RECORDING state with "Listening…". Shortcut still uses old stub — that's expected; replaced in FPH-002.
**Test requirement**: Console call `startRecording()` shows RECORDING state. `webkitSpeechRecognition` guard: temporarily shadow `window.webkitSpeechRecognition = undefined` in console, call `startRecording()` → ERROR shown.
**⚠️ Boundaries**: `recognition.onresult/onerror/onend = null` is intentional — FPH-002 fills these in. Do not add handler logic here.
**CODEBASE.md update?**: No — wait for FPH-003.
**Architecture compliance**: Module vars follow existing pattern (after `micOk`). setState for all state changes. textContent for DOM text.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FPH-002 · `onresult` + `onerror` + `onend` + `stopRecording()` + shortcut wiring
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (criteria 6–14), FEATURE_SPEC.md#8
- **Dependencies**: FPH-001
- **Touches**: `index.html`

**What to do**:

1. Inside `startRecording()`, replace the three `null` handler stubs with real implementations:

   **`recognition.onresult`:**
   ```js
   recognition.onresult = (event) => {
     let final = '';
     let interim = '';
     for (let i = 0; i < event.results.length; i++) {
       if (event.results[i].isFinal) {
         final += event.results[i][0].transcript;
       } else {
         interim += event.results[i][0].transcript;
       }
     }
     transcript = final + interim;
     document.getElementById('recording-transcript').textContent = transcript || 'Listening…';
   };
   ```

   **`recognition.onerror`:**
   ```js
   recognition.onerror = (event) => {
     isRecording = false;
     if (event.error === 'not-allowed') {
       setState('ERROR', { message: 'Microphone access denied' });
     } else if (event.error === 'no-speech') {
       setState('ERROR', { message: 'No speech detected — try again' });
     } else {
       setState('ERROR', { message: 'Speech recognition error — try again' });
     }
   };
   ```

   **`recognition.onend`:**
   ```js
   recognition.onend = () => {
     if (isRecording) {
       stopRecording();
     }
   };
   ```

2. Add `stopRecording()` immediately after `startRecording()`:
   ```js
   function stopRecording() {
     isRecording = false;
     recognition.stop();
     originalTranscript = transcript.trim();
     if (!originalTranscript) {
       setState('ERROR', { message: 'No speech detected — try again' });
       return;
     }
     setState('THINKING');
     // F-CLAUDE will replace this stub
     setTimeout(() => setState('IDLE'), 1500);
   }
   ```

3. Replace the existing shortcut stub inside DOMContentLoaded:

   **Find and replace this block:**
   ```js
   window.electronAPI.onShortcutTriggered(() => {
     if (currentState === 'IDLE') {
       setState('RECORDING');
     } else if (currentState === 'RECORDING') {
       setState('THINKING');
       // F-SPEECH: replace stub
       setTimeout(() => setState('IDLE'), 2000);
     }
   });
   ```

   **With:**
   ```js
   window.electronAPI.onShortcutTriggered(() => {
     if (currentState === 'IDLE') {
       startRecording();
     } else if (currentState === 'RECORDING') {
       stopRecording();
     }
   });
   ```

**Acceptance criteria**:
- [ ] `onresult`: `transcript` updated with combined final + interim text on every event
- [ ] `onresult`: `#recording-transcript` textContent updated — falls back to `'Listening…'` if empty
- [ ] `onerror('not-allowed')`: sets `isRecording = false`, shows ERROR "Microphone access denied"
- [ ] `onerror('no-speech')`: sets `isRecording = false`, shows ERROR "No speech detected — try again"
- [ ] `onerror(other)`: sets `isRecording = false`, shows ERROR "Speech recognition error — try again"
- [ ] `onend`: calls `stopRecording()` only if `isRecording` is true — no-op if already false
- [ ] `stopRecording()`: sets `isRecording = false`, calls `recognition.stop()`
- [ ] `stopRecording()`: captures `originalTranscript = transcript.trim()`
- [ ] `stopRecording()`: empty transcript → ERROR "No speech detected — try again"
- [ ] `stopRecording()`: non-empty transcript → `setState('THINKING')` then `setTimeout → setState('IDLE') 1500ms`
- [ ] Shortcut from IDLE → `startRecording()` (not `setState('RECORDING')` directly)
- [ ] Shortcut from RECORDING → `stopRecording()` (not `setState('THINKING')` directly)
- [ ] Error messages match FEATURE_SPEC.md§8 exactly (em dash `—`, correct capitalisation)
- [ ] `npm run lint` passes

**Self-verify**: Re-read FEATURE_SPEC.md#3 criteria 6-14 and #8. Full happy path: ⌥Space → speak → ⌥Space → THINKING → (1.5s) IDLE. Auto-stop: ⌥Space → speak → silence → THINKING → IDLE. No-speech: ⌥Space → say nothing → silence → ERROR. Tap error → IDLE.
**Test requirement**: Manual smoke — all 4 paths from §8 exercised before commit.
**⚠️ Boundaries**: Do not add any `innerHTML`. Do not modify `originalTranscript` anywhere other than `stopRecording()`. The `setTimeout 1500ms` is a stub — do not make it permanent or configurable.
**CODEBASE.md update?**: No — wait for FPH-003.
**Architecture compliance**: `textContent` only. `setState()` for all transitions. `originalTranscript` captured once and never mutated again.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FPH-003 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10 (conformance: CODEBASE.md updated)
- **Dependencies**: FPH-002
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

Update `vibe/CODEBASE.md`:

1. Update the "Last updated" line:
   ```
   > Last updated: 2026-04-18 (FPH-003 — F-SPEECH complete: startRecording, stopRecording, webkitSpeechRecognition)
   ```

2. Update "Current state":
   ```
   **Phase:** Phase 2 in progress — F-STATE complete (5/5) — F-FIRST-RUN complete (4/4) — F-SPEECH complete (3/3) — F-CLAUDE next
   ```

3. Update `index.html` row in File map to include new functions:
   Add `startRecording()`, `stopRecording()`, `recognition`, `isRecording` to the key exports column.

4. Add `recognition` and `isRecording` to the Module-scope variables table:
   ```
   | `recognition` | webkitSpeechRecognition\|null | `startRecording()` | `stopRecording()`, handlers |
   | `isRecording` | boolean | `startRecording()`, `stopRecording()`, `onerror` | `onend` |
   ```

**Acceptance criteria**:
- [ ] "Last updated" line updated to FPH-003
- [ ] "Current state" reflects F-SPEECH complete
- [ ] `recognition` and `isRecording` in module-scope vars table
- [ ] `startRecording()` and `stopRecording()` in index.html key exports
- [ ] `npm run lint` passes (no index.html changes in this task)

**Self-verify**: Read CODEBASE.md and verify all 4 changes are present and accurate.
**Test requirement**: No code changes — CODEBASE.md only.
**⚠️ Boundaries**: Only CODEBASE.md changes in this task. Do not touch index.html.
**CODEBASE.md update?**: Yes — this is the CODEBASE.md update task.
**Architecture compliance**: N/A — documentation only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: F-SPEECH
> Tick after every task. All items ✅ before feature is shippable.
- [ ] `webkitSpeechRecognition` initialised with correct params (`continuous`, `interimResults`, `lang`)
- [ ] Availability guard fires ERROR "Speech recognition not available" when API absent
- [ ] Live transcript updates in real time via `onresult`
- [ ] `originalTranscript` captured once at stop — never mutated after
- [ ] Manual stop (shortcut from RECORDING) works — THINKING then stub IDLE
- [ ] Auto-stop (silence / `onend`) works — same transition
- [ ] `onerror('not-allowed')` → ERROR "Microphone access denied"
- [ ] Empty transcript on stop → ERROR "No speech detected — try again"
- [ ] Other error → ERROR "Speech recognition error — try again"
- [ ] `isRecording` flag prevents double-stop from `onend` after explicit stop
- [ ] No new IPC channels
- [ ] No `innerHTML` with dynamic content
- [ ] No `localStorage.*` direct access
- [ ] Existing states IDLE, ERROR (dismiss), FIRST_RUN boot path all still work
- [ ] CODEBASE.md updated: `recognition`, `isRecording`, `startRecording()`, `stopRecording()`
- [ ] `npm run lint` passes

---
