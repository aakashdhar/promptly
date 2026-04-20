# FEATURE_TASKS.md — FEATURE-012: Iteration Mode
> Added: 2026-04-20
> **Estimated effort:** 6 tasks — S: 4, M: 2 — approx. 6–9 hours total

---

### ITR-001 · generate-raw IPC + iterGlow CSS
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#7-new-ipc-channels
- **Dependencies**: None
- **Touches**: `main.js`, `preload.js`, `src/renderer/index.css`

**What to do**:

1. In `main.js`, append after the `generate-prompt` handler (around line 347):
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

2. In `preload.js`, inside the contextBridge object (after `transcribeAudio`):
```js
generateRaw: (systemPrompt) =>
  ipcRenderer.invoke('generate-raw', { systemPrompt }),
```

3. In `src/renderer/index.css`, append after the `pauseGlow` keyframe:
```css
@keyframes iterGlow {
  0%,100% { box-shadow: 0 0 14px rgba(10,132,255,0.45), 0 2px 8px rgba(0,0,0,0.4); }
  50% { box-shadow: 0 0 26px rgba(10,132,255,0.8), 0 2px 8px rgba(0,0,0,0.4); }
}
```

**Acceptance criteria**:
- [ ] `generate-raw` handler in main.js — identical timeout/error pattern to `generate-prompt`
- [ ] `generateRaw` exposed on `window.electronAPI` via preload.js
- [ ] `iterGlow` keyframe in index.css — verified visually or by reading the file
- [ ] `npm run lint` passes (main.js + preload.js)

**Self-verify**: Read main.js around line 347. Confirm generate-raw handler is present and matches generate-prompt pattern exactly. Read preload.js — confirm generateRaw present in contextBridge object.
**Test requirement**: Lint must pass. No automated test needed.
**⚠️ Boundaries**: Never add runtime npm deps. Never use bare exec('claude...'). Always use cached claudePath.
**CODEBASE.md update?**: Yes — add generate-raw to IPC channels table and generateRaw to preload.js row.
**Architecture compliance**: IPC pattern per ARCHITECTURE.md — ipcMain.handle + contextBridge.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ITR-002 · IteratingState.jsx — blue banner + waveform + timer + stop
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (items 3–7)
- **Dependencies**: None (can build before App.jsx wires it)
- **Touches**: `src/renderer/components/IteratingState.jsx` (new file)

**What to do**:

Create `src/renderer/components/IteratingState.jsx`. All styles must be inline — no Tailwind classes. Follow the exact approved design:

```
Layout (top to bottom):
  - Drag area: div height 13px, WebkitAppRegion drag
  - Context banner: margin 14 18 0, padding 12 14, bg rgba(10,132,255,0.07),
    border 0.5px solid rgba(10,132,255,0.15), borderRadius 10px
      Label row: "ITERATING ON" — 9px, fw700, ls 0.1em, uppercase, rgba(100,180,255,0.55)
      Text: contextText — 12px, rgba(255,255,255,0.55), lh 1.55, 2-line clamp
  - Control row: height 68px, flex items-center, gap 12, px 18, WebkitAppRegion drag
      X dismiss button (left): 32x32, rounded-full, bg rgba(255,255,255,0.06),
        border rgba(255,255,255,0.10), WebkitAppRegion no-drag
        SVG: 1 1L9 9M9 1L1 9 stroke rgba(255,255,255,0.45) sw 1.5
      Canvas (centre): flex-1, height 36, blue gradient waveform (internal RAF)
        Blue gradient: 0→rgba(10,132,255,0), 0.08→rgba(10,132,255,0.85),
          0.92→rgba(10,132,255,0.85), 1→rgba(10,132,255,0)
        Glow layer: rgba(10,132,255,0.1) lw 5
        Main line: grad lw 1.5
        Same sine+noise formula as WaveformCanvas
      Timer (right of canvas): 11px, fw500, rgba(255,255,255,0.55), tabular-nums, no-drag
      Blue stop button (far right): 32x32, rounded-full, bg #0A84FF,
        animation iterGlow 2s ease-in-out infinite, WebkitAppRegion no-drag
        SVG square: rect 1.5 1.5 7 7 rx 1.5 fill white
  - Divider: 0.5px, rgba(255,255,255,0.06), margin 0 18px
```

Props: `{ contextText, duration, onStop, onDismiss }`

The blue waveform RAF loop lives inside a useEffect in this component (same pattern as WaveformCanvas.jsx). The useEffect returns `() => cancelAnimationFrame(raf)` for cleanup on unmount.

