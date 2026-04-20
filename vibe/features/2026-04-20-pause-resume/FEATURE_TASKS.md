# FEATURE_TASKS.md — FEATURE-011: Pause and Resume Recording
> Created: 2026-04-20 | Folder: vibe/features/2026-04-20-pause-resume/

> **Estimated effort:** 3 tasks — S: 1, M: 2 — approx. 3-4 hours total

---

### PAUZ-001 · Core state, timer, pause/resume logic
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#5-integration-points
- **Dependencies**: None
- **Touches**: `src/renderer/App.jsx`, `preload.js`

**What to do**:
1. In App.jsx — add to STATES: `PAUSED: 'PAUSED'`
2. In App.jsx — add to STATE_HEIGHTS: `PAUSED: 89`
3. In App.jsx — add refs: `const isPausedRef = useRef(false)`, `const recTimerRef = useRef(null)`
4. In App.jsx — add state: `const [recSecs, setRecSecs] = useState(0)`
5. In App.jsx — add timer helpers (plain functions, not useCallback — called from callbacks):
   ```js
   function startTimer() { recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000) }
   function pauseTimer() { clearInterval(recTimerRef.current); recTimerRef.current = null }
   function stopTimer() { clearInterval(recTimerRef.current); recTimerRef.current = null; setRecSecs(0) }
   ```
6. In startRecording: call `startTimer()` immediately after `transition(STATES.RECORDING)`
7. In stopRecording: call `stopTimer()` before the `recorder.stop()` line (so timer clears even if onstop is async)
8. In handleDismiss: call `stopTimer()` and set `isPausedRef.current = false` before `transition(STATES.IDLE)`
9. Add pauseRecording (useCallback):
   ```js
   const pauseRecording = useCallback(() => {
     const recorder = mediaRecorderRef.current
     if (recorder && recorder.state === 'recording') {
       pauseTimer()
       recorder.pause()
       isPausedRef.current = true
       transition(STATES.PAUSED)
     }
   }, [])
   ```
10. Add resumeRecording (useCallback):
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
11. Add stable refs for pause/resume (matching startRecordingRef pattern):
    ```js
    const pauseRecordingRef = useRef(pauseRecording)
    const resumeRecordingRef = useRef(resumeRecording)
    useEffect(() => { pauseRecordingRef.current = pauseRecording }, [pauseRecording])
    useEffect(() => { resumeRecordingRef.current = resumeRecording }, [resumeRecording])
    ```
12. In transition(): update setWindowButtonsVisible line to also hide for PAUSED:
    ```js
    window.electronAPI.setWindowButtonsVisible(newState !== STATES.RECORDING && newState !== STATES.PAUSED)
    ```
13. In the IPC useEffect (where onShortcutTriggered is registered) — add:
    ```js
    window.electronAPI.onShortcutPause(() => {
      if (stateRef.current === STATES.RECORDING) pauseRecordingRef.current()
      else if (stateRef.current === STATES.PAUSED) resumeRecordingRef.current()
    })
    ```
14. In preload.js — add to the contextBridge object:
    ```js
    onShortcutPause: (callback) =>
      ipcRenderer.on('shortcut-pause', () => callback()),
    ```

**Acceptance criteria**:
- [ ] PAUSED exists in STATES and STATE_HEIGHTS
- [ ] Timer counts up from 0 when recording starts
- [ ] pauseRecording() transitions to PAUSED + clears interval
- [ ] resumeRecording() transitions to RECORDING + restarts interval from current recSecs
- [ ] stopRecording() resets recSecs to 0
- [ ] handleDismiss() resets recSecs to 0
- [ ] Alt+P toggles pause↔resume via stateRef guard
- [ ] Traffic lights hidden in PAUSED state

**Self-verify**: Confirm STATES.PAUSED, STATE_HEIGHTS.PAUSED, timer functions, and onShortcutPause all present. Verify transition() hides traffic lights for both RECORDING and PAUSED.
**Test requirement**: Manual smoke — confirm timer increments during recording, pauses on pause, resumes from same count on resume.
**⚠️ Boundaries**: Do not add any new IPC channel — `shortcut-pause` channel exists; only `onShortcutPause` method is missing from preload.js.
**CODEBASE.md update?**: No — done in PAUZ-003.
**Architecture compliance**: useCallback for pauseRecording/resumeRecording; stable refs pattern (matches startRecordingRef); IPC handlers in single useEffect with empty dep array.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PAUZ-002 · RecordingState.jsx pause button + PausedState.jsx + index.css
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: PAUZ-001
- **Touches**: `src/renderer/components/RecordingState.jsx`, `src/renderer/components/PausedState.jsx` (new), `src/renderer/index.css`

