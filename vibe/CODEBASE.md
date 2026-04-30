# CODEBASE.md — Promptly
> Live codebase snapshot. Updated after every task that adds or modifies a file.
> Agent reads this at session start to understand current state without re-reading all files.
> Last updated: 2026-04-30 (FEATURE-EMAIL-MODE — all 8 tasks complete)

---

## Current state

**Phase:** All features complete — React migration mainlined, deploy gate unlocked (2026-04-24). SRP refactor + tests added 2026-04-28.
**Files written:** 7 source files + eslint.config.js + 27 React renderer files + 1 test file + vitest.config.js

---

## File map

| File | Purpose | Key exports / functions |
|------|---------|------------------------|
| `package.json` | Electron + electron-builder config, npm scripts (start, dev, build:renderer, start:react, dist, lint), devDeps only | — |
| `entitlements.plist` | Mic + JIT + hardened runtime entitlements for macOS distribution | — |
| `eslint.config.js` | ESLint 9 flat config for main.js and preload.js | — |
| `vite.config.js` | Vite build config — root: src/renderer, outDir: dist-renderer/, base: './', plugins: react() + tailwindcss() | — |
| `main.js` | Electron main: window + splashWin lifecycle, IPC handlers, PATH resolution, global shortcut, menu bar icon. Loads React build (NODE_ENV=development → localhost:5173, else dist-renderer/index.html). Both BrowserWindows use `transparent:false, backgroundColor:'#0A0A14'` — no vibrancy. MODE_CONFIG has 11 modes total (adds workflow: passthrough:true, instruction:'' and email: standalone:true with full email drafting system prompt). | `createWindow()`, `resolveClaudePath()`, `resolveWhisperPath()`, `resolveFfmpegPath()`, `registerShortcut()`, `buildTrayMenu()`, `updateTrayMenu()`, `handleUninstall()`, `crc32()`, `pngEncode()`, `createMicIcon()`, `createMenuBarIcon()`, `claudePath`, `whisperPath`, `win`, `splashWin`, `tray`, `menuBarTray`, `pulseInterval`, `lastGeneratedPrompt`, `SHORTCUT_PRIMARY`, `SHORTCUT_FALLBACK`, `PROMPT_TEMPLATE`, `MODE_CONFIG` |
| `preload.js` | contextBridge — exposes window.electronAPI to renderer and splash | `window.electronAPI` — includes `generatePrompt(transcript, mode, options?)`, `generateRaw`, `copyToClipboard`, `checkClaudePath`, `resizeWindow`, `transcribeAudio`, `showModeMenu`, `setWindowButtonsVisible`, `saveFile`, `resizeWindowWidth`, `setWindowSize`, `onShortcutTriggered`, `onModeSelected`, `getTheme`, `onThemeChanged`, `onShowShortcuts`, `onShowHistory`, `onShortcutPause`, `updateMenuBarState(state)`, `setLastPrompt(prompt)`, `retryTranscription()`, `onTranscriptionSlowWarning(cb)`, `retryGeneration()`, `onGenerationSlowWarning(cb)`, `reopenWizard()` |
| `splash.html` | 4-screen onboarding wizard + legacy quick-check for returning users — separate splashWin BrowserWindow (vanilla HTML, independent of React). Window: 560×620. Background: `linear-gradient(135deg, #0A0A14 → #0D0A18 → #0A0A14)` + blue/purple ambient glow divs. All screens scrollable (overflow-y: auto). Screens 1/2/3 do NOT auto-advance — each shows "Continue →"; "Check again ↺" is secondary. Screen 0: on repeat launches calls `runChecks()`. Screen 1 (s1-notfound) and Screen 2 (s2-whisper-notfound) each show an "Already installed?" section with `which claude`/`which whisper` copy command + pasteable path input + "Use path →" button for nvm/custom-path users. Screen 4 now runs mic check via `getUserMedia` — Launch button gated on grant, denied state shows System Settings deep-link + retry. pathPanel inputs have `-webkit-app-region: no-drag`. | `runChecks()`, `setCheck()`, `showReady()`, `showScreen(n)`, `runScreen4()`, `s1ShowError(stateId, showHelp)`, `s1UseManualPath()`, `s2UseManualPath()` |
| `index.html` | Legacy vanilla JS renderer — stays on main branch; replaced by React build on feat/react-migration | (see pre-migration codebase) |
| `src/renderer/index.html` | Vite HTML entry point — `<div id="root">` + module script | — |
| `src/renderer/index.css` | Tailwind v4 entry — `@import "tailwindcss"`, @theme (color/font/animation tokens), @keyframes, body reset (`background: #0A0A14`), scrollbar utilities | — |
| `src/renderer/main.jsx` | React root — imports index.css, `ReactDOM.createRoot().render(<App />)` | — |
| `src/renderer/App.jsx` | State machine root — all states, IPC wiring, theme, iteration flow, history, polish mode. Recording, keyboard, image-builder, video-builder, workflow-builder, and email flows delegated to hooks/handlers. Bar container: `linear-gradient(135deg, #0A0A14 → #0D0A18)`. STATES includes VIDEO_BUILDER + VIDEO_BUILDER_DONE + WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE + TRANSCRIPTION_ERROR + GENERATION_ERROR + EMAIL_READY; STATE_HEIGHTS: all expanded-only states = 860 (including EMAIL_READY: 860). thinkingAccentColor state controls colored accent for video/workflow/email THINKING. handleGenerateResult has video + workflow + email branches; email branch parses raw JSON → emailOutput → EMAIL_READY; also handles all generation failures (expanded → GENERATION_ERROR; collapsed → ERROR). imageBuilderProps, videoBuilderProps, workflowBuilderProps bundles returned from hooks and forwarded to ExpandedView. emailOutput + emailSaved forwarded to ExpandedView → ExpandedDetailPanel. `abortRef` guards stale THINKING result. `handleAbort()` routes to correct cancel handler per state. `handleRetryTranscription()` retries whisper on lastTempAudioPath then re-runs generation. `handleRetryGeneration()` calls retryGeneration IPC then delegates result to handleGenerateResultRef. Auto-expand: mode-selected IPC listener auto-expands when new mode is 'email'. `thinkingPhase` (1 or 2) set in transition() — 2 when entering THINKING from IMAGE_BUILDER/VIDEO_BUILDER/WORKFLOW_BUILDER. `useThinkingProgress` called with mode + thinkingPhase + isActive; result forwarded to ExpandedView. | `STATES`, `STATE_HEIGHTS`, `transition()`, `handleGenerateResult()`, `handleRegenerate()`, `handleAbort()`, `handleRetryTranscription()`, `handleRetryGeneration()`, `handleEmailSave()`, `handleEmailIterate()`, `openHistory()` / `closeHistory()`. Refs: `transitionRef`, `handleGenerateResultRef`, `isIterated`, `generatedPromptRef`, `modeRef`, `abortRef`. State vars: `thinkingAccentColor`, `thinkingPhase`, `transcriptionError`, `transcriptionSlow`, `generationError`, `generationSlow`, `emailOutput`, `emailSaved`. |
| `src/renderer/hooks/useMode.js` | Mode localStorage wrapper hook. MODE_LABELS includes `video: 'Video'`, `workflow: 'Workflow'`, and `email: 'Email'`. | `useMode()` → `{ mode, setMode, modeLabel }` |
| `src/renderer/hooks/useTone.js` | Polish tone localStorage wrapper — `promptly_polish_tone` key, default `'formal'` | `getPolishTone()`, `setPolishTone()`, `usePolishTone()` → `{ tone, setTone }` |
| `src/renderer/hooks/usePolishMode.js` | Polish flow hook — owns polishResult, copied, tone state, polishToneRef, handlePolishToneChange | `parsePolishOutput(raw)` (named export), `usePolishMode({ originalTranscript, transitionRef, setThinkTranscript, setGeneratedPrompt, STATES })` → `{ polishResult, setPolishResult, copied, setCopied, polishTone, setPolishToneValue, polishToneRef, handlePolishToneChange }` |
| `src/renderer/hooks/useWindowResize.js` | resizeWindow IPC wrapper hook | `useWindowResize()` → `{ resizeWindow }` |
| `src/renderer/hooks/useIteration.js` | Iteration recording/transcription/generation flow — extracted from App.jsx. Owns iterRecorderRef, iterChunksRef, iterIsProcessingRef, iterationBase. Uses generatedPromptRef + modeRef (no stale closures). 118 lines. | `useIteration({ STATES, transitionRef, resizeWindow, isExpandedRef, generatedPromptRef, modeRef, isIterated, originalTranscript, setThinkTranscript, setGeneratedPrompt, startTimer, stopTimer })` → `{ iterationBase, handleIterate, stopIterating, dismissIterating }` |
| `src/renderer/hooks/useWorkflowBuilder.js` | Workflow builder hook. Phase 1: runWorkflowAnalysis (Claude JSON analysis → WORKFLOW_BUILDER). Phase 2: assembleWorkflowJson (Claude n8n JSON generation → saveToHistory → WORKFLOW_BUILDER_DONE). Reiterate merge: filled placeholder values preserved by `${nodeId}-${paramKey}` key; user-added nodes (id > originalNodeCount) discarded. Green THINKING accent `rgba(34,197,94,0.85)` set via setThinkingAccentColor. Builds `workflowBuilderProps` bundle internally (onReiterate uses startRecordingRef). handleDeleteNode filters node from workflowAnalysis.nodes and removes its filled placeholder entries; guard prevents deleting last node. | `useWorkflowBuilder({ STATES, transitionRef, originalTranscript, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, startRecordingRef })` → `{ isReiteratingRef, runWorkflowAnalysis, handleWorkflowStartOver, workflowBuilderProps }` |
| `src/renderer/hooks/useVideoBuilder.js` | Video builder Veo 3.1 hook. Phase 1: runPreSelection (Claude JSON pre-fill → VIDEO_BUILDER). Phase 2: assembleVideoPrompt (Claude natural-language assembly → `saveToHistory(...)` → VIDEO_BUILDER_DONE). `saveToHistory` called in assembleVideoPrompt (not handleVideoSave) so ExpandedHistoryList refreshes on the VIDEO_BUILDER_DONE state transition. 9 chip params via VIDEO_PARAM_CONFIG. Reiterate merge: user chips preserved, AI chips refreshed, removedByUser excluded; boolean toggles refreshed. Orange THINKING accent `rgba(251,146,60,0.8)` set via setThinkingAccentColor on both phases. Builds `videoBuilderProps` bundle internally (onReiterate uses startRecordingRef). | `VIDEO_PARAM_CONFIG` (named export), `useVideoBuilder({ STATES, transitionRef, originalTranscript, setThinkTranscript, setThinkingLabel, setThinkingAccentColor, startRecordingRef })` → `{ isReiteratingRef, runPreSelection, handleVideoStartOver, videoBuilderProps }` |
| `src/renderer/hooks/useImageBuilder.js` | Image builder all-params review hook (redesigned from tier-interview). Owns imageDefaults, imageAnswers, showAdvanced, activePickerParam, removedByUser, imageBuiltPrompt state; isReiteratingRef. Phase 1: runPreSelection (Claude JSON pre-fill → imageDefaults); Phase 2: assembleImagePrompt (Claude natural-language assembly → IMAGE_BUILDER_DONE). Chip handlers: handleChipRemove (adds to removedByUser), handleChipAdd, handleParamChange. Reiterate merge logic: user-added chips preserved, AI chips refreshed from new defaults, removedByUser values excluded. Builds `imageBuilderProps` bundle internally (onReiterate uses startRecordingRef). | `useImageBuilder({ STATES, transitionRef, isExpandedRef, originalTranscript, resizeWindow, setThinkTranscript, setThinkingLabel, startRecordingRef })` → `{ imageDefaults, imageAnswers, showAdvanced, activePickerParam, imageBuiltPrompt, isReiteratingRef, runPreSelection, handleChipRemove, handleChipAdd, handleParamChange, handleOpenPicker, handleClosePicker, handleToggleAdvanced, handleConfirm, handleCopyNow, handleImageStartOver, handleImageEditAnswers, imageBuilderProps }` |
| `src/renderer/hooks/useRecording.js` | Recording state + callbacks hook — owns mediaRecorderRef, audioChunksRef, isProcessingRef, isPausedRef, recTimerRef, recSecs. Params: `{ STATES, transitionRef, modeRef, polishToneRef, setThinkTranscript, setThinkingAccentColor, setThinkingLabel, onGenerateResult, isIterated, originalTranscript, isExpandedRef, setTranscriptionError }` — `onGenerateResult` is a ref to App.jsx's `handleGenerateResult(genResult, transcript)` callback. Sets teal THINKING accent/label BEFORE transition(THINKING) when mode is 'email' (fixes timing: accent must be set before transition, not after result). On transcription failure: expanded → TRANSCRIPTION_ERROR (sets transcriptionError via setTranscriptionError); collapsed → ERROR with "expand to retry". | Returns: `{ recSecs, startRecording, stopRecording, handleDismiss, pauseRecording, resumeRecording, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, startTimer, stopTimer }` |
| `src/renderer/hooks/useKeyboardShortcuts.js` | IPC shortcut listeners + keydown handler hook. Email mode guard: if `modeRef.current === 'email' && !isExpandedRef.current` on shortcut trigger, calls `handleExpand()` and returns early before recording. Params: `{ STATES, stateRef, prevStateRef, generatedPromptRef, modeRef, transitionRef, setMode, setPolishToneValue, startRecordingRef, stopRecordingRef, pauseRecordingRef, resumeRecordingRef, openHistory, closeHistory, openSettings, closeSettings, handleExpand, isExpandedRef }` | Returns nothing (side-effects only) |
| `src/renderer/hooks/useOperationHandlers.js` | Operation handlers hook — extracted from App.jsx. Owns `transcriptionSlow`, `generationSlow` state; registers `onTranscriptionSlowWarning` and `onGenerationSlowWarning` IPC listeners. Provides `handleAbort` (routes by stateRef.current to correct abort action), `handleRetryTranscription` (retries Whisper via IPC, sets thinkTranscript, re-enters THINKING), `handleRetryGeneration` (retries Claude via IPC). Receives `abortRef` from App.jsx (shared with handleGenerateResult). | `useOperationHandlers({ STATES, stateRef, transitionRef, modeRef, polishToneRef, handleGenerateResultRef, originalTranscript, setThinkTranscript, abortRef, handleDismiss, dismissIterating, handleImageStartOver, handleVideoStartOver, handleWorkflowStartOver, setEmailOutput })` → `{ transcriptionSlow, generationSlow, handleAbort, handleRetryTranscription, handleRetryGeneration }` |
| `src/renderer/hooks/useThinkingProgress.js` | Elapsed timer + rotating label with fade transition for THINKING state. Resets on deactivation. Both intervals cleaned up on unmount. | `useThinkingProgress({ mode, phase, isActive })` → `{ elapsed, currentLabel, labelOpacity }` |
| `src/renderer/components/ExpandedView.jsx` | Thin orchestrator for expanded layout mode — owns `selected` (starts `null`, no auto-selection) + `isViewingHistory` state; renders ExpandedTransportBar + ExpandedHistoryList + ExpandedDetailPanel. Forwards `imageBuilderProps` + `videoBuilderProps` + `workflowBuilderProps` + `thinkingLabel` + `thinkingAccentColor` + `transcriptionErrorProps` + `transcriptionSlow` + `generationErrorProps` + `generationSlow` to ExpandedDetailPanel. Forwards `thinkingElapsed` + `thinkingCurrentLabel` + `thinkingLabelOpacity` to ExpandedTransportBar. Toggle-deselect: clicking the active history entry sets `selected=null`. No useEffect — `isContentState` in ExpandedDetailPanel handles right-panel routing. | props: `currentState`, `mode`, `modeLabel`, `duration`, `generatedPrompt`, `thinkTranscript`, `onStart`, `onCollapse`, `onPause`, `onStop`, `onStopIterate`, `onRegenerate`, `onReset`, `onIterate`, `isIterated`, `setGeneratedPrompt`, `isPolishMode`, `polishResult`, `polishTone`, `onPolishToneChange`, `onOpenSettings`, `onReuse`, `onTypingSubmit`, `onSwitchToVoice`, `onTypePrompt`, `thinkingLabel`, `thinkingAccentColor`, `imageBuilderProps`, `videoBuilderProps`, `workflowBuilderProps`, `onAbort`, `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity`, `transcriptionErrorProps`, `transcriptionSlow`, `generationErrorProps`, `generationSlow` |
| `src/renderer/components/ExpandedTransportBar.jsx` | Top bar of expanded view — traffic light drag spacer (collapse right only), inline-flex transport row that shrinks to content width (Pause 36px, timer, Mic/Stop 52px, mode pill, Type 36px, Reset/Abort 36px, 0.5px divider, text block), waveform zone sized to match transport row via ResizeObserver ref. Text block shows state-aware hint text + colour dot; during THINKING renders 12px mode-accent spinner + rotating label (fade 150ms) + M:SS elapsed timer instead. Collapse disabled when `mode === 'video'/'workflow'/'email'`. Reset/abort button sits after Type button; dimmed at IDLE. | props: `currentState`, `duration`, `mode`, `modeLabel`, `onStart`, `onStop`, `onStopIterate`, `onPause`, `onCollapse`, `onOpenSettings`, `onTypePrompt`, `onAbort`, `generationErrorType`, `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity` |
| `src/renderer/components/ExpandedHistoryList.jsx` | Left panel of expanded view — session history list with search, All/Saved tabs, filter chips, stats bar, entry rows, count footer, clear all. Owns its own history/filter state; syncs bookmark/rating display from `selected` prop. 359 lines. | props: `currentState`, `selected`, `onSelect(entry\|null)` |
| `src/renderer/components/ExpandedDetailPanel.jsx` | Right panel of expanded view — pure history viewer. `isContentState` flag gates routing. Error states routed via `ExpandedErrorContent` (extracted component). EMAIL_READY renders `EmailReadyState`. RECORDING+email mode shows envelope icon standby panel. Panel header always visible when `!isContentState`. 484 lines. | props: `selected`, `isViewingHistory`, `currentState`, `generatedPrompt`, `thinkTranscript`, `mode`, `onRegenerate`, `onReset`, `onIterate`, `isIterated`, `setGeneratedPrompt`, `isPolishMode`, `polishResult`, `polishTone`, `onPolishToneChange`, `onReuse`, `onEntryChange`, `onTypingSubmit`, `onSwitchToVoice`, `thinkingLabel`, `thinkingAccentColor`, `imageBuilderProps`, `videoBuilderProps`, `workflowBuilderProps`, `transcriptionErrorProps`, `transcriptionSlow`, `generationErrorProps`, `generationSlow`, `emailOutput`, `emailSaved`, `onEmailSave`, `onEmailIterate` |
| `src/renderer/components/ExpandedErrorContent.jsx` | Extracted error content for TRANSCRIPTION_ERROR and GENERATION_ERROR states — extracted from ExpandedDetailPanel. Contains `getTranscriptionFix(error)` helper. Renders `OperationErrorPanel` with appropriate props based on `currentState`. Returns null for any other state. | props: `currentState`, `transcriptionErrorProps`, `transcriptionSlow`, `generationErrorProps`, `generationSlow` |
| `src/renderer/components/ExpandedTypingContent.jsx` | Self-contained TYPING state for expanded view — owns typingText state and typingTextareaRef, auto-focuses on mount. Contains MODE_DESCRIPTIONS constant. 153 lines. | props: `{ mode, onTypingSubmit, onSwitchToVoice }` |
| `src/renderer/components/ExpandedPromptReadyContent.jsx` | Self-contained PROMPT_READY state for expanded view — owns isEditing, editHovered, isCopied, promptRef, preEditValue. Resets edit/copy state when generatedPrompt changes. 179 lines. | props: `{ generatedPrompt, setGeneratedPrompt, isPolishMode, polishResult, mode, onIterate, onRegenerate, onReset, isIterated }` |
| `src/renderer/components/IdleState.jsx` | IDLE panel — pulse ring, mode pill, click-to-record. Top-right expand button uses two-bar icon (matching collapse button in ExpandedTransportBar). `onExpand` prop wired to `handleExpand` in App.jsx. | — |
| `src/renderer/components/RecordingState.jsx` | RECORDING panel — dismiss, waveform, timer, pause (amber ⏸), stop | props: onStop, onDismiss, onPause, duration |
| `src/renderer/components/PausedState.jsx` | PAUSED panel — dismiss, flat amber line, amber timer, resume (▶), stop, status text | props: duration, onResume, onStop, onDismiss |
| `src/renderer/components/IteratingState.jsx` | ITERATING state panel — blue context banner showing previous transcript, blue animated waveform (RAF loop with cleanup), timer, blue glow stop button (iterGlow). All styles inline. | props: contextText, duration, onStop, onDismiss |
| `src/renderer/components/TypingState.jsx` | TYPING state panel — textarea, ⌘↵ submit, × dismiss, switch-to-voice, dynamic height 220–320px. All styles inline. | props: onDismiss, onSubmit, resizeWindow |
| `src/renderer/components/PolishReadyState.jsx` | POLISH mode PROMPT_READY panel — polished text + change notes + tone toggle + copy. All styles inline. | props: `polished`, `changes`, `transcript`, `tone`, `onReset`, `onCopy`, `copied`, `onToneChange` |
| `src/renderer/components/WaveformCanvas.jsx` | Red sine-wave canvas — RAF loop with cleanup. BUG-TOGGLE-004: DPR-aware sizing (`canvas.width = offsetWidth * dpr`, `ctx.scale(dpr, dpr)`); glow layer lineWidth 3 at rgba(200,50,35,0.07), sharp line lineWidth 1 with red gradient. | — |
| `src/renderer/components/ThinkingState.jsx` | THINKING panel — status badge, morph wave, YOU SAID. `label` prop overrides default text. `accentColor` prop (e.g. `rgba(251,146,60,0.8)`) overrides the blue Processing pill with the provided colour. `transcriptionSlow` and `generationSlow` props each show an amber warning banner between MorphCanvas divider and YOU SAID. | props: `transcript`, `mode`, `label`, `accentColor`, `transcriptionSlow`, `generationSlow` |
| `src/renderer/components/MorphCanvas.jsx` | Blue breathing-wave canvas — RAF loop with cleanup. BUG-TOGGLE-004: DPR-aware sizing; glow layer lineWidth 3, sharp line lineWidth 1, amplitude max ~4px, blue gradient peaks at 0.4 opacity. | — |
| `src/renderer/components/PromptReadyState.jsx` | PROMPT_READY panel — copy flash, edit/done, regenerate, reset, direct .md export (handleExport), ⌘E via export-prompt event | `renderPromptOutput()`, `handleExport()` |
| `src/renderer/components/ErrorState.jsx` | ERROR panel — error badge + tap-to-dismiss | — |
| `src/renderer/components/ShortcutsPanel.jsx` | SHORTCUTS panel — 8 shortcut rows with key chips, Done button (returns to prevState). px-[28px] padding, WebkitAppRegion: no-drag | — |
| `src/renderer/components/SettingsPanel.jsx` | SETTINGS panel — path configuration UI for Claude + Whisper binary paths; browse (file picker), recheck (re-resolve), save; "Recheck setup ↺" button calls `window.electronAPI.reopenWizard()`. All styles inline. Both path inputs have `WebkitAppRegion: 'no-drag'` to allow paste inside draggable window. | props: `onClose` |
| `src/renderer/components/OperationErrorPanel.jsx` | Shared error panel for TRANSCRIPTION_ERROR and GENERATION_ERROR states. Props: `icon` ('error'\|'lock'\|'clock'\|'warning'), `title`, `body`, `errorDetails`, `slowWarning`, `fixLabel`, `fixCode`, `fixNote`, `fixPreNote`, `onRetry`, `retryLabel`, `onOpenSettings`. Icon variants: red triangle (error), amber lock (lock), amber clock (clock), amber triangle (warning). Owns its own `copied` state for copy-flash. Fix box shown only when `fixCode` provided; fallback settings hint shown when `onOpenSettings` provided and no `fixCode`. 105 lines. | props as listed |
| `src/renderer/utils/history.js` | History localStorage utilities — all history access goes through this module | `saveToHistory`, `getHistory`, `deleteHistoryItem`, `clearHistory`, `searchHistory`, `formatTime`, `bookmarkHistoryItem`, `rateHistoryItem` |
| `src/renderer/utils/promptUtils.js` | Shared prompt-rendering utilities — extracted from ExpandedView.jsx refactor. getModeTagStyle includes workflow (green) and email (teal) cases. | `parseSections(text)` → `[{label, body}]` (regex supports `/` in labels); `getModeTagStyle(mode)` → `{background, color}` |
| `src/renderer/utils/thinkingLabels.js` | Pure utility for THINKING state progress UX — mode-specific label sequences and accent colours. No React, no side effects. | `getLabelSequence(mode, phase)` → `string[]`; `getModeAccent(mode)` → RGBA string |
| `vitest.config.js` | Vitest test runner config — environment: node, include: tests/**/*.test.js | — |
| `tests/utils.test.js` | Unit tests for pure utility functions — 23 tests across 4 modules | `parseSections` (5 tests), `getModeTagStyle` (9: polish, refine, image, design, workflow, video, email, standard prose, unknown), `formatTime` (4), `parsePolishOutput` (5) |
| `src/renderer/components/VideoBuilderState.jsx` | VIDEO_BUILDER state — Veo 3.1 video prompt review screen. 9 chip rows (cameraMovement, aspectRatio[API], resolution[API], audio[Veo], cinematicStyle, lighting, colourGrade, pacing, shotType[advanced]). AI pre-filled chips show orange dot; user chips no dot. Special rows: Setting text input, Dialogue toggle+input, First frame toggle, Ref images toggle. 4K cost warning. Advanced toggle. Footer: Reiterate, Copy now, Confirm & generate. Always expanded-only. | props: `transcript`, `videoDefaults`, `videoAnswers`, `showAdvanced`, `activePickerParam`, `dialogueText`, `settingDetail`, `onChipRemove`, `onChipAdd`, `onParamChange`, `onToggleAdvanced`, `onOpenPicker`, `onClosePicker`, `onDialogueChange`, `onSettingChange`, `onConfirm`, `onCopyNow`, `onReiterate` |
| `src/renderer/components/VideoBuilderDoneState.jsx` | VIDEO_BUILDER_DONE state — assembled Veo 3.1 prompt output. Two-column: assembled prompt + param breakdown. Header: green dot + "Video prompt ready" + ← Edit + Start over. "Optimised for veo-3.1-generate-preview" orange chip. Save + Copy prompt actions. | props: `prompt`, `videoAnswers`, `transcript`, `onCopy`, `onEdit`, `onStartOver`, `isSaved`, `onSave` |
| `src/renderer/components/WorkflowBuilderState.jsx` | WORKFLOW_BUILDER state — n8n node cards review screen. Node cards with green (trigger) / blue (action) number badges, parameter rows, amber placeholder chips (tappable → inline input → green filled value). × delete button per card (hidden when ≤1 node). Connector arrows between cards. Add-another-node dashed button. Action row: placeholder warning (with click instruction) + Start over + Confirm & generate JSON (disabled until all filled). Always expanded-only. | props: `transcript`, `workflowAnalysis`, `filledPlaceholders`, `onFillPlaceholder`, `onAddNode`, `onDeleteNode`, `onConfirm`, `onReiterate`, `onStartOver`, `isExpanded` |
| `src/renderer/components/WorkflowBuilderDoneState.jsx` | WORKFLOW_BUILDER_DONE state — two-column layout. Left: HOW IT WORKS — numbered steps (green trigger, blue action circles) + connecting lines + HOW TO IMPORT box (7 import steps). Right: N8N WORKFLOW JSON — syntax-highlighted JSON (blue keys, green strings, orange numbers) via custom regex renderer. Action row: Save (shows "Saved ✓" when isSaved) + Copy JSON (shows "Copied!" flash). | props: `workflowAnalysis`, `workflowJson`, `onEdit`, `onStartOver`, `onSave`, `isSaved`, `onCopy`, `isCopied`, `isExpanded` |
| `src/renderer/components/EmailReadyState.jsx` | EMAIL_READY state — two-column email output. Panel header: teal dot + "Email ready" + tone badge. Left: YOU SAID transcript + TONE ANALYSIS rows + WHY THIS TONE teal box. Right: SUBJECT LINE + copy button + EMAIL BODY (pre-wrap). Action row: Edit + Save + Copy subject + Copy email. Owns copiedSubject, copiedEmail, isEditing, editedBody state. | props: `emailOutput`, `transcript`, `onIterate`, `onReset`, `onSave`, `isSaved`, `isExpanded` |
| `src/renderer/components/ImageBuilderState.jsx` | IMAGE_BUILDER state — all-params review screen (redesigned from tier-interview). 18 params: 11 essential (always shown) + 7 advanced (collapsed by default). AI pre-filled chips show purple dot; user-added chips show brighter purple. Inline option picker dropdown per row (IMG-011). Custom text input for Background ("Custom / describe it") and Avoid ("Custom (type it)"). Compact bar (520px scrollable) + expanded view. Exports `PARAM_CONFIG` array. | props: `transcript`, `imageDefaults`, `imageAnswers`, `showAdvanced`, `activePickerParam`, `onChipRemove`, `onChipAdd`, `onParamChange`, `onToggleAdvanced`, `onOpenPicker`, `onClosePicker`, `onConfirm`, `onCopyNow`, `onReiterate`, `isExpanded` |
| `src/renderer/components/ImageBuilderDoneState.jsx` | IMAGE_BUILDER_DONE state — assembled image prompt box, param summary (orange chips), Edit answers / Start over / Copy prompt actions. Expanded: two-column layout with prompt + param breakdown + "Optimised for" chips (dynamic based on `answers.model` — shows selected model with API ID + "ChatGPT image gen"). | props: `prompt`, `answers`, `transcript`, `onEditAnswers`, `onStartOver`, `isExpanded` |
| `src/renderer/components/HistoryPanel.jsx` | HISTORY state panel — split-panel history UI; full inline styles (no Tailwind); left 240px list with search + HistoryEntryItem rows; right detail delegated to HistoryDetailPanel. 362 lines. | props: `onClose`, `onReuse` |
| `src/renderer/components/HistoryDetailPanel.jsx` | Right panel of HistoryPanel — prompt detail with bookmark toggle, PromptSections rendering, polishChanges notes, rating section (👍/👎 + tag chips), Copy + Reuse buttons. Manages own `copied` state. 168 lines. | props: `{ selected, onCopy, onReuse, onBookmark, onRate, onTag }` |
| `src/renderer/components/HistoryEntryItem.jsx` | Single row in HistoryPanel entry list — handles hover state, selection, delete click (stopPropagation internal). 111 lines. | props: `{ entry, isSelected, isHovered, onSelect, onHoverEnter, onHoverLeave, onDelete }` |
| `src/renderer/components/PromptSections.jsx` | Shared prompt-rendering component — parses prompt text into labeled sections (UPPERCASE: headers) with configurable label colour, text size, text colour. Replaces duplicated renderPromptSections in HistoryDetailPanel and ExpandedDetailPanel. | `export default PromptSections({ prompt, labelColor, textSize, textColor })` |
| ~~`src/renderer/styles/tokens.css`~~ | ~~CSS custom properties (:root) + body.light overrides~~ | deleted — FEATURE-005 |
| ~~`src/renderer/styles/bar.css`~~ | ~~.bar glass container + ::before tint + ::after accent~~ | deleted — FEATURE-005 |
| ~~`src/renderer/styles/states.css`~~ | ~~All per-state layout CSS + @keyframes~~ | deleted — FEATURE-005 |
| `dist-renderer/` | Built React renderer output — loaded by Electron in production | — |