**Acceptance criteria**:
- [ ] Context banner shows contextText truncated to 2 lines with exact approved styles
- [ ] Blue waveform animates immediately on mount (not red — double-check gradient colors)
- [ ] Timer displays the duration prop (formatted M:SS by caller)
- [ ] Stop button has blue background + iterGlow animation
- [ ] Dismiss X fires onDismiss
- [ ] Stop button fires onStop
- [ ] No Tailwind classes — all styles inline
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Open the component, verify every inline style matches the approved design table. Confirm blue gradient values (10,132,255) not red (255,59,48).
**Test requirement**: `npm run build:renderer` must succeed.
**⚠️ Boundaries**: No dangerouslySetInnerHTML. No Tailwind. Inline styles only for this component.
**CODEBASE.md update?**: Yes — add IteratingState.jsx row to file map.
**Architecture compliance**: RAF cleanup pattern per CODEBASE.md (useEffect return → cancelAnimationFrame).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ITR-003 · App.jsx — ITERATING state + full iteration recording flow
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (all), FEATURE_PLAN.md#4
- **Dependencies**: ITR-001, ITR-002
- **Touches**: `src/renderer/App.jsx`

**What to do**:

Make these changes to `src/renderer/App.jsx`:

1. Import IteratingState: `import IteratingState from './components/IteratingState.jsx'`

2. Add `ITERATING: 'ITERATING'` to STATES object.

3. Add `ITERATING: 200` to STATE_HEIGHTS.

4. Add refs after `isPausedRef`:
```js
const iterationBase = useRef(null)
const isIterated = useRef(false)
const iterRecorderRef = useRef(null)
const iterChunksRef = useRef([])
const iterIsProcessingRef = useRef(false)
```

5. Update `transition()` to hide traffic lights for ITERATING:
```js
window.electronAPI.setWindowButtonsVisible(
  newState !== STATES.RECORDING &&
  newState !== STATES.PAUSED &&
  newState !== STATES.ITERATING
)
```

6. In `stopRecording`'s `recorder.onstop` callback, add `isIterated.current = false` as the first line (before `setThinkTranscript`). This clears the badge on fresh recordings.

7. Add `handleIterate` useCallback (depends on generatedPrompt and mode):
```js
const handleIterate = useCallback(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    iterRecorderRef.current = recorder
    iterChunksRef.current = []
    recorder.ondataavailable = (e) => iterChunksRef.current.push(e.data)
    iterationBase.current = { transcript: originalTranscript.current, prompt: generatedPrompt, mode }
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

8. Add `stopIterating` useCallback (depends on mode):
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
    saveToHistory({ transcript: iterText, prompt: genResult.prompt, mode, isIteration: true, basedOn: iterationBase.current.prompt.slice(0, 100) })
    transition(STATES.PROMPT_READY)
  }
}, [mode])
```

9. Add `dismissIterating` function (plain function, not useCallback):
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

10. In the JSX render, add IteratingState after PausedState:
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

11. Update PromptReadyState render to pass new props:
```jsx
<PromptReadyState
  originalTranscript={originalTranscript.current}
  generatedPrompt={generatedPrompt}
  setGeneratedPrompt={setGeneratedPrompt}
  onRegenerate={handleRegenerate}
  onReset={() => transition(STATES.IDLE)}
  mode={mode}
  onIterate={handleIterate}
  isIterated={isIterated.current}
/>
```

**Acceptance criteria**:
- [ ] ITERATING in STATES + STATE_HEIGHTS
- [ ] Traffic lights hidden when transitioning to ITERATING
- [ ] handleIterate starts MediaRecorder, saves iterationBase, transitions to ITERATING
- [ ] stopIterating transcribes → if empty → PROMPT_READY; else THINKING → Claude → PROMPT_READY
- [ ] isIterated.current = true set before transition(STATES.PROMPT_READY) in stopIterating
- [ ] originalTranscript.current = iterText set (so "You said" shows new transcript)
- [ ] dismissIterating stops MediaRecorder + returns to PROMPT_READY unchanged
- [ ] isIterated.current = false reset at start of stopRecording's onstop (fresh recording clears badge)
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Read App.jsx. Trace the ITERATING entry path. Trace the stop path. Confirm isIterated guard on fresh recording.
**Test requirement**: `npm run build:renderer` must succeed.
**⚠️ Boundaries**: Never mutate originalTranscript except in specific places. Never add runtime deps. Stale closure pattern: handleIterate + stopIterating are useCallback with correct deps.
**CODEBASE.md update?**: Yes — update App.jsx row, add iterationBase/isIterated/iterRecorderRef/iterChunksRef/iterIsProcessingRef to refs table, add ITERATING to state machine table.
**Architecture compliance**: useCallback with correct deps, useRef for all mutable state, transition() for all state changes.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ITR-004 · PromptReadyState.jsx — ↻ Iterate button + isIterated badge
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (items 1–2, 10, 12–13)
- **Dependencies**: ITR-003 (needs onIterate/isIterated props defined in App.jsx)
- **Touches**: `src/renderer/components/PromptReadyState.jsx`

