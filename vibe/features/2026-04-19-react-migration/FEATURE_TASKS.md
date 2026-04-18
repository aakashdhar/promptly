# FEATURE_TASKS.md — FEATURE-004: React Migration
> Folder: vibe/features/2026-04-19-react-migration/
> Date: 2026-04-19

> **Estimated effort:** 14 tasks — S: 8 (<2hrs each), M: 6 (2-4hrs each) — approx. 20-24 hours total

---

### FCR-001 · Branch + install devDeps
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#8
- **Dependencies**: None
- **Touches**: `package.json` (devDeps added)

**What to do**:
1. `git checkout -b feat/react-migration`
2. `npm install --save-dev vite @vitejs/plugin-react react react-dom`
3. Verify package.json devDependencies now includes all four packages

**Acceptance criteria**:
- [ ] Branch `feat/react-migration` exists and is checked out
- [ ] `package.json` devDependencies includes: `vite`, `@vitejs/plugin-react`, `react`, `react-dom`
- [ ] `npm install` completes without errors

**Self-verify**: `git branch` shows feat/react-migration; `cat package.json` shows 4 new devDeps.
**Test requirement**: None — build tooling only.
**⚠️ Boundaries**: devDependencies ONLY — never dependencies (runtime).
**CODEBASE.md update?**: No — just deps change.
**Architecture compliance**: Zero runtime npm dependencies maintained (devDeps are bundled, not shipped as node_modules).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-002 · vite.config.js + package.json scripts + electron-builder files config
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#8, FEATURE_PLAN.md#3
- **Dependencies**: FCR-001
- **Touches**: `vite.config.js` (new), `package.json` (scripts + build.files)