---

## IPC channels (registered in main.js)

| Channel | Direction | Status |
|---------|-----------|--------|
| `generate-prompt` | renderer → main | ✅ registered — spawn(claudePath, ['-p', systemPrompt]), transcript embedded in system prompt via PROMPT_TEMPLATE, returns { success, prompt, error }. Accepts optional `options.tone` for polish mode — used to replace `{TONE}` placeholder in polish system prompt. For mode `image`: returns `{ success: true, prompt: transcript }` immediately (passthrough — no Claude call; App.jsx routes to IMAGE_BUILDER). |
| `generate-raw` | renderer → main | ✅ registered — spawn(claudePath, ['-p', systemPrompt]), full system prompt passed from renderer (no MODE_CONFIG); used by iteration flow. Returns { success, prompt, error } |
| `copy-to-clipboard` | renderer → main | ✅ registered — clipboard.writeText({ text }) → { success: true } |
| `check-claude-path` | renderer → main | ✅ registered — returns { found, path } or { found: false, error } |
| `resize-window` | renderer → main | ✅ registered — win.setSize(520, height, true) |
| `transcribe-audio` | renderer → main | ✅ registered — writes audio to tmpdir, runs Whisper CLI, returns { success, transcript, error } |
| `show-mode-menu` | renderer → main | ✅ registered — builds native Electron radio menu from MODE_CONFIG keys |
| `set-window-buttons-visible` | renderer → main | ✅ registered — win.setWindowButtonVisibility(visible); hidden during RECORDING |
| `splash-done` | renderer → main | ✅ registered — hides splashWin, shows win, calls registerShortcut() |
| `splash-check-cli` | renderer → main | ✅ registered — returns { ok: !!claudePath, path: claudePath } |
| `splash-check-whisper` | renderer → main | ✅ registered — returns { ok: !!whisperPath, path: whisperPath } — used by splash screen Whisper check |
| `check-mic-status` | renderer → main | ✅ registered — calls systemPreferences.askForMediaAccess('microphone'), returns { granted: boolean } |
| `splash-open-url` | renderer → main | ✅ registered — shell.openExternal(url) if url starts with https:// |
| `request-mic` | renderer → main | ✅ registered — returns { ok: true } (no-op; mic checked in splash renderer) |
| `shortcut-triggered` | main → renderer | ✅ registered — fires on ⌥Space (or fallback) |
| `shortcut-conflict` | main → renderer | ✅ registered — fires if fallback used, sends { fallback } |
| `mode-selected` | main → renderer | ✅ registered — sent from show-mode-menu click handler with mode key |
| `get-theme` | renderer → main | ✅ registered — returns { dark: boolean } for current macOS appearance |
| `theme-changed` | main → renderer | ✅ registered — sent by nativeTheme.on('updated') with { dark: boolean } |
| `show-shortcuts` | main → renderer | ✅ registered — sent by CommandOrControl+Shift+/ global shortcut or "Keyboard shortcuts ⌘?" context menu item |
| `shortcut-pause` | main → renderer | ✅ registered — sent by Alt+P global shortcut; wired in App.jsx via onShortcutPause — toggles pause/resume |
| `save-file` | renderer → main | ✅ registered — dialog.showSaveDialog + fs.writeFileSync; returns `{ ok, filePath }` or `{ ok: false }` |
| `resize-window-width` | renderer → main | ✅ registered — win.setSize(width, h, true) with setResizable guards |
| `set-window-size` | renderer → main | ✅ registered — win.setMinimumSize + setMaximumSize + setSize(width, height) atomically; used by openHistory/closeHistory to avoid race condition between separate width/height calls |
| `show-history` | main → renderer | ✅ registered — sent by "History ⌘H" context menu item |
| `uninstall-promptly` | renderer → main | ✅ registered — shows native confirmation dialog, removes all data dirs + TCC, quits app; also called from tray menu via handleUninstall() |
| `get-stored-paths` | renderer → main | ✅ registered — returns { claudePath, whisperPath } from config.json (userData) |
| `save-paths` | renderer → main | ✅ registered — saves { claudePath, whisperPath } to config.json and updates runtime vars |
| `browse-for-binary` | renderer → main | ✅ registered — opens macOS file picker (openFile), returns { path } or { path: null } |
| `recheck-paths` | renderer → main | ✅ registered — reruns resolveClaudePath + resolveWhisperPath, returns { claude: { ok, path }, whisper: { ok, path } } |
| `open-settings` | main → renderer | ✅ registered — sent by tray "Path configuration..." item and ⌘, shortcut; triggers SETTINGS state via onOpenSettings IPC listener in useKeyboardShortcuts.js |
| `update-menubar-state` | renderer → main | ✅ registered — maps STATES enum string → icon state (idle/recording/thinking/ready); calls `updateMenuBarIcon()` which sets tooltip + pulse interval (600ms) for recording/thinking, steady image for idle/ready |
| `set-last-prompt` | renderer → main | ✅ registered — stores prompt string in `lastGeneratedPrompt` module var; called after every successful generation; used by "Copy last prompt" tray menu item (FEATURE-018) |
| `check-claude` | renderer → main | ✅ registered — 3-step verification: resolveClaudePath + execFile --version + spawn test generation ('respond with only the word READY', 15s timeout). Returns `{ found, path, version, working, error, authError }`. Auth error detected if stdout/stderr contains 'not authenticated' \| 'login' \| 'unauthorized'. (ONBD-001) |
| `check-whisper` | renderer → main | ✅ registered — resolves whisperPath then runs --help to verify (exec fallback for 'python3 -m whisper' compound path). Returns `{ found, path, error }`. (ONBD-002) |
| `check-ffmpeg` | renderer → main | ✅ registered — runs resolveFfmpegPath() then execFile -version to verify. Returns `{ found, path, error }`. (ONBD-002) |
| `check-whisper-model` | renderer → main | ✅ registered — checks ~/.cache/whisper/base.pt and ~/Library/Caches/whisper/base.pt via fs.statSync. Downloaded = file exists AND size > 100MB. Returns `{ downloaded, path, sizeMB }`. (ONBD-003) |
| `download-whisper-model` | renderer → main | ✅ registered — spawns `whisper /dev/null --model base` (python3 -m whisper handled). Parses tqdm stderr via regex on \r\n splits; pushes `whisper-download-progress` events. Returns `{ success: true }` or `{ success: false, error }`. (ONBD-004) |
| `whisper-download-progress` | main → renderer | ✅ push — sent during model download; payload `{ percent, mbDone, mbTotal, secondsLeft }`. (ONBD-004) |
| `retry-transcription` | renderer → main | ✅ registered — reuses `lastTempAudioPath` if file still exists, reruns Whisper CLI; returns same shape as `transcribe-audio`. Error if no audio available. (ONBD-005) |
| `retry-generation` | renderer → main | ✅ registered — reuses `lastTranscript` + `currentMode`, reruns same spawn logic as `generate-prompt`; returns same shape. Error if no transcript available. (ONBD-005) |
| `transcription-slow-warning` | main → renderer | ✅ push — fired after 20s of transcription with no result; renderer sets `transcriptionSlow=true` → amber warning in ThinkingState. (ONBD-006) |
| `generation-slow-warning` | main → renderer | ✅ push — fired after 30s of generation with no result; renderer sets `generationSlow=true` → amber warning in ThinkingState. (ONBD-007) |
| `check-setup-complete` | renderer → main | ✅ registered — reads `setupComplete` from config.json; returns `{ complete: bool }`. Used by splash.html on load to skip wizard if already done. (ONBD-008) |
| `set-setup-complete` | renderer → main | ✅ registered — writes `{ ...readConfig(), setupComplete: true }` to config.json. Called on wizard completion or skip confirm. (ONBD-008) |
| `reset-setup-complete` | renderer → main | ✅ registered — writes `setupComplete: false` to config.json. (ONBD-008) |
| `reopen-wizard` | renderer → main | ✅ registered — resets `setupComplete: false`, recreates splashWin, loads splash.html, shows splashWin, hides main win. Called from SettingsPanel "Recheck setup ↺" button. (ONBD-013) |
| `toggle-expand` | main → renderer | ✅ push — sent by `win.on('maximize')` handler (intercepts native zoom button press, calls `win.unmaximize()` first). Renderer listens via `onToggleExpand` in `useKeyboardShortcuts.js` and calls `handleExpand()`. NOTE: with `resizable: false`, macOS greys out the zoom button regardless of `maximizable: true` — this channel currently fires only if the window were made resizable. The custom expand button in IdleState is the active expand path. |

