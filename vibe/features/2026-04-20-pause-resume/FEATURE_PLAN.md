# FEATURE_PLAN.md — FEATURE-011: Pause and Resume Recording
> Created: 2026-04-20

---

## 1. Impact map

**Files to modify:**
- `preload.js` — add `onShortcutPause` method
- `src/renderer/App.jsx` — PAUSED state, timer logic, pauseRecording, resumeRecording, onShortcutPause, render PausedState
- `src/renderer/components/RecordingState.jsx` — pause button, accept duration+onPause props, remove internal timer
- `src/renderer/index.css` — add @keyframes pauseGlow

**Files to create:**
- `src/renderer/components/PausedState.jsx` — new PAUSED state component

**Files explicitly out of scope:**
- `main.js` — Alt+P already registered, shortcut-pause already sent (no changes)
- `src/renderer/components/WaveformCanvas.jsx` — unchanged
- `src/renderer/components/ThinkingState.jsx` — unchanged
- `src/renderer/components/PromptReadyState.jsx` — unchanged
- `src/renderer/components/ErrorState.jsx` — unchanged
- `src/renderer/components/ShortcutsPanel.jsx` — unchanged
- `src/renderer/components/HistoryPanel.jsx` — unchanged
- `src/renderer/hooks/useMode.js` — unchanged
- `src/renderer/hooks/useWindowResize.js` — unchanged
- `src/renderer/utils/history.js` — unchanged
- `vite.config.js` — unchanged
- `package.json` — unchanged

---

## 2. Backend changes

None — this feature is renderer-only. main.js already sends `shortcut-pause`.

---

## 3. Frontend changes

### App.jsx

**Add to STATES:**
```js
PAUSED: 'PAUSED',
```

**Add to STATE_HEIGHTS:**
```js
PAUSED: 89,
```

**Add refs:**
```js
const isPausedRef = useRef(false)
const recTimerRef = useRef(null)
```

**Add state:**
```js
const [recSecs, setRecSecs] = useState(0)
```

**Add timer helpers:**
```js
function startTimer() {
  recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
}
function pauseTimer() {
  clearInterval(recTimerRef.current)
  recTimerRef.current = null
}
function stopTimer() {
  clearInterval(recTimerRef.current)
  recTimerRef.current = null
  setRecSecs(0)
}
```

**Update startRecording:** call `startTimer()` after `transition(STATES.RECORDING)`

**Update stopRecording:** call `stopTimer()` before transitioning to THINKING

**Update handleDismiss:** call `stopTimer()` and set `isPausedRef.current = false`

**Add pauseRecording:**
```js
const pauseRecording = useCallback(() => {
  const recorder = mediaRecorderRef.current
  if (recorder && recorder.state === 'recording') {
    recorder.pause()
    isPausedRef.current = true
    pauseTimer()
    transition(STATES.PAUSED)
  }
}, [])
```

**Add resumeRecording:**
```js
const resumeRecording = useCallback(() => {
  const recorder = mediaRecorderRef.current
  if (recorder && recorder.state === 'paused') {
    recorder.resume()
    isPausedRef.current = false
    startTimer()
    transition(STATES.RECORDING)
  }
}, [])
```

**Update transition():** hide traffic lights for PAUSED too:
```js
window.electronAPI.setWindowButtonsVisible(
  newState !== STATES.RECORDING && newState !== STATES.PAUSED
)
```

**Add onShortcutPause in IPC useEffect:**
```js
window.electronAPI.onShortcutPause(() => {
  if (stateRef.current === STATES.RECORDING) pauseRecordingRef.current()
  else if (stateRef.current === STATES.PAUSED) resumeRecordingRef.current()
})
```
(Use stable refs like pauseRecordingRef/resumeRecordingRef matching the startRecordingRef pattern)

**Format duration string in App.jsx** (for passing to child components):
```js
const m = Math.floor(recSecs / 60)
const s = recSecs % 60
const duration = `${m}:${String(s).padStart(2, '0')}`
```

**Render PausedState:**
```jsx
{currentState === STATES.PAUSED && (
  <PausedState
    duration={duration}
    onResume={resumeRecording}
    onStop={stopRecording}
    onDismiss={handleDismiss}
  />
)}
```

**Pass props to RecordingState:**
```jsx
<RecordingState onStop={stopRecording} onDismiss={handleDismiss} onPause={pauseRecording} duration={duration} />
```

### RecordingState.jsx

- Remove internal `useState(0)` + `useEffect` timer — timer now comes from App.jsx as `duration` prop
- Accept `onPause` and `duration` props
- Add pause button (amber) between timer and stop button
- All layout: keep existing Tailwind for structure, add pause button with inline styles for amber color

### PausedState.jsx (new)

Layout mirrors RecordingState but with amber palette:
- Same 89px height, same padding, same divider
- Waveform replaced by flat amber gradient line
- Timer in amber color
- Pause button (⏸) becomes resume button (▶)
- Status row below divider: amber dot + "Paused — tap resume to continue"
- Props: `duration`, `onResume`, `onStop`, `onDismiss`

### index.css

Add `@keyframes pauseGlow` and register in `@theme`:
```css
@keyframes pauseGlow {
  0%,100% { box-shadow: 0 0 10px rgba(255,189,46,0.3); }
  50% { box-shadow: 0 0 20px rgba(255,189,46,0.65); }
}
```

### preload.js

```js
onShortcutPause: (callback) =>
  ipcRenderer.on('shortcut-pause', () => callback()),
```

---

## 4. Task breakdown

| Task | Size | What |
|------|------|------|
| PAUZ-001 | M | Core state + timer + pause/resume in App.jsx + preload.js |
| PAUZ-002 | M | RecordingState.jsx pause button + PausedState.jsx + index.css |
| PAUZ-003 | S | Wire PAUSED render in App.jsx + CODEBASE.md update |

---

## 5. Rollback plan

- Revert `preload.js` onShortcutPause addition
- Revert App.jsx to remove PAUSED from STATES/STATE_HEIGHTS, remove timer lift, remove pause/resume functions
- Revert RecordingState.jsx to internal timer, remove onPause/duration props
- Delete PausedState.jsx
- Remove pauseGlow from index.css

---

## 6. Testing strategy

Manual smoke test checklist (11 items) in FEATURE_TASKS.md.
No existing tests to update (project uses manual smoke testing per ARCHITECTURE.md).

---

## 7. CODEBASE.md sections to update (PAUZ-003)

- State machine table: add PAUSED row (89px, same as RECORDING)
- React state + refs: add recSecs, recTimerRef, isPausedRef
- File map: add PausedState.jsx
- IPC channels: update shortcut-pause from "stub" to "wired — pause/resume toggle"
- preload.js exports: add onShortcutPause
