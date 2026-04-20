# FEATURE_PLAN.md — FEATURE-012: Iteration Mode
> Added: 2026-04-20

---

## 1. Impact map

**Files to modify:**
- `main.js` — add generate-raw IPC handler
- `preload.js` — add generateRaw contextBridge method
- `src/renderer/index.css` — add @keyframes iterGlow
- `src/renderer/App.jsx` — ITERATING state, refs, recording flow, render
- `src/renderer/components/PromptReadyState.jsx` — ↻ Iterate button, isIterated badge
- `src/renderer/components/HistoryPanel.jsx` — ↻ indicator on iteration entries
- `src/renderer/utils/history.js` — extend saveToHistory for isIteration/basedOn

**New files:**
- `src/renderer/components/IteratingState.jsx`

**Vibe docs to update:**
- `vibe/features/2026-04-20-iteration-mode/FEATURE_TASKS.md`
- `vibe/TASKS.md`
- `vibe/DECISIONS.md`
- `vibe/CODEBASE.md`
- `CLAUDE.md`

---

## 2. Files explicitly out of scope

- `splash.html` — not touched
- `entitlements.plist` — not touched
- `vite.config.js` — not touched
- `package.json` — not touched (no new deps)
- All other components not listed above

---

## 3. New IPC channel: generate-raw

**main.js handler** (append after generate-prompt handler):
```js
ipcMain.handle('generate-raw', (_event, { systemPrompt }) => {
  return new Promise((resolve) => {
    if (!claudePath) {
      resolve({ success: false, error: 'Claude CLI not found.' });
      return;
    }
    const { spawn } = require('child_process');
    const child = spawn(claudePath, ['-p', systemPrompt, '--model', 'claude-sonnet-4-6']);
    let stdout = '', stderr = '', resolved = false;
    const timer = setTimeout(() => {
      resolved = true; child.kill();
      resolve({ success: false, error: 'Claude took too long — try again' });
    }, 60000);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.stdin.end();
    child.on('close', (code) => {
      if (resolved) return;
      clearTimeout(timer); resolved = true;
      if (code !== 0) { resolve({ success: false, error: stderr.trim() || 'Claude CLI error' }); return; }
      const prompt = stdout.trim();
      if (!prompt) { resolve({ success: false, error: 'Claude returned empty response — try again' }); return; }
      resolve({ success: true, prompt });
    });
    child.on('error', (err) => {
      if (resolved) return;
      clearTimeout(timer); resolved = true;
      resolve({ success: false, error: err.message || 'Claude CLI error' });
    });
  });
});
```

**preload.js addition:**
```js
generateRaw: (systemPrompt) =>
  ipcRenderer.invoke('generate-raw', { systemPrompt }),
```

---

## 4. App.jsx changes

**STATES addition:**
```js
ITERATING: 'ITERATING',
```

**STATE_HEIGHTS addition:**
```js
ITERATING: 200,
```

**New refs:**
```js
const iterationBase = useRef(null)   // { transcript, prompt, mode }
const isIterated = useRef(false)
const iterRecorderRef = useRef(null)
const iterChunksRef = useRef([])
const iterIsProcessingRef = useRef(false)
```

**transition() — hide traffic lights for ITERATING:**
```js
window.electronAPI.setWindowButtonsVisible(
  newState !== STATES.RECORDING &&
  newState !== STATES.PAUSED &&
  newState !== STATES.ITERATING
)
```

**handleIterate() function:**
```js
const handleIterate = useCallback(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    iterRecorderRef.current = recorder
    iterChunksRef.current = []
    recorder.ondataavailable = (e) => iterChunksRef.current.push(e.data)
    iterationBase.current = {
      transcript: originalTranscript.current,
      prompt: generatedPrompt,
      mode,
    }
    isIterated.current = false
    recorder.start()
    stopTimer()
    setRecSecs(0)
    startTimer()
    transition(STATES.ITERATING)
  } catch {
    transition(STATES.ERROR, { message: 'Microphone access denied' })
  }
}, [generatedPrompt, mode])
```

**stopIterating() function:**
```js
const stopIterating = useCallback(async () => {
  const recorder = iterRecorderRef.current
  if (!recorder || iterIsProcessingRef.current) return
  iterIsProcessingRef.current = true
  stopTimer()
  recorder.stop()
  recorder.stream.getTracks().forEach((t) => t.stop())

  recorder.onstop = async () => {
    const blob = new Blob(iterChunksRef.current, { type: 'audio/webm' })
    const arrayBuffer = await blob.arrayBuffer()
    iterIsProcessingRef.current = false

    if (!window.electronAPI) {
      transition(STATES.ERROR, { message: 'Electron API not available' })
      return
    }

    const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer)
    if (!transcribeResult.success) {
      transition(STATES.ERROR, { message: transcribeResult.error })
      return
    }

    const iterText = transcribeResult.transcript.trim()
    if (!iterText) {
      transition(STATES.PROMPT_READY)
      return
    }

    setThinkTranscript(iterText)
    transition(STATES.THINKING)
    resizeWindow(320)

    const iterationSystemPrompt = `You are an expert Claude prompt engineer. You have a previously generated prompt and the user has spoken a refinement.