---

## State machine (in index.html)

**Function:** `setState(newState, payload = {})`
- Calls `stopMorphAnim()` at entry — cancels any live morph RAF loop
- Hides all panels, shows active panel by ID
- Handles payload: `ERROR` → sets `error-message` textContent; `PROMPT_READY` → calls `renderPromptOutput(generatedPrompt)`
- Calls `window.electronAPI.resizeWindow(STATE_HEIGHTS[newState])` wrapped in `requestAnimationFrame`

| State | Panel ID | Height | Notes |
|-------|----------|--------|-------|
| `IDLE` | `panel-idle` | 134px | Mode pill, shortcut hint, ⌘? hint; expand button top-right (POLISH-TOGGLE) |
| `EXPANDED` | `ExpandedView` | 860px | isExpanded=true layout mode; window 1100×860; three-zone: top bar / left history / right state-content (BUG-TOGGLE-005) |
| `RECORDING` | `panel-recording` | 89px | Waveform canvas, timer, dismiss/pause/stop buttons; traffic lights hidden |
| `PAUSED` | PausedState | 89px | Flat amber line, amber timer, resume+stop buttons; traffic lights hidden; status "Paused — tap resume to continue" |
| `ITERATING` | IteratingState | 200px | Blue context banner + blue waveform + timer + blue stop; traffic lights hidden; separate iter MediaRecorder from main recording |
| `TYPING` | TypingState | 244–320px | h-[28px] traffic light spacer; textarea + submit button; dynamic height: 244 + floor(lines/4)×40, max 320; traffic lights visible |
| `THINKING` | `panel-thinking` | 220–320px | Morph wave canvas, YOU SAID transcript; height clamped to transcript length |
| `PROMPT_READY` | `panel-ready` | 560px | Prompt output + action buttons (Edit, Copy prompt). Export button in top row → direct .md save |
| `ERROR` | `panel-error` | 101px | Error icon, message, tap-to-dismiss |
| `HISTORY` | HistoryPanel | 720px | Split-panel history; window width 746px; setWindowSize(746,720) + updateMenuBarState(HISTORY) called in openHistory; closeHistory → setWindowSize(520, IDLE height) + updateMenuBarState(IDLE) → IDLE |
| `SHORTCUTS` | ShortcutsPanel | 380px | 8 shortcuts with key chips; Done → previous state; triggered via ⌘? or context menu |
| `SETTINGS` | SettingsPanel | 322px | Path configuration panel — Claude + Whisper binary paths, browse + recheck; triggered via ⌘, or tray "Path configuration..." |
| `IMAGE_BUILDER` | ImageBuilderState | 380–520px dynamic | 3-tier guided interview (13 questions); enters after THINKING when mode=image; height recalculated per tier (380/420/400 base + 28px/answered row) |
| `IMAGE_BUILDER_DONE` | ImageBuilderDoneState | 380px | Final assembled image prompt + param summary; Claude assembly via generate-raw; Edit answers / Start over / Copy actions |
| `VIDEO_BUILDER` | VideoBuilderState | 860px (expanded only) | Veo 3.1 video prompt builder — 9 chip rows, dialogue input, advanced params; orange accent; enters after THINKING when mode=video |
| `VIDEO_BUILDER_DONE` | VideoBuilderDoneState | 860px (expanded only) | Final assembled Veo 3.1 prompt; two-column layout; Save + Copy actions; Claude assembly via generate-raw |
| `WORKFLOW_BUILDER` | WorkflowBuilderState | 860px (expanded only) | n8n workflow node cards review; amber placeholder chips; green trigger / blue action badges; enters after THINKING when mode=workflow |
| `WORKFLOW_BUILDER_DONE` | WorkflowBuilderDoneState | 860px (expanded only) | HOW IT WORKS + N8N JSON two-column layout; syntax-highlighted JSON; Save + Copy JSON actions |
| `TRANSCRIPTION_ERROR` | OperationErrorPanel (via ExpandedDetailPanel) | 860px (expanded only) | Whisper failure — red error icon, details box, fix command (amber) derived from error string via `getTranscriptionFix`, Open settings + Try again ↺. Collapsed path uses ERROR state instead. (ONBD-014) |
| `GENERATION_ERROR` | OperationErrorPanel (via ExpandedDetailPanel) | 860px (expanded only) | Claude failure — 4 error types: auth (amber lock icon), timeout (amber clock), empty (amber warning), unknown (red warning). Each type has distinct title/body/fix command. Collapsed path uses ERROR state with inline message. (ONBD-015) |
| `EMAIL_READY` | EmailReadyState (via ExpandedDetailPanel) | 860px (expanded only) | Email draft output — two-column layout. Always expanded. Teal accent. Direct email output (no prompt intermediary). Left: transcript + tone analysis + why-this-tone box. Right: subject line + email body. |