**What to do**:
1. Create `vite.config.js` at project root:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  root: 'src/renderer',
})
```
2. Add to `package.json` scripts (keep existing `start`, `dist`, `lint`):
   - `"dev": "vite"`
   - `"build:renderer": "vite build"`
   - `"start:react": "npm run build:renderer && electron ."`
3. Update `package.json` `build.files` to include dist-renderer:
   ```json
   "files": ["main.js", "preload.js", "dist-renderer/**", "splash.html", "package.json"]
   ```

**Acceptance criteria**:
- [ ] `vite.config.js` exists at project root with correct outDir + root settings
- [ ] `package.json` has `dev`, `build:renderer`, `start:react` scripts
- [ ] `package.json` build.files includes `dist-renderer/**`

**Self-verify**: Read vite.config.js and package.json to confirm.
**Test requirement**: `npm run build:renderer` should fail gracefully (src/renderer doesn't exist yet) — not a blocker.
**⚠️ Boundaries**: Do not add `splash.html` to Vite's root — it must stay at project root.
**CODEBASE.md update?**: No — build config change only.
**Architecture compliance**: No new runtime deps. Vite is build-time only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-003 · src/renderer folder structure + index.html + main.jsx
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#1
- **Dependencies**: FCR-002
- **Touches**: `src/renderer/index.html` (new), `src/renderer/main.jsx` (new), folder structure

**What to do**:
1. Create full folder structure:
```
src/renderer/
  index.html
  main.jsx
  App.jsx             (empty placeholder — filled in FCR-006)
  hooks/
    useMode.js        (empty — filled in FCR-005)
    useWindowResize.js (empty — filled in FCR-005)
  components/
    IdleState.jsx     (empty — filled in FCR-007)
    RecordingState.jsx (empty — filled in FCR-008)
    ThinkingState.jsx  (empty — filled in FCR-009)
    PromptReadyState.jsx (empty — filled in FCR-010)
    ErrorState.jsx    (empty — filled in FCR-011)
    WaveformCanvas.jsx (empty — filled in FCR-008)
    MorphCanvas.jsx   (empty — filled in FCR-009)
  styles/
    tokens.css        (empty — filled in FCR-004)
    bar.css           (empty — filled in FCR-004)
    states.css        (empty — filled in FCR-004)
```

2. `src/renderer/index.html` — Vite entry point:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Promptly</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root {
      margin: 0 !important; padding: 0 !important;
      background: transparent !important;
      background-color: transparent !important;
      overflow: hidden !important;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; -webkit-font-smoothing: antialiased; user-select: none; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.jsx"></script>
</body>
</html>
```

3. `src/renderer/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

4. All other files: create as empty files (will be filled in subsequent tasks). Use `export default function Placeholder() { return null }` for component files, and `export {}` for hook/CSS files.

**Acceptance criteria**:
- [ ] All folders and files exist
- [ ] `src/renderer/index.html` has `<div id="root">` and script tag
- [ ] `src/renderer/main.jsx` renders `<App />`
- [ ] Empty placeholder exports exist in all component/hook files

**Self-verify**: `ls -la src/renderer/` and subdirs.
**Test requirement**: `npm run build:renderer` should now run Vite (may fail if App.jsx is wrong — check).
**CODEBASE.md update?**: No — structure only, filled in FCR-014.
**Architecture compliance**: `index.html` is minimal — no inline styles beyond body/root transparency.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-004 · CSS migration: tokens.css + bar.css + states.css
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#5
- **Dependencies**: FCR-003
- **Touches**: `src/renderer/styles/tokens.css`, `src/renderer/styles/bar.css`, `src/renderer/styles/states.css`

**What to do**:
Extract all CSS from `index.html` `<style>` block and split into three files:

**tokens.css** — `:root` vars + `body.light` overrides:
- The `:root { }` block (all `--*` variables)
- `body.light { }` block with all light-mode token overrides
- All `body.light .classname` rules (ready-title, mode-pill, pr-btn, ys-label, etc.)

**bar.css** — The `.bar` glass container:
- `.bar { }` with width, min-height, border-radius, backdrop-filter, box-shadow, etc.
- `.bar::before { }` (frosted tint layer)
- `.bar::after { }` (accent bottom gradient)
- `#panel-idle, #panel-recording, #panel-thinking, #panel-ready, #panel-error { position: relative; z-index: 1; }`
- Also the `#app, #root, .app, .container, .wrapper { background: transparent !important }` rule

**states.css** — Everything else: per-state layout CSS, animations, all component styles.
This includes: `.traf`, `.div-line`, `.mode-pill`, `.cr-idle`, `.pulse-ring`, `@keyframes pulse-expand`, `.ready-text`, `.ready-title`, `.ready-sub`, `.cr-think`, `.status-badge`, `.status-dot`, `.morph-wrap`, `.ys-label-s`, `.ys-text-s`, `.top-row`, `.pr-status`, `.pr-check`, `.pr-actions`, `.pr-btn`, `.you-said-block`, `.ys-label`, `.ys-text`, `.inner-div`, `.prompt-out`, `.pt-sl`, `.btn-row`, `.btn-edit`, `.btn-copy`, `.cr-rec`, `.dismiss-btn`, `.wave-wrap`, `.rec-dur`, `.stop-btn`, `@keyframes stop-glow`, `.rec-div-line`, `.transcript-wrap`, `.transcript-text`, `.cursor-b`, `.cr-error`, `.error-badge`, and all `@keyframes`.

Copy each rule EXACTLY as-is from index.html. Do not rename, modify, or reformat.

**Acceptance criteria**:
- [ ] `tokens.css` contains `:root {}` and `body.light {}` blocks
- [ ] `bar.css` contains `.bar`, `.bar::before`, `.bar::after`
- [ ] `states.css` contains all per-state CSS + all @keyframes
- [ ] No CSS from `index.html` is missing across the three files combined

**Self-verify**: Read all three files. Search for `.pulse-ring`, `.btn-copy`, `.stop-btn` — all must be in states.css.
**Test requirement**: After FCR-006, `npm run build:renderer` must produce un-errored CSS output.
**⚠️ Boundaries**: Copy CSS exactly — do not refactor or rename classes. Components use the same class names.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: CSS custom properties (`--var`) pattern preserved exactly.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-005 · useMode.js + useWindowResize.js hooks
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#5
- **Dependencies**: FCR-003
- **Touches**: `src/renderer/hooks/useMode.js`, `src/renderer/hooks/useWindowResize.js`

**What to do**:

**useMode.js**:
```js
import { useState } from 'react'

const MODE_LABELS = {
  balanced: 'Balanced', detailed: 'Detailed', concise: 'Concise',
  chain: 'Chain', code: 'Code', design: 'Design',
}

export default function useMode() {
  const [mode, setModeState] = useState(() => localStorage.getItem('mode') || 'balanced')

  function setMode(m) {
    localStorage.setItem('mode', m)
    setModeState(m)
  }

  const modeLabel = MODE_LABELS[mode] || 'Balanced'
  return { mode, setMode, modeLabel }
}
```

**useWindowResize.js**:
```js
export default function useWindowResize() {
  function resizeWindow(height) {
    requestAnimationFrame(() => {
      if (window.electronAPI) window.electronAPI.resizeWindow(height)
    })
  }
  return { resizeWindow }
}
```

**Acceptance criteria**:
- [ ] `useMode` returns `{ mode, setMode, modeLabel }`
- [ ] `setMode` writes to `localStorage.getItem('mode')` and updates React state
- [ ] `useWindowResize` returns `{ resizeWindow }` that wraps in requestAnimationFrame
- [ ] Both hooks use `window.electronAPI` guards (won't crash outside Electron)

**Self-verify**: Read both files.
**Test requirement**: Used in App.jsx — integration tested via FCR-006.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: localStorage accessed via wrappers (hook = wrapper pattern).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-006 · App.jsx: state machine core
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3, FEATURE_PLAN.md#5
- **Dependencies**: FCR-004, FCR-005
- **Touches**: `src/renderer/App.jsx`

**What to do**:
Write the complete App.jsx. It must:

1. Import all CSS files: `import './styles/tokens.css'`, `'./styles/bar.css'`, `'./styles/states.css'`
2. Import hooks: `useMode`, `useWindowResize`
3. Import all 5 state components (may be placeholders still)

4. Define constants:
```jsx
const STATES = { IDLE:'IDLE', RECORDING:'RECORDING', THINKING:'THINKING', PROMPT_READY:'PROMPT_READY', ERROR:'ERROR' }
const STATE_HEIGHTS = { IDLE:101, RECORDING:89, THINKING:320, PROMPT_READY:540, ERROR:101 }
```

5. State vars:
```jsx
const [currentState, setCurrentState] = useState(STATES.IDLE)
const [generatedPrompt, setGeneratedPrompt] = useState('')
const [errorMessage, setErrorMessage] = useState('')
const originalTranscript = useRef('')
const stateRef = useRef(STATES.IDLE)  // stale-closure-safe state for IPC callbacks
const mediaRecorderRef = useRef(null)
const audioChunksRef = useRef([])
const isProcessingRef = useRef(false)
```

6. `transition(newState, payload)` function:
```jsx
function transition(newState, payload = {}) {
  stateRef.current = newState
  setCurrentState(newState)
  if (payload.message) setErrorMessage(payload.message)
  resizeWindow(STATE_HEIGHTS[newState])
  if (newState === STATES.RECORDING) {
    if (window.electronAPI) window.electronAPI.setWindowButtonsVisible(false)
  } else {
    if (window.electronAPI) window.electronAPI.setWindowButtonsVisible(true)
  }
}
```

7. `startRecording()` async function using navigator.mediaDevices.getUserMedia + MediaRecorder

8. `stopRecording()` async function:
- Guard isProcessingRef
- Stop MediaRecorder
- blob → arrayBuffer → transition(THINKING)
- transcribeAudio IPC
- Set originalTranscript.current (ONCE — never again)
- generatePrompt IPC
- setGeneratedPrompt + transition(PROMPT_READY)
- Call saveToHistory (FCR-013 wires this)

9. `handleRegenerate()` async:
- transition(THINKING)
- generatePrompt(originalTranscript.current, mode)
- setGeneratedPrompt + transition(PROMPT_READY)

10. IPC useEffect (runs once on mount):
```jsx
useEffect(() => {
  if (!window.electronAPI) return
  window.electronAPI.getTheme().then(({ dark }) => {
    document.body.classList.toggle('light', !dark)
  })
  window.electronAPI.onThemeChanged(({ dark }) => {
    document.body.classList.toggle('light', !dark)
  })
  window.electronAPI.onShortcutTriggered(() => {
    if (stateRef.current === STATES.IDLE) startRecording()
    else if (stateRef.current === STATES.RECORDING) stopRecording()
  })
  window.electronAPI.onModeSelected((key) => {
    setMode(key)
  })
}, [])
```
Note: `startRecording` and `stopRecording` must be stable refs (use useCallback or useRef to store them) to avoid stale closures in the IPC handler.

11. Render: `.bar` div wrapping conditional component render based on `currentState`.

12. Pass all necessary props to each component:
- IdleState: `mode`, `modeLabel`, `onStart=startRecording`
- RecordingState: `onStop=stopRecording`, `onDismiss=handleDismiss`
- ThinkingState: `originalTranscript=originalTranscript.current` — but this won't re-render... use separate `thinkTranscript` state that gets set when entering THINKING
- PromptReadyState: `originalTranscript=originalTranscript.current`, `generatedPrompt`, `setGeneratedPrompt`, `onRegenerate=handleRegenerate`, `onReset=()=>transition(STATES.IDLE)`, `mode`
- ErrorState: `message=errorMessage`, `onDismiss=()=>transition(STATES.IDLE)`

**Important note on ThinkingState transcript**: Since `originalTranscript` is a useRef (doesn't trigger re-render), add a separate state `const [thinkTranscript, setThinkTranscript] = useState('')` that gets set to `originalTranscript.current` when entering THINKING state. Pass `thinkTranscript` to ThinkingState.

**Acceptance criteria**:
- [ ] All 5 states render their component (no crashes with placeholder components)
- [ ] `transition()` updates both stateRef and state
- [ ] RECORDING state hides window buttons, all other states show them
- [ ] IPC listeners registered once on mount
- [ ] `originalTranscript` is a useRef, set once in stopRecording onstop handler
- [ ] `npm run build:renderer` completes without errors

**Self-verify**: Read App.jsx. Run `npm run build:renderer`. Check for build errors.
**Test requirement**: `npm run start:react` shows IDLE state.
**⚠️ Boundaries**: Never set originalTranscript via useState. IPC handlers must use stableRef pattern to avoid stale closures.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: setState() pattern → transition(). originalTranscript never mutated. localStorage via hook wrappers.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-007 · IdleState.jsx
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3, FEATURE_PLAN.md#5
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/components/IdleState.jsx`

**What to do**:
Port the IDLE panel from index.html exactly. Must render:
- `.traf` drag region
- `.cr-idle` (click handler → `onStart`)
- `.pulse-ring` with SVG microphone icon
- `.ready-text` with "Promptly is ready" + shortcut hint
- `.mode-pill` showing `modeLabel`, click → `window.electronAPI.showModeMenu(mode)`

Props: `{ mode, modeLabel, onStart }`

```jsx
export default function IdleState({ mode, modeLabel, onStart }) {
  function handleModePillClick(e) {
    e.stopPropagation()
    if (window.electronAPI) window.electronAPI.showModeMenu(mode)
  }
  return (
    <div id="panel-idle">
      <div className="traf" />
      <div className="cr-idle" id="idle-area" onClick={onStart}>
        <div className="pulse-ring">
          <svg width="13" height="15" viewBox="0 0 12 16" fill="none">
            <rect x="3.5" y="0.5" width="5" height="9" rx="2.5" stroke="rgba(100,180,255,1)" strokeWidth="1"/>
            <path d="M1 8.5C1 11.26 3.24 13.5 6 13.5C8.76 13.5 11 11.26 11 8.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="6" y1="13.5" x2="6" y2="15.5" stroke="rgba(100,180,255,0.85)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="ready-text">
          <div className="ready-title">Promptly is ready</div>
          <div className="ready-sub">Press ⌥ Space or click to speak your prompt</div>
        </div>
        <span className="mode-pill" id="mode-pill" onClick={handleModePillClick}>{modeLabel}</span>
      </div>
    </div>
  )
}
```

Also wire right-click context menu on IdleState for mode menu (same as vanilla JS `contextmenu` handler).

**Acceptance criteria**:
- [ ] IDLE state renders pulse ring + text + mode pill
- [ ] Mode pill shows correct `modeLabel`
- [ ] Click on idle area calls `onStart`
- [ ] Click on mode pill calls `showModeMenu` (not `onStart`)

**Self-verify**: `npm run start:react` → IDLE state visible.
**CODEBASE.md update?**: No.
**Architecture compliance**: textContent equivalent used (JSX text nodes). No innerHTML.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-008 · WaveformCanvas.jsx + RecordingState.jsx
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_PLAN.md#5
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/components/WaveformCanvas.jsx`, `src/renderer/components/RecordingState.jsx`

**What to do**:

**WaveformCanvas.jsx**:
```jsx
import { useEffect, useRef } from 'react'

function drawRecordingWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(255,59,48,0)')
  grad.addColorStop(0.08, 'rgba(255,59,48,0.85)')
  grad.addColorStop(0.92, 'rgba(255,59,48,0.85)')
  grad.addColorStop(1, 'rgba(255,59,48,0)')
  ctx.beginPath(); ctx.strokeStyle = 'rgba(255,59,48,0.1)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = (Math.sin(i * 0.42 + t * 0.13) * 0.5 + 0.5) * 10 + (Math.sin(i * 0.85 + t * 0.08) * 0.4) * 4 + 1
    ctx.lineTo(x, mid + (i % 2 === 0 ? a : -a))
  }
  ctx.stroke()
  ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = (Math.sin(i * 0.42 + t * 0.13) * 0.5 + 0.5) * 10 + (Math.sin(i * 0.85 + t * 0.08) * 0.4) * 4 + 1
    ctx.lineTo(x, mid + (i % 2 === 0 ? a : -a))
  }
  ctx.stroke()
}

export default function WaveformCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0, raf
    function animate() { drawRecordingWave(ctx, canvas.width, canvas.height, t++); raf = requestAnimationFrame(animate) }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} id="recCanvas" width={340} height={36} style={{ width: '100%', height: '36px', display: 'block' }} />
}
```

**RecordingState.jsx**:
Port the RECORDING panel from index.html. Must render:
- 13px drag region
- `.cr-rec` with: dismiss-btn (X SVG), WaveformCanvas, rec-dur timer, stop-btn (■ SVG)
- `.rec-div-line`
- `.transcript-wrap` (show only when transcript is non-empty)

Props: `{ onStop, onDismiss }`

Timer: `useEffect` with `setInterval` on mount → increments seconds → formats `m:ss` → updates `recDur` via state.

```jsx
export default function RecordingState({ onStop, onDismiss }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    setSecs(0)
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const m = Math.floor(secs / 60), s = secs % 60
  const dur = `${m}:${String(s).padStart(2, '0')}`
  return (
    <div id="panel-recording">
      <div style={{ height: '13px', WebkitAppRegion: 'drag' }} />
      <div className="cr-rec">
        <div className="dismiss-btn" id="dismissBtn" onClick={onDismiss}>
          <svg ...X icon.../>
        </div>
        <div className="wave-wrap"><WaveformCanvas /></div>
        <span className="rec-dur" id="recDur">{dur}</span>
        <div className="stop-btn" id="stopBtn" onClick={onStop}>
          <svg ...stop icon.../>
        </div>
      </div>
      <div className="rec-div-line" />
    </div>
  )
}
```

**Acceptance criteria**:
- [ ] WaveformCanvas animates red sine wave on mount, cancels RAF on unmount
- [ ] RecordingState shows timer counting up from 0:00
- [ ] Stop button calls `onStop`
- [ ] Dismiss button calls `onDismiss`
- [ ] No RAF leak: switching to THINKING cancels the animation

**Self-verify**: `npm run start:react` → trigger recording → waveform animates.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: RAF cancel in useEffect cleanup. Timer cancel in useEffect cleanup.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-009 · MorphCanvas.jsx + ThinkingState.jsx
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_PLAN.md#5
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/components/MorphCanvas.jsx`, `src/renderer/components/ThinkingState.jsx`

**What to do**:

**MorphCanvas.jsx** — same pattern as WaveformCanvas, blue slow wave:
```jsx
function drawMorphWave(ctx, W, H, t) {
  const mid = H / 2
  ctx.clearRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(10,132,255,0)')
  grad.addColorStop(0.1, 'rgba(10,132,255,0.5)')
  grad.addColorStop(0.9, 'rgba(10,132,255,0.5)')
  grad.addColorStop(1, 'rgba(10,132,255,0)')
  ctx.beginPath(); ctx.strokeStyle = 'rgba(10,132,255,0.06)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 3.5 + Math.sin(i * 0.42 + t * 0.025) * 1.5 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()
  ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.moveTo(0, mid)
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * W
    const a = Math.sin(i * 0.18 + t * 0.04) * 3.5 + Math.sin(i * 0.42 + t * 0.025) * 1.5 + 0.5
    ctx.lineTo(x, mid + a)
  }
  ctx.stroke()
}

export default function MorphCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let t = 0, raf
    function animate() { drawMorphWave(ctx, canvas.width, canvas.height, t++); raf = requestAnimationFrame(animate) }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={canvasRef} id="morph-canvas" width={476} height={32} />
}
```

**ThinkingState.jsx**:
Port the THINKING panel. Must render:
- `.traf` drag region
- `.cr-think` with status-badge ("Processing" + animated dot) + think-title ("Building your prompt")
- `.morph-wrap` containing `<MorphCanvas />`
- `.div-line`
- `.ys-label-s` "You said"
- `.ys-text-s` showing `transcript` prop

Props: `{ transcript }`

**Acceptance criteria**:
- [ ] MorphCanvas animates slow blue breathing wave on mount, cancels on unmount
- [ ] ThinkingState shows "Building your prompt" + animated processing dot
- [ ] "You said" section shows `transcript` prop text
- [ ] No RAF leak on state transition away from THINKING

**Self-verify**: `npm run start:react` → trigger recording → ThinkingState appears with morph wave.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: RAF cancel in useEffect cleanup.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-010 · PromptReadyState.jsx
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3, FEATURE_PLAN.md#5
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/components/PromptReadyState.jsx`

**What to do**:
Port the PROMPT_READY panel. This is the most complex component.

Props: `{ originalTranscript, generatedPrompt, setGeneratedPrompt, onRegenerate, onReset, mode }`

State:
- `isCopied` (useState false) — flash state
- `isEditing` (useState false) — edit mode
- `preEditValue` (useRef '') — for Escape cancel

Sections to render:
1. `.traf` drag region
2. `.top-row` with `.pr-status` (✓ + "Prompt ready") and `.pr-actions` (Regenerate + Reset buttons)
3. `.div-line`
4. `.you-said-block` with `.ys-label` "You said" + `.ys-text` showing `originalTranscript`
5. `.inner-div`
6. `.prompt-out` — the main output area:
   - Shows `renderPromptOutput(generatedPrompt)` when not editing
   - When editing: `contentEditable="true"` with outline style
7. `.btn-row` with `.btn-edit` (Edit/Done) + `.btn-copy` (Copy prompt / Copied ✓)

**renderPromptOutput** — pure function:
```js
function renderPromptOutput(text) {
  const lines = text.split('\n')
  const result = []
  let buf = []
  function flush() {
    const t = buf.join('\n').trim()
    if (t) result.push(<span key={result.length}>{t}</span>)
    buf = []
  }
  for (const line of lines) {
    const m = line.trim().match(/^([A-Za-z][A-Za-z\s]*):\s*$/)
    if (m) {
      flush()
      result.push(<span key={result.length} className="pt-sl">{m[1].trim()}</span>)
    } else {
      buf.push(line)
    }
  }
  flush()
  return result
}
```

**Copy handler**:
```js
function handleCopy() {
  if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPrompt)
  setIsCopied(true)
  setTimeout(() => setIsCopied(false), 1800)
}
```

**Edit handler** (using a ref for the div):
```js
const promptRef = useRef(null)
function handleEdit() {
  if (!isEditing) {
    preEditValue.current = generatedPrompt
    setIsEditing(true)
  } else {
    setGeneratedPrompt(promptRef.current.textContent)
    setIsEditing(false)
  }
}
```

**Escape key handler** in useEffect:
```js
useEffect(() => {
  function onKey(e) {
    if (e.key === 'Escape' && isEditing) {
      promptRef.current.textContent = preEditValue.current
      setIsEditing(false)
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isEditing) {
      if (window.electronAPI) window.electronAPI.copyToClipboard(generatedPrompt)
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [isEditing, generatedPrompt])
```

When `isEditing` changes to true, use `useEffect` to focus the promptRef and set cursor.

**Acceptance criteria**:
- [ ] Copy button flashes green "Copied ✓" for 1.8s then reverts
- [ ] Edit button toggles to "Done"; prompt div becomes contentEditable with blue outline
- [ ] Done saves new text to `generatedPrompt` state
- [ ] Escape while editing restores previous prompt text and exits edit mode
- [ ] Cmd+C while NOT in edit mode copies to clipboard via IPC
- [ ] Regenerate button calls `onRegenerate`
- [ ] Reset button calls `onReset`
- [ ] Prompt section labels styled as `.pt-sl` spans

**Self-verify**: Full flow → PROMPT_READY → test copy, edit, escape, regenerate.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: `textContent` used in edit save (not innerHTML). Escape properly cancels.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-011 · ErrorState.jsx
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#5
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/components/ErrorState.jsx`

**What to do**:
Port the ERROR panel. Minimal component.

Props: `{ message, onDismiss }`

```jsx
export default function ErrorState({ message, onDismiss }) {
  return (
    <div id="panel-error">
      <div className="traf" />
      <div className="cr-error" id="error-area" onClick={onDismiss}>
        <div className="error-badge" style={{ WebkitAppRegion: 'no-drag' }}>⚠</div>
        <div className="ready-text" style={{ marginLeft: '14px', WebkitAppRegion: 'no-drag' }}>
          <div className="ready-title" id="error-message">{message || 'Something went wrong'}</div>
          <div className="ready-sub">Tap to retry</div>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance criteria**:
- [ ] ERROR state renders with error message text
- [ ] Click on error area calls `onDismiss`
- [ ] Default message "Something went wrong" shown when message is empty

**Self-verify**: Trigger an error (e.g. temp disable claudePath) → ERROR state shows.
**CODEBASE.md update?**: No.
**Architecture compliance**: textContent via JSX text node. No innerHTML.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-012 · main.js: load React build
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_PLAN.md#4
- **Dependencies**: FCR-002
- **Touches**: `main.js`

**What to do**:
In `createWindow()`, replace:
```js
win.loadFile('index.html');
```
with:
```js
const isDev = process.env.NODE_ENV === 'development'
if (isDev) {
  win.loadURL('http://localhost:5173')
} else {
  win.loadFile(path.join(__dirname, 'dist-renderer/index.html'))
}
```

No other changes to main.js. All IPC handlers unchanged.

**Acceptance criteria**:
- [ ] `NODE_ENV=development npm start` tries to load localhost:5173
- [ ] `npm run start:react` (NODE_ENV not set → production) loads dist-renderer/index.html
- [ ] All IPC handlers remain unchanged

**Self-verify**: Read main.js createWindow() function.
**Test requirement**: `npm run start:react` shows the React app.
**⚠️ Boundaries**: Only change the loadFile line. Do not touch IPC handlers.
**CODEBASE.md update?**: Yes — note main.js loading change.
**Architecture compliance**: Same BrowserWindow config. Same preload.js path.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-013 · History foundation in App.jsx
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#6
- **Dependencies**: FCR-006
- **Touches**: `src/renderer/App.jsx`

**What to do**:
Add `saveToHistory` function to App.jsx and call it in `stopRecording` onstop handler after successful PROMPT_READY transition:

```js
function saveToHistory(transcript, prompt, mode) {
  const history = JSON.parse(localStorage.getItem('promptly_history') || '[]')
  history.unshift({
    id: Date.now(),
    transcript,
    prompt,
    mode,
    timestamp: new Date().toISOString(),
  })
  if (history.length > 100) history.splice(100)
  localStorage.setItem('promptly_history', JSON.stringify(history))
}
```

Call sites:
- In `stopRecording` after `transition(STATES.PROMPT_READY)`: `saveToHistory(originalTranscript.current, genResult.prompt, mode)`
- In `handleRegenerate` after `transition(STATES.PROMPT_READY)`: `saveToHistory(originalTranscript.current, genResult.prompt, mode)`

**Acceptance criteria**:
- [ ] After successful PROMPT_READY, `localStorage.getItem('promptly_history')` contains an entry
- [ ] Entries are capped at 100
- [ ] Each entry has `{ id, transcript, prompt, mode, timestamp }`
- [ ] `saveToHistory` is called from both stopRecording and handleRegenerate

**Self-verify**: Open DevTools (right-click → Inspect) → Application → localStorage → `promptly_history`.
**CODEBASE.md update?**: No — listed in FCR-014.
**Architecture compliance**: localStorage accessed via function wrapper (not directly in handler).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### FCR-014 · Full wiring + smoke test + CODEBASE.md
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3 (all 18 acceptance criteria)
- **Dependencies**: FCR-007 through FCR-013
- **Touches**: `src/renderer/App.jsx` (final wiring), `vibe/CODEBASE.md`

**What to do**:
1. Complete App.jsx wiring: ensure all 5 state components receive correct props and all handler functions are properly connected
2. Add `handleDismiss` in App.jsx for dismiss button (stop MediaRecorder without processing, return to IDLE)
3. Add right-click context menu handler on the App root div (or pass down to IdleState)
4. Run full smoke test checklist (all 18 items from FEATURE_SPEC.md§3)
5. Update `vibe/CODEBASE.md`:
   - Update File map to include all new src/renderer/* files
   - Update State machine section to note React component architecture
   - Update Module-scope variables to note React state/refs equivalents
   - Add `promptly_history` to localStorage keys
   - Update Commands section with new scripts

**handleDismiss**:
```js
function handleDismiss() {
  if (mediaRecorderRef.current) {
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current = null
  }
  audioChunksRef.current = []
  isProcessingRef.current = false
  transition(STATES.IDLE)
}
```

**Smoke test checklist** (execute each manually):
- [ ] `npm run dev` starts Vite + Electron together
- [ ] All 5 states render correctly
- [ ] Waveform animates in recording state
- [ ] Morph wave animates in thinking state
- [ ] Mode selection via right-click persists in localStorage
- [ ] ⌥ Space shortcut triggers recording
- [ ] Whisper transcription works end to end
- [ ] Prompt generation works end to end
- [ ] Copy prompt flashes green
- [ ] Edit mode works (contentEditable, Escape cancels, Done saves)
- [ ] Regenerate uses originalTranscript not edited text
- [ ] Splash screen still works independently
- [ ] History saves to localStorage on every prompt ready
- [ ] `npm run build:renderer` produces dist-renderer/
- [ ] `npm run start:react` loads the built renderer correctly
- [ ] Window sizing correct in all states
- [ ] Glass morphism renders correctly in React build
- [ ] No console errors in any state

**CODEBASE.md update?**: Yes — comprehensive update.
**Architecture compliance**: All patterns from ARCHITECTURE.md confirmed in React implementation.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

## Feature Conformance Checklist

> Tick after every task. All items ✅ before merging to main.

- [ ] `npm run dev` starts Vite + Electron together
- [ ] All 5 states render correctly
- [ ] Waveform animates in recording state (RAF cleanup on unmount)
- [ ] Morph wave animates in thinking state (RAF cleanup on unmount)
- [ ] Mode selection persists in localStorage
- [ ] ⌥ Space shortcut triggers recording / stops recording
- [ ] Whisper transcription end-to-end
- [ ] Prompt generation end-to-end (all 6 modes)
- [ ] Copy prompt flashes green 1.8s
- [ ] Edit mode (contentEditable, Escape cancel, Done save)
- [ ] Regenerate uses originalTranscript (useRef, never mutated)
- [ ] Splash screen works independently
- [ ] History saves to localStorage (promptly_history, cap 100)
- [ ] `npm run build:renderer` produces dist-renderer/
- [ ] `npm run start:react` loads built renderer
- [ ] Window sizing correct in all states
- [ ] Glass morphism renders correctly
- [ ] No console errors in any state
- [ ] CODEBASE.md updated for React structure
- [ ] DECISIONS.md FEATURE-004 entry logged