**What to do**:

1. Add `onIterate` and `isIterated` to the component's prop destructuring.

2. In the TOP ROW div (the flex row containing Regenerate, Export, Reset), add the Iterate button FIRST (leftmost):
```jsx
<button
  onClick={onIterate}
  style={{
    fontSize: '11px',
    color: 'rgba(10,132,255,0.85)',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    letterSpacing: '0.01em',
  }}
>
  ↻ Iterate
</button>
```
Order in the flex gap row: ↻ Iterate · Regenerate · Export · Reset

3. In the status line (the left side of the top row — currently shows "✓ Prompt ready" or "Refinement prompt ready"), add the ↻ iterated badge after the text span, conditionally when `isIterated` is true:
```jsx
{isIterated && (
  <span style={{
    fontSize: '10px',
    color: 'rgba(10,132,255,0.6)',
    background: 'rgba(10,132,255,0.08)',
    border: '0.5px solid rgba(10,132,255,0.2)',
    borderRadius: '20px',
    padding: '1px 8px',
    letterSpacing: '.04em',
  }}>
    ↻ iterated
  </span>
)}
```

**Acceptance criteria**:
- [ ] ↻ Iterate button appears in blue, leftmost in top row button group
- [ ] Clicking ↻ Iterate calls onIterate
- [ ] ↻ iterated badge appears in status line when isIterated is true
- [ ] Badge does NOT appear when isIterated is false (fresh prompt)
- [ ] ↻ Iterate button remains visible when isIterated is true
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Read PromptReadyState.jsx. Confirm button order in the flex gap div. Confirm isIterated conditional rendering.
**Test requirement**: `npm run build:renderer` must succeed.
**⚠️ Boundaries**: No dangerouslySetInnerHTML. JSX text nodes only.
**CODEBASE.md update?**: No — PromptReadyState function signature change is minor, existing row sufficient.
**Architecture compliance**: JSX text nodes for all dynamic content. No localStorage access.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ITR-005 · history.js + HistoryPanel.jsx — isIteration fields + ↻ indicator
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#6-new-data-model-changes
- **Dependencies**: None (can be done in parallel with ITR-002 and ITR-003)
- **Touches**: `src/renderer/utils/history.js`, `src/renderer/components/HistoryPanel.jsx`

**What to do**:

**history.js:**
Update `saveToHistory` to accept and store optional `isIteration` and `basedOn` fields:
```js
export function saveToHistory({ transcript, prompt, mode, isIteration = false, basedOn = null }) {
  const history = getHistory()
  const words = transcript.split(' ')
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  const entry = { id: Date.now(), title, transcript, prompt, mode, timestamp: new Date().toISOString() }
  if (isIteration) entry.isIteration = true
  if (basedOn) entry.basedOn = basedOn
  history.unshift(entry)
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}
```

Note: only add `isIteration` and `basedOn` to the entry object when truthy — keeps existing entries clean.

**HistoryPanel.jsx:**
Find the meta row (contains mode span + timestamp span). After the mode span, add:
```jsx
{entry.isIteration && (
  <span style={{fontSize:'9px', color:'rgba(10,132,255,0.5)', marginLeft:'4px'}}>↻</span>
)}
```

**Acceptance criteria**:
- [ ] saveToHistory called with `{ isIteration: true, basedOn: '...' }` stores both fields on entry
- [ ] saveToHistory called WITHOUT isIteration/basedOn stores neither field (no undefined pollution)
- [ ] ↻ indicator appears in HistoryPanel list item when `entry.isIteration` is true
- [ ] ↻ indicator does NOT appear for normal (non-iteration) entries
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Read history.js — confirm default params. Read HistoryPanel.jsx — confirm conditional renders after mode span.
**Test requirement**: `npm run build:renderer` must succeed.
**⚠️ Boundaries**: All localStorage access through history.js exports only — never `localStorage.*` directly.
**CODEBASE.md update?**: Yes — update localStorage keys table to document isIteration + basedOn fields.
**Architecture compliance**: localStorage only via utils/history.js per ARCHITECTURE.md.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ITR-006 · CODEBASE.md + ARCHITECTURE.md + DECISIONS.md + smoke test
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#10-conformance-checklist
- **Dependencies**: ITR-001, ITR-002, ITR-003, ITR-004, ITR-005
- **Touches**: `vibe/CODEBASE.md`, `vibe/ARCHITECTURE.md`, `vibe/DECISIONS.md`