> Note: FIRST_RUN state removed from index.html — replaced by splash.html (D-007, FEATURE-001)

---

## React state + refs (in App.jsx) — FEATURE-004

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `currentState` | useState string | `transition()` | all components (conditional render) |
| `generatedPrompt` | useState string | stopRecording onstop, handleRegenerate | PromptReadyState |
| `errorMessage` | useState string | `transition(ERROR, {message})` | ErrorState |
| `thinkTranscript` | useState string | stopRecording, handleRegenerate | ThinkingState |
| `originalTranscript` | useRef string | stopRecording onstop — set ONCE, never mutated | PromptReadyState, handleRegenerate |
| `stateRef` | useRef string | mirrors currentState — stale-closure-safe for IPC handlers | onShortcutTriggered callback, onShowShortcuts callback, keydown listener |
| `prevStateRef` | useRef string | state before SHORTCUTS or HISTORY transition — for Done/Close button return | ShortcutsPanel onClose handler, HistoryPanel onClose handler |
| `generatedPromptRef` | useRef string | mirrors generatedPrompt — stale-closure-safe for keydown listener | ⌘C handler |
| `mediaRecorderRef` | useRef MediaRecorder\|null | startRecording, handleDismiss | stopRecording, handleDismiss, pauseRecording, resumeRecording |
| `audioChunksRef` | useRef Blob[] | startRecording ondataavailable | stopRecording onstop |
| `isProcessingRef` | useRef boolean | stopRecording start/end guard | stopRecording early-exit guard |
| `isPausedRef` | useRef boolean | pauseRecording/resumeRecording/handleDismiss | guard |
| `recTimerRef` | useRef interval\|null | startTimer/pauseTimer/stopTimer | cleared on pause/stop/dismiss |
| `recSecs` | useState number | startTimer interval | duration formatting for RecordingState + PausedState |
| `iterationBase` | useRef (owned by useIteration.js) | handleIterate — set when user taps ↻ Iterate | stopIterating |
| `isIterated` | useRef boolean (in App.jsx — shared with useIteration + useRecording) | stopIterating (true on success); stopRecording onstop (reset false) | PromptReadyState isIterated prop — controls badge |
| `polishResult` | useState (in usePolishMode) `{polished,changes}|null` | stopRecording/handleTypingSubmit/handleRegenerate/handlePolishToneChange | PolishReadyState |
| `polishTone` | hook (usePolishMode→useTone) string | usePolishMode() | IdleState, PolishReadyState, generate calls |
| `polishToneRef` | useRef (in usePolishMode) string | mirrors polishTone — stale-closure-safe for generate calls | stopRecording, handleTypingSubmit, handleRegenerate |
| `transitionRef` | useRef (in App.jsx) function | updated every render: `transitionRef.current = transition` | usePolishMode.handlePolishToneChange — calls transitionRef.current() to avoid stale closure |
| `abortRef` | useRef boolean | `handleAbort()` sets true when aborting from THINKING | `handleGenerateResult` guard — discards stale async result if true, resets to false |
| `copied` | useState (in usePolishMode) boolean | onCopy in PolishReadyState render | PolishReadyState copied prop |
| `transcriptionError` | useState `{error,timedOut,canRetry}\|null` | `setTranscriptionError` in useRecording.js on whisper failure | `transcriptionErrorProps` bundle forwarded to ExpandedDetailPanel |
| `transcriptionSlow` | useState boolean | `onTranscriptionSlowWarning` IPC listener; cleared in `transition()` | ThinkingState `transcriptionSlow` prop + ExpandedDetailPanel |
| `generationError` | useState `{error,errorType,canRetry}\|null` | `handleGenerateResult` on Claude failure (errorType: 'auth'\|'timeout'\|'empty'\|'unknown') | `generationErrorProps` bundle forwarded to ExpandedDetailPanel |
| `generationSlow` | useState boolean | `onGenerationSlowWarning` IPC listener; cleared in `transition()` | ThinkingState `generationSlow` prop + ExpandedDetailPanel |