**What to do**:

**RecordingState.jsx:**
1. Remove internal timer: delete `useState(0)` and its `useEffect` entirely
2. Accept new props: `duration` (string, e.g. "0:00"), `onPause` (function)
3. Replace the timer `<span>` content with `{duration}` from props
4. Add pause button between the timer span and the stop button, using the exact inline styles from the spec:
   ```jsx
   <div onClick={onPause} style={{
     width:'32px', height:'32px', borderRadius:'50%',
     background:'rgba(255,189,46,0.12)',
     border:'0.5px solid rgba(255,189,46,0.3)',
     display:'flex', alignItems:'center', justifyContent:'center',
     cursor:'pointer', flexShrink:0, WebkitAppRegion:'no-drag',
     animation:'pauseGlow 2s ease-in-out infinite'
   }}>
     <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
       <rect x="1" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)"/>
       <rect x="6" y="1" width="3" height="10" rx="1" fill="rgba(255,189,46,0.9)"/>
     </svg>
   </div>
   ```

**PausedState.jsx (new file):**
Create `src/renderer/components/PausedState.jsx` with:
- Props: `duration`, `onResume`, `onStop`, `onDismiss`
- Height: 89px total — same as RECORDING
- Layout row (68px): dismiss X | flat amber line | amber timer | resume ▶ button | red stop ■ button
- Divider line below (same as RecordingState)
- Status row below divider: amber dot + "Paused — tap resume to continue"
- All styles inline for the amber elements; Tailwind ok for structural classes (same as RecordingState)

Full JSX:
```jsx
import React from 'react'

const PAD = { paddingLeft: 32, paddingRight: 32 }

export default function PausedState({ duration, onResume, onStop, onDismiss }) {
  return (
    <div id="panel-paused" className="relative z-[1]">
      <div className="h-[13px] [-webkit-app-region:drag]" />
      <div className="h-[68px] flex items-center gap-3 [-webkit-app-region:drag]" style={PAD}>
        {/* Dismiss */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] hover:bg-white/[0.12] transition-colors duration-150"
          style={{background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)'}}
          onClick={onDismiss}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Flat amber line */}
        <div className="flex-1 flex items-center h-9 [-webkit-app-region:no-drag]">
          <div style={{
            width:'100%', height:'1.5px',
            background:'linear-gradient(90deg, transparent, rgba(255,189,46,0.45) 20%, rgba(255,189,46,0.45) 80%, transparent)',
            borderRadius:'2px'
          }}/>
        </div>
        {/* Timer — amber */}
        <span
          className="text-[11px] font-medium tracking-[0.06em] flex-shrink-0 min-w-[28px] text-right tabular-nums [-webkit-app-region:no-drag]"
          style={{color:'rgba(255,189,46,0.7)'}}
        >
          {duration}
        </span>
        {/* Resume button */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag]"
          style={{
            background:'rgba(255,189,46,0.15)',
            border:'1px solid rgba(255,189,46,0.4)',
            animation:'pauseGlow 2s ease-in-out infinite'
          }}
          onClick={onResume}
        >
          <svg width="10" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 1L10 6L2 11V1Z" fill="rgba(255,189,46,0.9)"/>
          </svg>
        </div>
        {/* Stop button */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0 [-webkit-app-region:no-drag] [animation:stop-glow_2s_ease-in-out_infinite]"
          style={{background:'#FF3B30'}}
          onClick={onStop}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="white"/>
          </svg>
        </div>
      </div>
      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" style={{marginLeft:32, marginRight:32}} />
      {/* Status row */}
      <div style={{padding:'10px 18px 12px', display:'flex', alignItems:'center', gap:'8px'}}>
        <div style={{width:'6px', height:'6px', borderRadius:'50%', background:'#FFBD2E', flexShrink:0}}/>
        <span style={{fontSize:'12px', color:'rgba(255,189,46,0.65)', letterSpacing:'.02em'}}>
          Paused — tap resume to continue
        </span>
      </div>
    </div>
  )
}
```

**index.css:**
Add `@keyframes pauseGlow` and register `--animate-pause-glow` in `@theme`:
```css
@theme {
  /* existing entries ... */
  --animate-pause-glow: pauseGlow 2s ease-in-out infinite;
}
@keyframes pauseGlow {
  0%,100% { box-shadow: 0 0 10px rgba(255,189,46,0.3); }
  50% { box-shadow: 0 0 20px rgba(255,189,46,0.65); }
}
```