Your job is to produce an improved version of the original prompt that incorporates the user's new input precisely.

Rules:
1. Output ONLY the improved prompt. No preamble. No explanation.
2. Preserve everything from the original prompt that the user did not ask to change.
3. Apply the user's new input as precisely as possible.
4. Keep the same structure and section labels as the original prompt.
5. If the new input contradicts the original, the new input wins.
6. Do not add new sections unless the new input clearly calls for them.

Original prompt:
${iterationBase.current.prompt}

User's new input:
"${iterText}"

Mode: ${iterationBase.current.mode}`

    const genResult = await window.electronAPI.generateRaw(iterationSystemPrompt)
    if (!genResult.success) {
      transition(STATES.ERROR, { message: genResult.error || 'Claude error' })
      return
    }

    isIterated.current = true
    originalTranscript.current = iterText
    setGeneratedPrompt(genResult.prompt)
    saveToHistory({
      transcript: iterText,
      prompt: genResult.prompt,
      mode,
      isIteration: true,
      basedOn: iterationBase.current.prompt.slice(0, 100),
    })
    transition(STATES.PROMPT_READY)
  }
}, [mode])
```

**dismissIterating() function:**
```js
function dismissIterating() {
  const recorder = iterRecorderRef.current
  if (recorder) {
    recorder.stream.getTracks().forEach((t) => t.stop())
    iterRecorderRef.current = null
  }
  iterChunksRef.current = []
  iterIsProcessingRef.current = false
  stopTimer()
  transition(STATES.PROMPT_READY)
}
```

**Render IteratingState:**
```jsx
{currentState === STATES.ITERATING && (
  <IteratingState
    contextText={iterationBase.current?.transcript || ''}
    duration={duration}
    onStop={stopIterating}
    onDismiss={dismissIterating}
  />
)}
```

**PromptReadyState render (add new props):**
```jsx
<PromptReadyState
  ...existing props...
  onIterate={handleIterate}
  isIterated={isIterated.current}
/>
```

**stopRecording — reset isIterated on fresh recording:**
Add `isIterated.current = false` at the start of `recorder.onstop`.

---

## 5. IteratingState.jsx

All styles inline. Internal RAF loop for blue waveform (same pattern as WaveformCanvas). useEffect cleanup cancels RAF on unmount.

Layout:
1. Drag area 13px
2. Blue context banner (margin 14px 18px 0, shows contextText, max 2 lines clamped)
3. Control row: [X dismiss] [blue waveform canvas] [timer] [blue stop with iterGlow]
4. Divider 0.5px rgba(255,255,255,0.06)

---

## 6. Conventions to follow

- All styles inline in IteratingState.jsx — no Tailwind (matches PausedState pattern)
- `saveToHistory` call with extra fields — history.js already accepts spread; extend explicitly
- `iterGlow` animation name — add to index.css; referenced inline as `animation: 'iterGlow 2s ease-in-out infinite'`
- `textContent` equivalent — JSX text nodes only, no dangerouslySetInnerHTML
- `generateRaw` IPC follows exact same pattern as `generatePrompt`

---

## 7. Task breakdown

| ID | Title | Size | Deps |
|----|-------|------|------|
| ITR-001 | generate-raw IPC + iterGlow CSS | S | None |
| ITR-002 | IteratingState.jsx | M | None |
| ITR-003 | App.jsx — ITERATING state + iteration flow | M | ITR-001, ITR-002 |
| ITR-004 | PromptReadyState.jsx — Iterate button + badge | S | ITR-003 |
| ITR-005 | history.js + HistoryPanel.jsx — isIteration fields | S | None |
| ITR-006 | CODEBASE.md + DECISIONS.md + smoke test | S | All |

---

## 8. Rollback plan

- Remove generate-raw from main.js and preload.js
- Delete IteratingState.jsx
- Revert App.jsx (remove ITERATING from STATES/STATE_HEIGHTS, remove refs and functions, revert PromptReadyState render)
- Revert PromptReadyState.jsx (remove onIterate/isIterated)
- Revert history.js (remove isIteration/basedOn fields)
- Revert HistoryPanel.jsx (remove ↻ indicator)
- Remove iterGlow from index.css

---

## 9. Testing strategy

Manual smoke test checklist (in FEATURE_TASKS.md conformance section):
- All 12 acceptance criteria exercised manually
- Error paths: mic denied, Whisper fail, Claude fail
- Multi-iteration: iterate 3× in sequence
- Dismiss at each stage
- History panel: ↻ indicator visible on iteration entries

No automated tests needed (consistent with project testing philosophy).