## Module-scope variables (in index.html — legacy, main branch only)

| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| `state` | string | `setState()` | all features |
| `originalTranscript` | string | `stopRecording()` onstop handler — captured once, never mutated | `setState(THINKING)`, `setState(PROMPT_READY)`, Regenerate, Copy, Edit |
| `generatedPrompt` | string | `generate-prompt` IPC result; Edit Done handler | `renderPromptOutput()`, Copy, Regenerate display |
| `mediaRecorder` | MediaRecorder\|null | `startRecording()` | `stopRecording()`, dismiss handler |
| `audioChunks` | Blob[] | `startRecording()`, `ondataavailable` | `stopRecording()` onstop handler |
| `isProcessing` | boolean | `stopRecording()` start/end guard | `stopRecording()` early-exit guard |
| `morphAnimFrame` | number\|null | `setState(THINKING)` inline animMorph | `stopMorphAnim()` — cancelled at every setState() |
| `recSecs` | number | `startRecTimer()` / `stopRecTimer()` | timer display |
| `recTimer` | interval | `startRecTimer()` | `stopRecTimer()` |
| `waveT` | number | `startRecTimer()` animateWave | wave animation |
| `waveRAF` | number | `startRecTimer()` animateWave | `stopRecTimer()` |
| `LANGUAGES` | array constant | module top | `getLanguageLabel()`, language pill |
| `LANGUAGE_KEY` | string constant | module top | `getLanguage()`, `setLanguage()` |

