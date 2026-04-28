# FEATURE-VIDEO-BUILDER — Implementation Plan

VID-000 (S) — useVideoBuilder.js hook
  All video builder state + handlers extracted to hook (mirrors useImageBuilder.js).
  Owns: videoDefaults, videoAnswers, videoBuiltPrompt, showVideoAdvanced,
    videoActivePickerParam, videoDialogueText, videoSettingDetail,
    isReiteratingRef, removedByUser.
  Exports: runPreSelection, assembleVideoPrompt, handleChipRemove, handleChipAdd,
    handleParamChange, handleOpenPicker, handleClosePicker, handleToggleAdvanced,
    handleConfirm, handleCopyNow, handleVideoStartOver, handleVideoEditAnswers,
    handleDialogueChange, handleSettingChange.
  Reiterate merge logic: user-added chips preserved, AI chips refreshed,
    removedByUser values excluded.

VID-001 (S) — useMode.js: add 'video' mode, orange accent
  Adds 'video' entry with label 'Video', accent rgba(251,146,60),
  subtitle 'Speak your video idea', dot rgba(251,146,60,0.9).

VID-002 (S) — main.js: video mode in MODE_CONFIG + show-mode-menu
  Adds 'video' key to MODE_CONFIG with standalone: true.
  generate-prompt for mode 'image' returns passthrough — video does the same:
    returns { success: true, prompt: transcript } immediately.
    App.jsx routes to THINKING (pre-selection) after stopRecording.
  Assembly system prompt defined in useVideoBuilder.js (generate-raw call),
    not in main.js MODE_CONFIG.

VID-003 (M) — VideoBuilderState.jsx: full review screen component
  Props: transcript, videoDefaults, videoAnswers, showAdvanced,
    activePickerParam, dialogueText, settingDetail,
    onChipRemove, onChipAdd, onParamChange, onToggleAdvanced,
    onOpenPicker, onClosePicker, onDialogueChange, onSettingChange,
    onConfirm, onCopyNow, onReiterate, isExpanded
  Rows 1–13 per spec. Audio row has 4 options (no Dialogue option).
  Row 11 Dialogue is the sole dialogue entry in advanced section.
  Copy now copies transcript (passed via onCopyNow).

VID-004 (M) — VideoBuilderDoneState.jsx: final output component
  Props: prompt, videoAnswers, transcript, onCopy, onEdit,
    onStartOver, isExpanded
  ← Edit returns to VIDEO_BUILDER (videoAnswers preserved).
  Start over calls onStartOver (resets all → IDLE).
  Save button: saves to history, shows 'Saved ✓' 1.5s flash.

VID-005 (M) — App.jsx: VIDEO_BUILDER + VIDEO_BUILDER_DONE states
  Two-phase THINKING flow with thinkingLabel + thinkingAccentColor.
  transition() payload: { label, accentColor } → sets thinkingLabel,
    thinkingAccentColor; reset to '' on transition away from THINKING.
  ThinkingState.jsx: add thinkingLabel + thinkingAccentColor props;
    when thinkingLabel non-empty, display it; when thinkingAccentColor
    non-empty, use it for wave colour. Existing image mode unchanged.
  Auto-expand when mode === 'video' (handleExpand if !isExpanded).
  videoBuilderProps bundle assembled from useVideoBuilder hook output.
  Error payloads: pre-selection error → ERROR 'Couldn't analyse your
    idea — tap to try again'; assembly error → ERROR 'Couldn't assemble
    prompt — tap to try again'.

VID-006 (S) — App.jsx: STATE_HEIGHTS VIDEO_BUILDER + VIDEO_BUILDER_DONE = 860

VID-007 (S) — Reiterate: isReiteratingVideo flag, merge logic in useVideoBuilder.js
  transition(THINKING, { label: 'Updating idea...', accentColor: 'rgba(251,146,60,0.8)' })
  Merge: user-added chips preserved, AI chips refreshed, removedByUser excluded.

VID-008 (S) — History: save video prompts with mode 'video'
  Entry structure: { id, transcript, prompt, mode:'video', timestamp, title,
    videoAnswers: mergedAnswers (includes dialogueText + settingDetail) }
  Save triggered from: Copy prompt button (auto-save) + Save button in
    VIDEO_BUILDER_DONE action row.

VID-009 (S) — Expanded view: disable collapse button in video mode
  ExpandedTransportBar.jsx: collapse button opacity 0.4, pointer-events none
    when mode === 'video'. Tooltip: "Video mode uses full view".
    Re-enables (opacity 1, pointer-events auto) when mode !== 'video'.

VID-010 (M) — ExpandedView.jsx + ExpandedDetailPanel.jsx: videoBuilderProps wiring
  ExpandedView.jsx: accept videoBuilderProps bundle prop, forward to
    ExpandedDetailPanel.jsx (mirrors imageBuilderProps pattern).
  ExpandedDetailPanel.jsx: render VideoBuilderState when
    currentState === STATES.VIDEO_BUILDER; render VideoBuilderDoneState
    when currentState === STATES.VIDEO_BUILDER_DONE. Pass isExpanded=true.
  ExpandedView.jsx also passes thinkingLabel + thinkingAccentColor through
    to ThinkingState via ExpandedDetailPanel.

VID-011 (S) — Docs: CODEBASE.md, DECISIONS.md, TASKS.md
