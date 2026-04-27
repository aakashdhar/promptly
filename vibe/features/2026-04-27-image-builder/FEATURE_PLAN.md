# FEATURE-IMAGE-BUILDER — Implementation Plan

## Task order
IMG-001 (S) — useMode.js: add 'image' to MODE_LABELS with purple accent
IMG-002 (S) — main.js: add image to show-mode-menu and MODE_CONFIG
  with system prompt for natural language assembly
IMG-003 (M) — ImageBuilderState.jsx: build question UI component
  Accepts: transcript, currentTier, currentQuestion, answers, onSelect,
  onNext, onBack, onSkip, onCopyNow, isExpanded
  Renders: header, you said, answered chips, question, options, footer
IMG-004 (M) — ImageBuilderDoneState.jsx: build final output component
  Accepts: prompt, answers, transcript, onCopy, onEditAnswers, onStartOver
  copied state, isExpanded
  Renders: assembled prompt box, param summary, action row
  Expanded: two-column grid with prompt + param breakdown
IMG-005 (M) — App.jsx: add IMAGE_BUILDER and IMAGE_BUILDER_DONE to STATES
  Add question flow state: currentTier, currentQuestion, imageAnswers
  After THINKING when mode === 'image': generate prompt via Claude using
  image system prompt then transition to IMAGE_BUILDER_DONE directly,
  OR skip Claude and go to IMAGE_BUILDER questions first
  Decision: go to IMAGE_BUILDER questions first, Claude assembles at end
IMG-006 (S) — App.jsx: wire navigation handlers (onNext, onBack, onSkip,
  onCopyNow, onStartOver, onEditAnswers)
IMG-007 (S) — App.jsx: STATE_HEIGHTS for IMAGE_BUILDER (dynamic per tier)
  Tier 1: 420px, Tier 2: 400px (has summary box), Tier 3: 400px
  IMAGE_BUILDER_DONE: 380px
IMG-008 (S) — Save image prompts to history with mode: 'image'
IMG-009 (S) — Expanded view: pass isExpanded prop, render 4-col grid
  and progress bar when isExpanded=true
IMG-010 (S) — docs: CODEBASE.md, DECISIONS.md, TASKS.md

## Order
IMG-001 → IMG-002 → IMG-003 → IMG-004 → IMG-005 → IMG-006 →
IMG-007 → IMG-008 → IMG-009 → IMG-010