**What to do**:

1. **vibe/CODEBASE.md** — update these sections:
   - File map: add IteratingState.jsx row
   - IPC channels: add generate-raw row
   - React state + refs: add iterationBase, isIterated, iterRecorderRef, iterChunksRef, iterIsProcessingRef
   - State machine table: add ITERATING row (height 200, traffic lights hidden)
   - preload.js row: add generateRaw to the methods list
   - localStorage keys: note isIteration + basedOn fields on promptly_history entries

2. **vibe/ARCHITECTURE.md** — add generate-raw to IPC surface table:
   `| renderer → main | generate-raw | Full custom system prompt passthrough → Claude; returns { success, prompt } |`

3. **vibe/DECISIONS.md** — append:
```
---
## FEATURE-012 — Iteration Mode — 2026-04-20
> Folder: vibe/features/2026-04-20-iteration-mode/
> Allows users to refine a generated prompt by speaking a new voice input.
> The original prompt + new transcript are combined into an iteration system prompt and sent to Claude.
> Tasks: ITR-001 through ITR-006 | Estimated: 6–9 hours

**D-ITER-001** — generate-raw IPC added
Why: generate-prompt IPC constructs system prompt from MODE_CONFIG in main.js; iteration needs
     to pass a fully pre-built system prompt from the renderer. generate-raw is the minimal new
     surface — takes systemPrompt string, same timeout/error pattern as generate-prompt.

**D-ITER-002** — ITERATING state added (not a mode)
Why: Iteration is a refinement flow on top of existing modes, not a new mode. A new state was
     required to show the blue recording UI without conflicting with RECORDING state.

**D-ITER-003** — originalTranscript.current updated to iterText on successful iteration
Why: "You said" in PROMPT_READY should show what the user LAST said (the iteration input),
     not the original recording. The original prompt content is preserved in iterationBase.current.
     If user regenerates after iteration, they re-generate from the latest transcript.
---
```

4. **Run manual smoke test** with this checklist:
   - [ ] ↻ Iterate button appears in blue in PROMPT_READY top row
   - [ ] Tapping Iterate shows blue context banner with previous transcript
   - [ ] Blue waveform animates immediately on entering ITERATING state
   - [ ] Timer ticks correctly from 0:00
   - [ ] Stop sends audio to Whisper then combined prompt to Claude
   - [ ] Claude returns improved prompt preserving original structure
   - [ ] Result shows in PROMPT_READY with ↻ iterated badge
   - [ ] Dismiss returns to original PROMPT_READY unchanged
   - [ ] ↻ indicator shows on iteration entries in history
   - [ ] Multiple iterations work — badge stays, can iterate again
   - [ ] Traffic lights hidden during ITERATING

**Acceptance criteria**:
- [ ] CODEBASE.md updated: IteratingState.jsx, generate-raw, ITERATING state, new refs
- [ ] ARCHITECTURE.md IPC table updated with generate-raw
- [ ] DECISIONS.md has FEATURE-012 entry with D-ITER-001/002/003
- [ ] Manual smoke test: all 11 items pass
- [ ] lint: `npm run lint` — 0 errors

**Self-verify**: Read CODEBASE.md IPC table. Confirm generate-raw row present. Read ARCHITECTURE.md IPC table. Confirm generate-raw row. Read DECISIONS.md. Confirm FEATURE-012 entry.
**Test requirement**: Manual smoke test all 11 items. lint 0 errors.
**⚠️ Boundaries**: Docs only in this task — no code changes.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: DECISIONS.md append-only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-012 Iteration Mode
> Tick after every task. All items ✅ before feature is shippable.
- [ ] ↻ Iterate button appears in blue, leftmost in top row
- [ ] ITERATING state: blue banner + blue waveform + timer + blue glow stop
- [ ] Traffic lights hidden during ITERATING
- [ ] Dismiss returns to unchanged PROMPT_READY (no transcript/prompt mutation)
- [ ] Combined system prompt builds correctly with original prompt + new transcript
- [ ] Empty Whisper result → silent return to PROMPT_READY
- [ ] isIteration entries saved to history with correct shape
- [ ] ↻ indicator in HistoryPanel list
- [ ] generate-raw IPC in main.js + preload.js
- [ ] iterGlow keyframe in index.css
- [ ] Multiple iterations work in sequence
- [ ] `npm run lint` 0 errors
- [ ] `npm run build:renderer` succeeds
- [ ] Manual smoke test: all 11 items pass
