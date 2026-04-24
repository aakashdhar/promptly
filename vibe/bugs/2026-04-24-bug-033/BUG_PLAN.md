# BUG_PLAN — BL-033 App.jsx SRP Violation

## 1. Exact files to modify
- `src/renderer/App.jsx` — remove extracted blocks, import + call both hooks
- `src/renderer/hooks/useRecording.js` — NEW
- `src/renderer/hooks/useKeyboardShortcuts.js` — NEW
- `vibe/CODEBASE.md` — add two new hook rows
- `vibe/bugs/2026-04-24-bug-033/BUG_TASKS.md`
- `vibe/TASKS.md`
- `vibe/DECISIONS.md`
- `CLAUDE.md`

## 2. Exact files NOT to touch
- `main.js`, `preload.js`, `splash.html`, `entitlements.plist`
- All `src/renderer/components/`
- All other hooks (`useMode.js`, `usePolishMode.js`, `useWindowResize.js`, `useTone.js`)
- `src/renderer/utils/history.js`

## 3. Change description

### useRecording.js (NEW)
Params: `{ STATES, transitionRef, modeRef, polishToneRef, setThinkTranscript, setGeneratedPrompt, setPolishResult, isIterated, originalTranscript }`

Owns internally:
- `recSecs` / `setRecSecs` (useState)
- `mediaRecorderRef`, `audioChunksRef`, `isProcessingRef`, `isPausedRef`, `recTimerRef` (useRef)

Contains:
- `startTimer()`, `pauseTimer()`, `stopTimer()` — plain functions (not useCallback)
- `startRecording`, `stopRecording`, `handleDismiss`, `pauseRecording`, `resumeRecording` — useCallback
- Stable ref pattern: `startRecordingRef`, `stopRecordingRef`, `pauseRecordingRef`, `resumeRecordingRef` + useEffect updaters

Key change vs original: `stopRecording` uses `modeRef.current` instead of closing over `mode` directly (dep array `[]` instead of `[mode]`). This avoids stale closure without behavior change since `modeRef` is kept up to date in App.jsx.

Returns: `{ recSecs, startRecording, stopRecording, handleDismiss, pauseRecording, resumeRecording, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, startTimer, stopTimer }`

### useKeyboardShortcuts.js (NEW)
Params: `{ STATES, stateRef, prevStateRef, generatedPromptRef, modeRef, transitionRef, setMode, setPolishToneValue, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, openHistory, closeHistory, openSettings, closeSettings }`

Contains:
- IPC listeners effect (shortcut-triggered, mode-selected, tone-selected, show-shortcuts, show-history, shortcut-pause, open-settings) — `useEffect([], [])` — no cleanup needed (matches original)
- Keydown listener effect — `useEffect([], [])` with `removeEventListener` cleanup

Key change: all `transition(...)` calls replaced with `transitionRef.current(...)` — same behavior, avoids passing transition directly.

Returns: nothing (side-effects hook).

### App.jsx changes
Remove:
- Lines 58-60: `mediaRecorderRef`, `audioChunksRef`, `isProcessingRef`
- Line 61: `isPausedRef`
- Line 68: `recTimerRef`
- Line 71: `const [recSecs, setRecSecs]`
- Lines 102-113: `startTimer`, `pauseTimer`, `stopTimer`
- Lines 135-240: `startRecording`, `stopRecording`, `handleDismiss`, `pauseRecording`, `resumeRecording`
- Lines 418-425: stable refs + useEffects for them
- Lines 438-469: IPC shortcut/mode/history/pause/settings listeners (from within the existing effect)
- Lines 471-520: keydown useEffect

Keep (or split from the line 427 effect):
- Lines 430-436: theme effect (getTheme + onThemeChanged) — stays as own `useEffect([], [])`

Add:
- `import useRecording from './hooks/useRecording.js'`
- `import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js'`
- `useRecording({ ... })` call after `transitionRef.current = transition`
- `useKeyboardShortcuts({ ... })` call after `useRecording`
- `const recM = Math.floor(recSecs / 60); const recS = recSecs % 60; const duration = ...` (same computation, using `recSecs` from hook return)

## 4. Conventions to follow
- All useCallback deps: `[]` with modeRef/transitionRef pattern (consistent with existing hooks)
- useEffect cleanup: keydown effect returns cleanup; IPC effect does not (matches original)
- No dangerouslySetInnerHTML, no direct localStorage, no new IPC channels
- Named export default for both hooks

## 5. Side effects check
- `handleIterate` / `stopIterating` / `dismissIterating` in App.jsx call `startTimer()`/`stopTimer()` — these are now destructured from `useRecording` return. Must be included in return.
- `pauseTimer()` is internal to the hook only (called by `pauseRecording`) — does NOT need to be exported.
- `recSecs` returned from hook — used to compute `duration` in App.jsx (same as before).

## 6. Test plan
1. `npm run build:renderer` → 0 errors
2. `npm run lint` → 0 errors
3. Manual smoke (see BUG_SPEC verification plan)

## 7. Rollback plan
`git checkout src/renderer/App.jsx` + delete the two new hook files.

## 8. CODEBASE.md update needed?
Yes — add rows for `useRecording.js` and `useKeyboardShortcuts.js` in the file map table. Update App.jsx row to reflect removed functions.

## 9. ARCHITECTURE.md update needed?
No — this is a refactor following existing hook patterns already documented.
