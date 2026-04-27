# FEATURE-IMAGE-BUILDER Tasks

- [x] IMG-001 — useMode.js image mode + purple accent
  Touches: src/renderer/hooks/useMode.js
  Depends: —

- [x] IMG-002 — main.js MODE_CONFIG + show-mode-menu
  Touches: main.js
  Depends: IMG-001

- [x] IMG-003 (M) — ImageBuilderState.jsx: all-params review screen
  Props: transcript, imageDefaults, imageAnswers, showAdvanced,
    activePickerParam, onChipRemove, onChipAdd, onParamChange,
    onToggleAdvanced, onOpenPicker, onClosePicker,
    onConfirm, onCopyNow, onReiterate, isExpanded
  Touches: src/renderer/components/ImageBuilderState.jsx (full rewrite)
  Depends: IMG-001

- [x] IMG-004 — ImageBuilderDoneState.jsx final output component
  Touches: src/renderer/components/ImageBuilderDoneState.jsx (new)
  Depends: IMG-001

- [x] IMG-005 (M) — App.jsx: two-phase THINKING flow
  Phase 1: pre-selection Claude call → imageDefaults → IMAGE_BUILDER
  Phase 2: assembly Claude call → IMAGE_BUILDER_DONE
  imageAnswers starts as deep copy of imageDefaults
  showAdvanced, activePickerParam state
  ThinkingState label: "Analysing your idea..." / "Assembling prompt..."
  Touches: src/renderer/App.jsx
  Depends: IMG-003, IMG-004

- [x] IMG-006 (S) — App.jsx: chip interaction handlers
  handleChipRemove(param, value)
  handleChipAdd(param, value)
  handleOpenPicker(param)
  handleClosePicker()
  handleToggleAdvanced()
  handleConfirm() → triggers phase 2 THINKING
  Touches: src/renderer/App.jsx
  Depends: IMG-005

- [x] IMG-007 (S) — STATE_HEIGHTS: IMAGE_BUILDER 520px scrollable,
  IMAGE_BUILDER_DONE 380px
  Touches: src/renderer/App.jsx
  Depends: IMG-005

- [x] IMG-008 — history saving for image mode
  Touches: src/renderer/App.jsx, src/renderer/utils/history.js (call only)
  Depends: IMG-005

- [x] IMG-009 (S) — expanded view wiring: new imageBuilderProps bundle
  passed App → ExpandedView → ExpandedDetailPanel with redesigned props.
  ExpandedDetailPanel IMAGE_BUILDER render updated to use new prop names.
  Touches: src/renderer/components/ExpandedDetailPanel.jsx
  Depends: IMG-003, IMG-005

- [ ] IMG-010 — docs update (re-run after redesign tasks complete)
  Touches: vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md, vibe/ARCHITECTURE.md
  Depends: IMG-001 through IMG-009, IMG-011, IMG-012

- [x] IMG-011 (S) — option picker: inline dropdown per param row
  background #1a1a24, flex-wrap chip grid, max-height 160px scroll
  tap option → adds chip + closes; tap outside → closes
  Implemented in IMG-003 (same file, same pass)
  Touches: src/renderer/components/ImageBuilderState.jsx
  Depends: IMG-003

- [x] IMG-012 (S) — merge logic for reiterate
  Preserve user-added chips across re-transcription
  Refresh AI chips from new imageDefaults
  Filter new AI chips through removedByUser to respect previously removed values
  removedByUser persists across reiterations; reset only on Start over
  Implemented in useImageBuilder.js runPreSelection (isReiterate path)
  Touches: src/renderer/hooks/useImageBuilder.js
  Depends: IMG-005, IMG-006