**Acceptance criteria**:
- [ ] RecordingState shows dismiss | waveform | timer | pause button | stop button (5 items)
- [ ] Pause button has amber ⏸ icon with glow animation
- [ ] Timer in RecordingState uses `duration` prop (not internal state)
- [ ] PausedState shows dismiss | amber line | amber timer | resume button | stop button
- [ ] Resume button has amber ▶ icon with glow animation
- [ ] Status row visible below divider in PausedState
- [ ] pauseGlow keyframe present in index.css

**Self-verify**: Check RecordingState has no useState/useEffect for timer. Check PausedState renders flat line (not canvas). Check all 5 buttons are present in each state.
**Test requirement**: Visual smoke — recording state shows 5 elements; paused state shows amber line + status text.
**⚠️ Boundaries**: Never dangerouslySetInnerHTML. Keep `[-webkit-app-region:drag/no-drag]` on all interactive elements.
**CODEBASE.md update?**: No — done in PAUZ-003.
**Architecture compliance**: JSX text nodes only, inline styles for amber-specific values, Tailwind classes for structural layout.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PAUZ-003 · Wire PAUSED render in App.jsx + CODEBASE.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: PAUZ-001, PAUZ-002
- **Touches**: `src/renderer/App.jsx`, `vibe/CODEBASE.md`

**What to do**:
1. Import PausedState in App.jsx: `import PausedState from './components/PausedState.jsx'`
2. Add duration formatting (place near stopRecording or at top of App function body):
   ```js
   const m = Math.floor(recSecs / 60)
   const s = recSecs % 60
   const duration = `${m}:${String(s).padStart(2, '0')}`
   ```
3. Pass `duration` and `onPause` to RecordingState:
   ```jsx
   <RecordingState onStop={stopRecording} onDismiss={handleDismiss} onPause={pauseRecording} duration={duration} />
   ```
4. Add PAUSED render after RECORDING:
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
5. Update CODEBASE.md:
   - File map: add `| src/renderer/components/PausedState.jsx | PAUSED state panel — dismiss, amber flat line, amber timer, resume + stop buttons, status text | props: duration, onResume, onStop, onDismiss |`
   - State machine table: add PAUSED row `| PAUSED | PausedState | 89px | Amber flat line, timer, resume/stop; traffic lights hidden |`
   - React state + refs: add `recSecs`, `recTimerRef`, `isPausedRef`
   - IPC channels: update shortcut-pause row description from "stub" to "wired — pause/resume toggle"
   - preload.js exports: add `onShortcutPause`
   - App.jsx key exports: add `pauseRecording()`, `resumeRecording()`

**Acceptance criteria**:
- [ ] App.jsx imports PausedState
- [ ] `{currentState === STATES.PAUSED && <PausedState ... />}` present
- [ ] RecordingState receives onPause and duration props
- [ ] CODEBASE.md reflects all new additions

**Self-verify**: Run `npm run lint`. Check CODEBASE.md has PausedState.jsx in file map and PAUSED in state machine table.
**Test requirement**: Full smoke test checklist below — all 11 items pass.
**⚠️ Boundaries**: No code changes beyond wiring — PAUZ-001 and PAUZ-002 handle all logic and components.
**CODEBASE.md update?**: Yes — file map, state machine, refs, IPC, preload sections.
**Architecture compliance**: PAUSED state follows same conditional render pattern as all other states in App.jsx.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

## Smoke checklist (run after PAUZ-003)

- [ ] Recording state shows three buttons: dismiss (X), pause (amber ⏸), stop (red ■)
- [ ] Tapping pause freezes waveform to flat amber line
- [ ] Timer color turns amber when paused
- [ ] Status message shows "Paused — tap resume to continue"
- [ ] Pause button becomes amber play/resume button in PAUSED state
- [ ] Tapping resume restores red waveform animation
- [ ] Timer continues from paused time, does not reset
- [ ] Tapping stop after pause sends all audio chunks (pre + post pause) to Whisper
- [ ] Transcript accumulates correctly across pause/resume cycles
- [ ] Alt+P global shortcut toggles pause/resume
- [ ] Dismiss (X) cancels recording from both RECORDING and PAUSED states

---

#### Conformance: FEATURE-011 Pause and Resume
> Tick after every task. All items ✅ before feature is shippable.
- [ ] All 11 acceptance criteria from FEATURE_SPEC.md checked
- [ ] All smoke checklist items pass
- [ ] Lint clean (npm run lint)
- [ ] No regressions in RECORDING → THINKING → PROMPT_READY flow
- [ ] No regressions in HISTORY, SHORTCUTS, IDLE flows
- [ ] CODEBASE.md updated (PAUZ-003)
- [ ] DECISIONS.md entry written
