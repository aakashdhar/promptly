# FEATURE_PLAN.md — FEATURE-004: React Migration
> Folder: vibe/features/2026-04-19-react-migration/
> Date: 2026-04-19

---

## 1. Impact map

**New files:**
```
vite.config.js                          ← Vite build config
src/
  renderer/
    index.html                          ← Vite entry point (<div id="root">)
    main.jsx                            ← ReactDOM.createRoot
    App.jsx                             ← State machine root
    hooks/
      useMode.js                        ← mode localStorage get/set
      useWindowResize.js                ← resizeWindow IPC wrapper
    components/
      IdleState.jsx
      RecordingState.jsx
      ThinkingState.jsx
      PromptReadyState.jsx
      ErrorState.jsx
      WaveformCanvas.jsx
      MorphCanvas.jsx
    styles/
      tokens.css                        ← :root vars + body.light overrides
      bar.css                           ← .bar, .bar::before, .bar::after
      states.css                        ← per-state layout + animation CSS
```

**Modified files:**
- `main.js` — change `win.loadFile('index.html')` to load React build
- `package.json` — add devDeps + scripts

**Unchanged files:**
- `preload.js` — no IPC changes
- `splash.html` — vanilla HTML, independent
- `entitlements.plist` — no changes
- `index.html` — kept on main branch; replaced on feat/react-migration branch

## 2. Files explicitly out of scope

- `preload.js` — no changes
- `splash.html` — no changes
- `entitlements.plist` — no changes
- All `vibe/` docs (updated separately)

## 3. Build configuration