---

## Module-scope variables (in main.js)

| Variable | Set when | Value |
|----------|----------|-------|
| `claudePath` | app-ready — `resolveClaudePath()` Promise | resolved binary path or null |
| `whisperPath` | app-ready — `resolveWhisperPath()` Promise (awaited) | resolved binary path, `'python3 -m whisper'`, or null |
| `win` | `createWindow()` called after `resolveClaudePath()` resolves | BrowserWindow instance |
| `splashWin` | `app.whenReady()` — created before `win` (560×620); destroyed after `splash-done`; recreated by `reopen-wizard` at same 560×620 dimensions | BrowserWindow instance (null after splash) |
| `PROMPT_TEMPLATE` | module constant | Multi-line template string with `{MODE_NAME}`, `{MODE_INSTRUCTION}`, `{TRANSCRIPT}` placeholders — bypassed for standalone modes |
| `MODE_CONFIG` | module constant | `{ balanced, detailed, concise, chain, code, refine, design, polish }` — 8 modes total; each `{ name, instruction }`; `refine`, `design`, and `polish` have `standalone: true` which causes generate-prompt to use instruction directly instead of wrapping in PROMPT_TEMPLATE |
| `tray` | `updateTrayMenu()` reference — null after FEATURE-017 removed `createTray()` | null (menuBarTray is the sole Tray instance) |
| `menuBarTray` | `createMenuBarIcon()` called from splash-done (FEATURE-017) | Tray instance — 44×44 PNG @2x mic icon; click=show/hide, right-click=context menu |
| `pulseInterval` | MBAR-002 IPC handler (interval ID) or null | interval handle for dot-pulse animation; cleared on every state change and win hide/show |
| `lastGeneratedPrompt` | `set-last-prompt` IPC handler | Last successfully generated prompt string — session memory only, null until first generation; used by "Copy last prompt" tray menu item (FEATURE-018) |
| `lastTempAudioPath` | `transcribe-audio` handler — set after file write, reset to null at start of each new call | Path to last recorded audio temp file; kept on error for retry-transcription; null after reset (ONBD-005) |
| `lastTranscript` | `transcribe-audio` and `retry-transcription` handlers — set on success | Last successfully transcribed text; used by retry-generation (ONBD-005) |
| `currentMode` | `generate-prompt` handler — set at start of each call | Last mode used for generation; used by retry-generation; default 'balanced' (ONBD-005) |
| `configPath` | module constant | `path.join(app.getPath('userData'), 'config.json')` — path to persisted path config file |
| `readConfig()` | called on-demand | reads + parses config.json; returns `{}` on any error |
| `writeConfig(data)` | called on-demand | JSON.stringify(data, null, 2) → config.json |

