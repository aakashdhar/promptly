# FEATURE-WORKFLOW-BUILDER — Implementation Plan

WFL-001 (S) — useMode.js: add 'workflow' mode, green accent
WFL-002 (S) — main.js: workflow in MODE_CONFIG + show-mode-menu
  Two system prompts: analysis + JSON assembly
WFL-003 (M) — WorkflowBuilderState.jsx: node cards review screen
  Props: transcript, workflowAnalysis, filledPlaceholders,
    onFillPlaceholder, onAddNode, onConfirm, onReiterate,
    onStartOver, isExpanded
WFL-004 (M) — WorkflowBuilderDoneState.jsx: done screen
  Props: workflowAnalysis, workflowJson, onEdit, onStartOver, isExpanded
WFL-005 (M) — App.jsx: two-phase THINKING + WORKFLOW_BUILDER states
  Phase 1: analysis call → workflowAnalysis → WORKFLOW_BUILDER
  Phase 2: JSON assembly call → WORKFLOW_BUILDER_DONE
  Auto-expand when mode === 'workflow'
  Disable collapse button in workflow mode
WFL-006 (S) — App.jsx: placeholder fill handler
  handleFillPlaceholder(nodeId, paramKey, value)
  handleAddNode()
  handleWorkflowConfirm()
  handleWorkflowReiterate()
WFL-007 (S) — STATE_HEIGHTS: WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE = 860
WFL-008 (S) — Reiterate flow: isReiteratingWorkflow flag,
  preserve filled placeholders on re-analysis
WFL-009 (S) — History: save workflow entries with mode 'workflow'
WFL-010 (S) — Expanded view: hide collapse btn in workflow mode
WFL-011 (S) — Docs: CODEBASE.md, DECISIONS.md, TASKS.md
