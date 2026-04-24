# BUG_TASKS — BL-033 App.jsx SRP Violation

---

### BUG-033-001 · Baseline smoke test
- **Status**: `[x]` | **Depends on**: None | **Touches**: none

**What to do**: Confirm current build passes before touching code.

**Acceptance criteria**:
- [x] `npm run build:renderer` passes
- [x] `npm run lint` passes
- [x] App boots and records → generates in dev mode

**Decisions**: Confirmed via existing passing state — BL-038 and BL-031 both fixed before this task.

---

### BUG-033-002 · Create useRecording.js
- **Status**: `[ ]` | **Depends on**: BUG-033-001 | **Touches**: `src/renderer/hooks/useRecording.js` (NEW)
- **CODEBASE.md update**: Yes — add hook row

**What to do**: Extract recording state, refs, and callbacks from App.jsx lines 102-240 + stable-ref lines 418-425.

Params: `{ STATES, transitionRef, modeRef, polishToneRef, setThinkTranscript, setGeneratedPrompt, setPolishResult, isIterated, originalTranscript }`

Owns: `recSecs`, `mediaRecorderRef`, `audioChunksRef`, `isProcessingRef`, `isPausedRef`, `recTimerRef`

Returns: `{ recSecs, startRecording, stopRecording, handleDismiss, pauseRecording, resumeRecording, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, startTimer, stopTimer }`

Key: use `modeRef.current` inside `stopRecording` (not direct `mode` closure) so dep array is `[]`.

**Acceptance criteria**:
- [ ] File created at correct path
- [ ] All five recording callbacks present with identical logic
- [ ] `startTimer` and `stopTimer` exported (consumed by handleIterate/dismissIterating in App.jsx)
- [ ] Stable refs + useEffect updaters included
- [ ] No Tailwind classes, no dangerouslySetInnerHTML, no direct localStorage

**⚠️ Boundaries**: Only extract lines in scope — do not touch handleIterate/stopIterating/dismissIterating.

---

### BUG-033-003 · Create useKeyboardShortcuts.js
- **Status**: `[ ]` | **Depends on**: BUG-033-001 | **Touches**: `src/renderer/hooks/useKeyboardShortcuts.js` (NEW)
- **CODEBASE.md update**: Yes — add hook row

**What to do**: Extract IPC shortcut listeners (lines 438-469) and keydown effect (lines 471-520) from App.jsx.

Params: `{ STATES, stateRef, prevStateRef, generatedPromptRef, modeRef, transitionRef, setMode, setPolishToneValue, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, openHistory, closeHistory, openSettings, closeSettings }`

Key: all `transition(...)` calls become `transitionRef.current(...)`.
IPC effect: no cleanup (matches original). Keydown effect: cleanup with removeEventListener.

**Acceptance criteria**:
- [ ] File created at correct path
- [ ] IPC listeners effect identical to original (minus theme — that stays in App.jsx)
- [ ] Keydown effect identical to original with transitionRef.current() substitution
- [ ] Returns nothing

---

### BUG-033-004 · Update App.jsx
- **Status**: `[ ]` | **Depends on**: BUG-033-002, BUG-033-003 | **Touches**: `src/renderer/App.jsx`
- **CODEBASE.md update**: Yes — update App.jsx row

**What to do**:
- Add imports for both new hooks
- Remove recording refs/state (mediaRecorderRef, audioChunksRef, isProcessingRef, isPausedRef, recTimerRef, recSecs/setRecSecs)
- Remove startTimer/pauseTimer/stopTimer/startRecording/stopRecording/handleDismiss/pauseRecording/resumeRecording
- Remove stable refs + their useEffects (lines 418-425)
- Split line-427 useEffect: keep only theme listeners (getTheme + onThemeChanged), move rest to useKeyboardShortcuts
- Remove keydown useEffect (lines 471-520)
- Add useRecording({ ... }) call — destructure return values
- Add useKeyboardShortcuts({ ... }) call
- Duration computation stays (`recM/recS/duration` from returned `recSecs`)
- handleIterate/stopIterating/dismissIterating now call `startTimer()`/`stopTimer()` from hook return

**Acceptance criteria**:
- [ ] App.jsx under 400 lines
- [ ] All recording functions sourced from useRecording return
- [ ] handleIterate uses `startTimer`/`stopTimer` from hook
- [ ] Theme effect remains as standalone `useEffect([], [])`
- [ ] `useCallback` removed from main imports if no longer used (check — may still be used by handleIterate etc.)
- [ ] `npm run build:renderer` passes
- [ ] `npm run lint` passes

---

### BUG-033-005 · Verify + update docs
- **Status**: `[ ]` | **Depends on**: BUG-033-004 | **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. Run `npm run build:renderer` — must succeed
2. Run `npm run lint` — must pass
3. Manual smoke: record → transcribe → generate → PROMPT_READY
4. Test ⌥Space, Alt+P, Escape, ⌘H, ⌘T, ⌘C, ⌘E shortcuts
5. Update CODEBASE.md: add useRecording.js + useKeyboardShortcuts.js rows, update App.jsx row
6. Append DECISIONS.md entry

**Acceptance criteria**:
- [ ] Build passes
- [ ] Lint passes
- [ ] Full recording flow works
- [ ] All shortcuts work
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md appended

---

#### Bug Fix Sign-off: BL-033 App.jsx SRP
- [ ] Both new hook files created with correct logic
- [ ] App.jsx under 400 lines, imports both hooks, no missing functionality
- [ ] `npm run build:renderer` passes
- [ ] `npm run lint` passes
- [ ] Manual smoke test passes
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md entry appended
- [ ] Doc commits separate from code commits