---

## CSS design tokens (in index.html)

```css
:root {
  --blue: #0A84FF;           /* action / interactive elements */
  --red: #FF3B30;            /* recording / stop */
  --green: #30D158;          /* success / copy flash */
  --font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  --bar-radius: 18px;
  --bar-backdrop: blur(40px) saturate(180%);
  --bar-shadow: 0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4);
  /* border tokens: --border-top, --border-left, --border-right, --border-bottom */
  /* gradient tokens: --highlight-top, --accent-bottom, --divider */
}
```

> `body.light` override block applies the light-mode palette when macOS is in Light Mode.
> Applied via `classList.toggle('light', !dark)` — orthogonal to app state, never routed through `setState()`.

---

## localStorage keys

| Key | Written by | Read by | Notes |
|-----|-----------|---------|-------|
| `mode` | `useMode.setMode()` | `useMode.mode` — in boot, generate-prompt, regenerate | Default: `'balanced'` |
| `promptly_history` | `saveToHistory()` in App.jsx / `utils/history.js` | HistoryPanel, App.jsx | JSON array of up to 100 entries `{ id, transcript, prompt, mode, timestamp, title }` — `title` is first 5 words of transcript. Iteration entries also include optional fields: `isIteration: true` and `basedOn: string` (first 100 chars of original prompt). Polish entries also include optional `polishChanges: string[]` field. FEATURE-020 adds optional fields: `bookmarked: boolean`, `rating: 'up' \| 'down' \| null`, `ratingTag: 'Perfect' \| 'Clear' \| 'Detailed' \| 'Too long' \| null`. |
| `promptly_polish_tone` | `useTone.setPolishTone()` | `useTone.getPolishTone()` | Default: `'formal'`. Persists Formal/Casual tone preference for polish mode. |

