# BUG_SPEC — BL-033 App.jsx SRP Violation

## 1. Bug summary
App.jsx is 653 lines and owns three unrelated concerns: recording logic, keyboard/IPC shortcut wiring, and the render tree — a clear SRP violation flagged in the FEATURE-015 review.

## 2. Files involved
- `src/renderer/App.jsx` — modified (source + destination)
- `src/renderer/hooks/useRecording.js` — NEW
- `src/renderer/hooks/useKeyboardShortcuts.js` — NEW

## 3. Root cause hypothesis
As features were added incrementally (FEATURE-011 pause, FEATURE-012 iter, FEATURE-014 text, FEATURE-015 polish), all logic was appended to App.jsx rather than extracted into hooks. No single task crossed a threshold that forced a refactor, but the accumulation now makes the file unwieldy.

Confidence: 100% — this is a code-quality issue, not a runtime bug.

## 4. Blast radius
- `useRecording.js` will be the new home for `startRecording`, `stopRecording`, `handleDismiss`, `pauseRecording`, `resumeRecording`, timer helpers, and their stable refs.
- `useKeyboardShortcuts.js` will be the new home for IPC shortcut listeners and the keydown handler.
- `handleIterate`, `stopIterating`, `dismissIterating` stay in App.jsx (they are iteration logic, not base recording) but will consume `startTimer`/`stopTimer` returned from `useRecording`.
- `handleTypingSubmit`, `handleRegenerate` stay in App.jsx (they share the polish/generate flow with `usePolishMode`).
- Zero user-facing behavior changes — pure extraction.

## 5. Fix approach
Extract without changing logic:
- All recording refs (`mediaRecorderRef`, `audioChunksRef`, `isProcessingRef`, `isPausedRef`, `recTimerRef`, `recSecs`) move into `useRecording`.
- `startTimer`/`stopTimer` exported from hook for use by `handleIterate`/`dismissIterating`.
- `useRecording` takes external deps as params: `transitionRef`, `modeRef`, `polishToneRef`, setters, and shared refs.
- `useKeyboardShortcuts` takes all needed refs/callbacks as params and contains both effects.
- Theme handling (getTheme / onThemeChanged) stays in App.jsx as its own `useEffect`.

## 6. What NOT to change
- `handleIterate`, `stopIterating`, `dismissIterating` — stay in App.jsx
- `handleTypingSubmit`, `handleRegenerate` — stay in App.jsx
- `openHistory`, `closeHistory`, `openSettings`, `closeSettings` — stay in App.jsx (they close over setCurrentState + animateToState)
- `STATES`, `STATE_HEIGHTS`, `transition`, `animateToState` — stay in App.jsx
- All IPC channel contracts — unchanged
- All component props — unchanged

## 7. Verification plan
1. `npm run build:renderer` — must succeed with 0 errors
2. `npm run lint` — must pass with 0 errors
3. Manual smoke: IDLE → record → stop → THINKING → PROMPT_READY
4. ⌥Space shortcut triggers recording from IDLE
5. Alt+P pauses/resumes recording
6. Escape from RECORDING, SHORTCUTS, HISTORY, SETTINGS
7. ⌘H opens history, ⌘T opens typing, ⌘C copies, ⌘E exports

## 8. Regression test
No automated test suite — manual smoke test per verification plan above is the test (ARCHITECTURE.md testing philosophy).
