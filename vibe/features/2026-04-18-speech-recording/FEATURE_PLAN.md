# FEATURE_PLAN.md — F-SPEECH: Speech Recording
> Feature: Speech recording with live transcript
> Folder: vibe/features/2026-04-18-speech-recording/
> Created: 2026-04-18

---

## 1. Impact map

**Files modified:**
- `index.html` — all changes in the `<script>` block

**New files:** None

**Files explicitly out of scope — do not touch:**
- `main.js` — no new IPC channels needed; webkitSpeechRecognition is a renderer Web API
- `preload.js` — no new contextBridge methods
- `package.json` — no new dependencies
- `entitlements.plist` — mic entitlement already present from F-FIRST-RUN

---

## 2. DB migration plan

None — no persistence layer. No new localStorage keys.

---

## 3. Code changes — `index.html` script block

### New module-scope vars (add after `let micOk = false;`)

```js
let recognition = null;
let isRecording = false;
```

### New function: `startRecording()` (add after `checkFirstRunCompletion()`)

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

  recognition.onend = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  recognition.start();
  isRecording = true;
  setState('RECORDING');
}
```

### New function: `stopRecording()` (add immediately after `startRecording()`)

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

### Shortcut handler replacement (inside DOMContentLoaded)

Replace the existing stub:
```js
// OLD (remove this):
window.electronAPI.onShortcutTriggered(() => {
  if (currentState === 'IDLE') {
    setState('RECORDING');
  } else if (currentState === 'RECORDING') {
    setState('THINKING');
    // F-SPEECH: replace stub
    setTimeout(() => setState('IDLE'), 2000);
  }
});

// NEW (replace with):
window.electronAPI.onShortcutTriggered(() => {
  if (currentState === 'IDLE') {
    startRecording();
  } else if (currentState === 'RECORDING') {
    stopRecording();
  }
});
```

---

## 4. Conventions to follow (from ARCHITECTURE.md + CODEBASE.md)

- `setState(newState, payload)` is the ONLY function that mutates DOM visibility
- `textContent` for all dynamic text — never `innerHTML`
- Event listeners set once at `DOMContentLoaded` — shortcut listener already registered there
- All elements accessed by `id` — no querySelector chains
- `originalTranscript` must NEVER be mutated after capture (rule from ARCHITECTURE.md)
- No new IPC channels — webkitSpeechRecognition is a Web API, no main.js involvement

---

## 5. Task breakdown

| Task ID | Title | Size | Touches | Dependencies |
|---------|-------|------|---------|--------------|
| FPH-001 | Module vars + `startRecording()` | S | index.html | None |
| FPH-002 | Handlers + `stopRecording()` + shortcut wiring | M | index.html | FPH-001 |
| FPH-003 | CODEBASE.md update | S | vibe/CODEBASE.md | FPH-002 |

**Execution order:** Sequential — FPH-001 lays the foundation FPH-002 builds on.

---

## 6. Rollback plan

`index.html` changes are isolated to the script block. To roll back:
1. Remove `recognition` and `isRecording` module vars
2. Remove `startRecording()` and `stopRecording()` functions
3. Restore the original shortcut stub (IDLE → setState RECORDING; RECORDING → setState THINKING + setTimeout IDLE)

All other states remain unaffected.

---

## 7. Testing strategy

**Manual smoke tests (before each commit):**
1. Clear localStorage → launch → FIRST_RUN → complete → IDLE
2. Press ⌥Space → RECORDING state with blinking dot and "Listening…"
3. Speak a sentence → transcript updates live
4. Press ⌥Space → THINKING → (stub) IDLE
5. Press ⌥Space → speak → wait for silence → auto-stop to THINKING → IDLE
6. Press ⌥Space → say nothing → silence stops → ERROR "No speech detected"
7. ERROR state: tap to dismiss → IDLE

**Regression checks:**
- FIRST_RUN still shows on fresh localStorage
- Subsequent launches boot to IDLE directly
- ERROR tap-to-dismiss still works

---

## 8. CODEBASE.md sections to update (FPH-003)

- Module-scope variables table: add `recognition`, `isRecording`
- index.html key functions: add `startRecording()`, `stopRecording()`
- Current state: update to "F-SPEECH complete"
- Last updated line: FPH-003