> `firstRunComplete` key removed — splash screen replaced in-bar first-run flow (D-007)
> `promptHistory` (old key, 20-entry cap) — replaced by `promptly_history` (100-entry cap) in FEATURE-004
> `promptLanguage` removed — F-LANGUAGE removed (D-LANGUAGE-REMOVE)

---

## DOM element IDs (in index.html)

| Element ID | Panel | Used by |
|------------|-------|---------|
| `bar` | root | `setState()` show/hide |
| `panel-idle` | IDLE | `setState()` |
| `panel-recording` | RECORDING | `setState()` |
| `panel-thinking` | THINKING | `setState()` |
| `panel-ready` | PROMPT_READY | `setState()` |
| `panel-error` | ERROR | `setState()` |
| `idle-area` | IDLE | click → `startRecording()` |
| `mode-pill` | IDLE | mode label display; click → `showModeMenu` |
| `recCanvas` | RECORDING | `drawRecordingWave()` |
| `recDur` | RECORDING | `startRecTimer()` |
| `dismissBtn` | RECORDING | click → cancel recording → IDLE |
| `stopBtn` | RECORDING | click → `stopRecording()` |
| `transcriptWrap` | RECORDING | `setRecordingTranscript()` |
| `transcriptText` | RECORDING | `setRecordingTranscript()` |
| `morph-canvas` | THINKING | `drawMorphWave()` RAF loop |
| `think-transcript` | THINKING | set in `stopRecording()` onstop + regenerate handler |
| `panel-thinking` | THINKING | `scrollHeight` measured for dynamic resize |
| `you-said-text` | PROMPT_READY | `setState(PROMPT_READY)` — sets `originalTranscript` |
| `prompt-output` | PROMPT_READY | `renderPromptOutput()`, Edit mode contenteditable |
| `btn-edit` | PROMPT_READY | Edit/Done toggle |
| `btn-copy` | PROMPT_READY | Copy + green flash |
| `btn-regenerate` | PROMPT_READY | → THINKING → PROMPT_READY |
| `btn-reset` | PROMPT_READY | → IDLE |
| `error-area` | ERROR | click → IDLE |
| `error-message` | ERROR | `setState(ERROR, { message })` |
| `panel-history` | HISTORY | `setState()` |
| `history-list` | HISTORY | `renderHistoryList()` |
| `btn-history-close` | HISTORY | click → IDLE |
| `btn-history-clear` | HISTORY | click → `clearHistory()` + re-render |
| `history-btn` | IDLE | click → HISTORY state |
| `btn-history` | PROMPT_READY | click → HISTORY state |

---

## Smoke test results (Phase 2 complete)

- Full flow: speak → transcribe → generate → prompt ready ✅
- All 5 modes generate distinct structured prompts ✅
- Copy button: green flash 1.8s + clipboard ✅
- Edit: contenteditable, Escape cancels, Done saves ✅
- Regenerate: uses originalTranscript, not edited text ✅
- Splash screen: CLI check → mic check → auto-proceed ✅
- Vibrancy: frosted glass renders on macOS desktop ✅

---

## Known issues / watch items

- `eslint main.js preload.js` — 0 errors, 0 warnings (the intentional `console.error` in uncaughtException has `// eslint-disable-next-line no-console`)
- `npm audit` — 1 moderate devDep vuln in `vitest@2.1.9` (BL-074) — devDep only, not in .dmg; fix: `npm install --save-dev vitest@latest` (upgrades to v4.x)
- `src/renderer/index.html` is not included in the lint script (ESLint 9 cannot parse HTML without a plugin — inline JS reviewed manually; see D-001)