**vite.config.js:**
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist-renderer', emptyOutDir: true },
  root: 'src/renderer',
})
```

**package.json scripts added:**
```json
"dev": "vite",
"build:renderer": "vite build",
"start:react": "npm run build:renderer && electron ."
```

**electron-builder files update:**
```json
"files": ["main.js", "preload.js", "dist-renderer/**", "splash.html", "package.json"]
```

## 4. main.js loading change

```js
// In createWindow(), replace win.loadFile('index.html') with:
const isDev = process.env.NODE_ENV === 'development'
if (isDev) {
  win.loadURL('http://localhost:5173')
} else {
  win.loadFile(path.join(__dirname, 'dist-renderer/index.html'))
}
```

## 5. Component architecture

### App.jsx — State machine root

State:
- `currentState` (useState) — 'IDLE' | 'RECORDING' | 'THINKING' | 'PROMPT_READY' | 'ERROR'
- `generatedPrompt` (useState) — written by generate-prompt IPC result + Edit Done
- `errorMessage` (useState) — written by ERROR transitions
- `originalTranscript` (useRef) — captured ONCE in stopRecording, never mutated
- `currentMode`, `setMode`, `modeLabel` — from useMode hook
- `resizeWindow` — from useWindowResize hook
- `stateRef` (useRef) — mirrors currentState for stale-closure-safe IPC handlers

Key functions:
- `transition(newState, payload)` — sets state, resizes window
- `startRecording()` — getUserMedia → MediaRecorder → RECORDING
- `stopRecording()` — stop MediaRecorder → THINKING → transcribeAudio → generatePrompt → PROMPT_READY
- `handleRegenerate()` — THINKING → generatePrompt → PROMPT_READY
- `saveToHistory(transcript, prompt, mode)` — localStorage cap 100

IPC wiring (all in useEffect once on mount):
- `onShortcutTriggered`: if IDLE → startRecording; if RECORDING → stopRecording
- `onModeSelected`: setMode
- `onThemeChanged`: classList.toggle('light')
- `getTheme()`: initial theme on boot

### Hooks

**useMode.js:**
```js
export function useMode() {
  const [mode, setModeState] = useState(() => localStorage.getItem('mode') || 'balanced')
  const setMode = (m) => { localStorage.setItem('mode', m); setModeState(m) }
  const modeLabel = { balanced:'Balanced', detailed:'Detailed', concise:'Concise', chain:'Chain', code:'Code', design:'Design' }[mode]
  return { mode, setMode, modeLabel }
}
```

**useWindowResize.js:**
```js
export function useWindowResize() {
  const resizeWindow = (height) => {
    requestAnimationFrame(() => window.electronAPI.resizeWindow(height))
  }
  return { resizeWindow }
}
```

### WaveformCanvas.jsx

Canvas ref + useEffect that starts RAF on mount, cancels on unmount.
Props: `type` ('recording' | 'morph'), `isActive` (boolean)
Drawing functions: `drawRecordingWave(ctx, W, H, t)` and `drawMorphWave(ctx, W, H, t)` as module-scope pure functions.

### RecordingState.jsx

Props: `onStop()`, `onDismiss()`, `transcript` (string, live text)
Internal timer via useEffect/setInterval.
WaveformCanvas `type="recording"`.

### ThinkingState.jsx

Props: `originalTranscript` (string)
MorphCanvas `type="morph"`.

### PromptReadyState.jsx

Props: `originalTranscript`, `generatedPrompt`, `setGeneratedPrompt`, `onRegenerate()`, `onReset()`, `mode`
Internal: `isEditing` (useState), `preEditPrompt` (useRef for Escape cancel)
Copy: flash state + clipboard IPC.
Edit: contentEditable div ref.
renderPromptOutput: pure function that splits prompt into section-label spans.

### ErrorState.jsx

Props: `message`, `onDismiss()`

## 6. Conventions to follow

- `window.electronAPI.*` calls identical to vanilla JS version
- `textContent` for all dynamic text — never `innerHTML` with external content
- `originalTranscript` is `useRef` — `.current` is set once and never reset
- `getMode()` / `setMode()` pattern replaced by `useMode` hook (same localStorage key: `'mode'`)
- RAF loops: always cancel in useEffect cleanup function
- IPC listener registration: always in useEffect with empty dep array (mount once)

## 7. Task breakdown

| ID | Title | Size | Deps |
|----|-------|------|------|
| FCR-001 | Branch + install devDeps | S | None |
| FCR-002 | vite.config.js + package.json updates | S | FCR-001 |
| FCR-003 | src/renderer/index.html + main.jsx | S | FCR-002 |
| FCR-004 | CSS migration: tokens.css + bar.css + states.css | S | FCR-003 |
| FCR-005 | useMode.js + useWindowResize.js | S | FCR-003 |
| FCR-006 | App.jsx: state machine core | M | FCR-004, FCR-005 |
| FCR-007 | IdleState.jsx | S | FCR-006 |
| FCR-008 | WaveformCanvas.jsx + RecordingState.jsx | M | FCR-006 |
| FCR-009 | MorphCanvas.jsx + ThinkingState.jsx | M | FCR-006 |
| FCR-010 | PromptReadyState.jsx | M | FCR-006 |
| FCR-011 | ErrorState.jsx | S | FCR-006 |
| FCR-012 | main.js: load React build | S | FCR-002 |
| FCR-013 | History foundation in App.jsx | S | FCR-006 |
| FCR-014 | Full wiring + smoke test + CODEBASE.md | M | FCR-007 thru FCR-013 |

## 8. Rollback plan

The feature lives entirely on `feat/react-migration` branch. `main` branch retains `index.html` untouched. To rollback: `git checkout main`. No destructive changes to main during this feature.

## 9. Testing strategy

Manual smoke test checklist (FEATURE_SPEC.md §3 — 18 items). No automated test framework added in this feature.

## 10. CODEBASE.md sections to update

- File map: add all new src/renderer/* files
- IPC channels: no changes
- State machine: note React components replace inline DOM manipulation
- Module-scope variables: note moved to React state/refs
- CSS design tokens: note moved to tokens.css
- localStorage keys: add promptly_history
