# FEATURE-IMAGE-BUILDER-V2 Plan

IMG2-001 (S) — main.js: update phase 1 system prompt
  New nested JSON schema (subject/lighting/camera/style/technical)
  replaces old flat schema; all output via generate-raw passthrough (no new IPC)

IMG2-002 (M) — useImageBuilder.js: full rewrite for new schema + variations
  New imageDefaults/imageAnswers shape (nested objects)
  imageVariations, selectedVariation, isGeneratingVariations state
  handleSelectVariation, handleGenerateMoreVariations, handleApplyPreset
  handleSetNegative, handleRemoveNegative, handleSetSeed
  Phase 1.5: fire generateRaw variation call after phase 1, store results
  Reiterate merge logic for nested structure + removedByUser key format
  Updated imageBuilderProps bundle (complete props list from FEATURE_SPEC.md)
  No new IPC channels — all calls use existing generate-raw

IMG2-003 (M) — ImageBuilderState.jsx: full rebuild — category tabs + param rows
  Five tabs: Subject / Lighting / Camera / Style / Technical
  Local activeTab useState (not hoisted)
  Each tab renders its own parameter rows
  Chip selection logic: AI pre-filled (purple dot), user chips, deselect/removedByUser
  Seed inline number input, Negative multi-add inline text input
  Renders VariationsPanel as Zone B sibling (flex row layout)

IMG2-004 (M) — ImageBuilderState.jsx: Technical tab + presets strip
  Stylise/Chaos/Weird chip options
  Seed inline input on chip click
  48 presets in 5 category rows (Photography/Cinematic/Art/Commercial/Mood)
  Default: show 2 rows; "Show all 48 →" expands all 5
  Preset click applies across all tabs, sets activePreset

IMG2-005 (M) — VariationsPanel.jsx (new component)
  Props: variations, selectedVariation, isLoading, onSelectVariation, onGenerateMore
  Variation items: number label, preview (120 chars), focus line
  Selected state: purple left border, full text
  Skeleton loading state (3 rows, pulse animation)
  "Generate 3 more" button: disabled + "Generating…" while isLoading
  "All different →" header link calls onGenerateMore

IMG2-006 (S) — promptUtils.js: parse utilities + tests
  parseImageAnalysisOutput(raw) — fence-strip + JSON.parse phase 1 response
  parseImageAssemblyOutput(raw) — fence-strip + JSON.parse phase 2 response
  tests/utils.test.js: 3 tests each (fenced, raw, malformed)

IMG2-007 (S) — App.jsx: wire new imageBuilderProps bundle
  imageVariations, selectedVariation, isGeneratingVariations passed through
  activePreset passed through
  No new state in App.jsx — all owned by useImageBuilder hook
  Confirm disabled guard: isGeneratingVariations passed to ExpandedDetailPanel

IMG2-008 (M) — ImageBuilderDoneState.jsx: flags display
  Output shows prompt + '\n\n' + flags
  Copy copies prompt + newline + flags
  Header updated to show selected variation focus line (optional)

IMG2-009 (S) — Docs: CODEBASE.md, DECISIONS.md, TASKS.md
  New component: VariationsPanel.jsx
  Updated: useImageBuilder.js, ImageBuilderState.jsx, ImageBuilderDoneState.jsx
  Updated: promptUtils.js (2 new parse functions)
  Updated IPC table note: generate-raw used for both phase 1 + 1.5 + 2
