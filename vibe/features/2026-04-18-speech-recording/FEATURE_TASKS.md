# FEATURE_TASKS.md — F-SPEECH: Speech Recording
> Feature: Speech recording via MediaRecorder + Whisper CLI
> Folder: vibe/features/2026-04-18-speech-recording/
> Created: 2026-04-18
> ⚠️ Scope change D-003 (2026-04-18): webkitSpeechRecognition → MediaRecorder + Whisper CLI. FPH-001/002 retrofitted, FPH-004 added.

> **Estimated effort:** 5 tasks — S: 3, M: 2 — approx. 5 hours total

---

### ~~FPH-001 · Module vars + `startRecording()` (webkitSpeechRecognition)~~
> ⚠️ Superseded by D-003. Code committed but wrong — replaced by FPH-001-R retrofit.
- **Status**: `[~]` (partial — retrofitted by FPH-001-R)

---

### FPH-001-R · Retrofit module vars + `startRecording()` for MediaRecorder
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: SPEC.md#f3
- **Dependencies**: None
- **Touches**: `index.html`

**What to do** (retrofit — replaces webkitSpeechRecognition vars and startRecording):

1. Replace module-scope vars after `let micOk = false;`:
   ```js
   let mediaRecorder = null;
   let audioChunks = [];
   let isRecording = false;
   ```
   Remove `let recognition = null;` — no longer used.

2. Replace entire `startRecording()` function:
   ```js
   async function startRecording() {
     let stream;
     try {
       stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     } catch {
       setState('ERROR', { message: 'Microphone access denied' });
       return;
     }
     audioChunks = [];
     mediaRecorder = new MediaRecorder(stream);
     mediaRecorder.ondataavailable = (e) => {
       if (e.data.size > 0) audioChunks.push(e.data);
     };
     mediaRecorder.onstop = null;  // wired in FPH-002-R
     mediaRecorder.start();
     isRecording = true;
     document.getElementById('recording-transcript').textContent = 'Recording…';
     setState('RECORDING');
   }
   ```

**Acceptance criteria**:
- [ ] `mediaRecorder`, `audioChunks`, `isRecording` declared as module-scope vars (after `micOk`)
- [ ] `recognition` var removed
- [ ] `startRecording()` is `async`, calls `getUserMedia` — goes to ERROR "Microphone access denied" on catch
- [ ] `audioChunks` reset to `[]` at start of each recording
- [ ] `MediaRecorder` created from stream; `ondataavailable` pushes chunks
- [ ] `#recording-transcript` textContent set to `'Recording…'`
- [ ] `setState('RECORDING')` called; `isRecording = true`
- [ ] `npm run lint` passes

**Self-verify**: DevTools console: `startRecording()` → bar shows RECORDING with "Recording…" dot.
**CODEBASE.md update?**: No — wait for FPH-003.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ~~FPH-002 · `onresult` + `onerror` + `onend` + `stopRecording()` + shortcut wiring (webkitSpeechRecognition)~~
> ⚠️ Superseded by D-003. Code committed but wrong — replaced by FPH-002-R retrofit.
- **Status**: `[~]` (partial — retrofitted by FPH-002-R)

---

### FPH-002-R · Retrofit `stopRecording()` + `onstop` handler + shortcut wiring for MediaRecorder
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: SPEC.md#f3
- **Dependencies**: FPH-001-R, FPH-004
- **Touches**: `index.html`

**What to do** (retrofit — replaces webkitSpeechRecognition handlers and stopRecording):

1. Inside `startRecording()`, replace `mediaRecorder.onstop = null` stub with real handler:
   ```js
   mediaRecorder.onstop = async () => {
     const blob = new Blob(audioChunks, { type: 'audio/webm' });
     const arrayBuffer = await blob.arrayBuffer();
     setState('THINKING');
     const result = await window.electronAPI.transcribeAudio(arrayBuffer);
     if (!result.success) {
       setState('ERROR', { message: result.error });
       return;
     }
     originalTranscript = result.transcript.trim();
     if (!originalTranscript) {
       setState('ERROR', { message: 'No speech detected — try again' });
       return;
     }
     // F-CLAUDE will replace this stub
     setTimeout(() => setState('IDLE'), 1500);
   };
   ```

2. Replace entire `stopRecording()` function:
   ```js
   function stopRecording() {
     if (!isRecording) return;
     isRecording = false;
     mediaRecorder.stop();
     mediaRecorder.stream.getTracks().forEach(t => t.stop());
   }
   ```

3. Shortcut wiring in DOMContentLoaded stays the same (already correct from FPH-002):
   ```js
   window.electronAPI.onShortcutTriggered(() => {
     if (currentState === 'IDLE') startRecording();
     else if (currentState === 'RECORDING') stopRecording();
   });
   ```

**Acceptance criteria**:
- [ ] `mediaRecorder.onstop` collects chunks into Blob, converts to ArrayBuffer, calls `transcribeAudio` IPC
- [ ] On IPC error → ERROR state with message from `result.error`
- [ ] On empty transcript → ERROR "No speech detected — try again"
- [ ] On success → `originalTranscript` set, `setState('THINKING')`, 1500ms stub → IDLE
- [ ] `stopRecording()` guards against double-stop with `if (!isRecording) return`
- [ ] `stopRecording()` stops MediaRecorder and releases all mic tracks
- [ ] `originalTranscript` captured once — never mutated after
- [ ] Shortcut IDLE → `startRecording()`, RECORDING → `stopRecording()` (unchanged)
- [ ] `npm run lint` passes

**Self-verify**: DevTools console: `startRecording()` → speak → `stopRecording()` → THINKING → IDLE. Check terminal for Whisper output.
**⚠️ Boundaries**: Do not mutate `originalTranscript` after it is set. The 1500ms setTimeout is a stub for F-CLAUDE.
**CODEBASE.md update?**: No — wait for FPH-003.
**Architecture compliance**: `textContent` only. `setState()` for all transitions. `originalTranscript` captured once.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FPH-004 · `transcribe-audio` IPC — main.js + preload.js
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: SPEC.md#f3, SPEC.md#ipc-surface
- **Dependencies**: None (can run in parallel with FPH-001-R)
- **Touches**: `main.js`, `preload.js`

**What to do**:

1. In `main.js`, resolve Whisper path at startup (same pattern as claudePath):
   ```js
   let whisperPath = null;
   // inside app.whenReady():
   exec('zsh -lc "which whisper"', (err, stdout) => {
     whisperPath = stdout.trim() || null;
     console.log('whisperPath:', whisperPath || 'not found');
   });
   ```

2. Add `transcribe-audio` IPC handler in `main.js`:
   ```js
   ipcMain.handle('transcribe-audio', async (_event, arrayBuffer) => {
     if (!whisperPath) {
       return { success: false, error: 'Whisper not found — install via pip install openai-whisper' };
     }
     const os = require('os');
     const fs = require('fs');
     const tmpFile = path.join(os.tmpdir(), `promptly-${Date.now()}.webm`);
     const outDir = os.tmpdir();
     try {
       fs.writeFileSync(tmpFile, Buffer.from(arrayBuffer));
       const transcript = await new Promise((resolve, reject) => {
         exec(`"${whisperPath}" "${tmpFile}" --model tiny --output_format txt --output_dir "${outDir}"`, (err, stdout, stderr) => {
           const txtFile = tmpFile.replace('.webm', '.txt');
           try {
             const text = fs.readFileSync(txtFile, 'utf8').trim();
             fs.unlinkSync(tmpFile);
             fs.unlinkSync(txtFile);
             resolve(text);
           } catch {
             reject(new Error(stderr || 'Whisper output not found'));
           }
         });
       });
       return { success: true, transcript };
     } catch (err) {
       try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
       return { success: false, error: err.message || 'Transcription failed' };
     }
   });
   ```

3. In `preload.js`, expose `transcribeAudio`:
   ```js
   transcribeAudio: (arrayBuffer) => ipcRenderer.invoke('transcribe-audio', arrayBuffer),
   ```

**Acceptance criteria**:
- [ ] `whisperPath` resolved at startup via `zsh -lc "which whisper"`, logged to console
- [ ] `transcribe-audio` IPC handler registered in `main.js`
- [ ] If `whisperPath` null → returns `{ success: false, error: 'Whisper not found — install via pip install openai-whisper' }`
- [ ] Audio written to temp file in `os.tmpdir()`
- [ ] Whisper runs with `--model tiny --output_format txt`
- [ ] Transcript read from output `.txt` file, both temp files cleaned up
- [ ] On failure → returns `{ success: false, error: message }`
- [ ] `transcribeAudio` exposed on `window.electronAPI` via preload
- [ ] `npm run lint` passes

**Self-verify**: In terminal after `npm start`: `whisperPath:` line should appear. In DevTools: `window.electronAPI.transcribeAudio` should be a function.
**CODEBASE.md update?**: No — wait for FPH-003.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FPH-003 · CODEBASE.md update
- **Status**: `[x]`
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
