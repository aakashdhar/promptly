# FEATURE-WORKFLOW-BUILDER Tasks

> **Estimated effort:** 11 tasks — S: 8 (<2hrs each), M: 3 (2-4hrs each) — approx. 8 hours total

---

### WFL-001 · useMode.js — add 'workflow' mode with green accent
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#mode-identity
- **Dependencies**: None
- **Touches**: `src/renderer/hooks/useMode.js`

**What to do**: Add `workflow: 'Workflow'` to MODE_LABELS. No other changes needed — the green accent and subtitle are handled in IdleState and ExpandedTransportBar via mode prop, not in useMode.

**Acceptance criteria**:
- [x] `useMode()` returns `modeLabel === 'Workflow'` when mode is 'workflow'
- [x] No other MODE_LABELS entries changed

**Self-verify**: Read useMode.js and confirm workflow entry present. Check no existing labels broken.
**Test requirement**: Manual — switch to workflow mode via context menu, confirm label reads "Workflow".
**⚠️ Boundaries**: Only touch useMode.js. Do not add accent colour logic here.
**CODEBASE.md update?**: Yes — update useMode.js row: add workflow to MODE_LABELS.
**Architecture compliance**: localStorage wrapper pattern; no direct localStorage access.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-002 · main.js — MODE_CONFIG + show-mode-menu + system prompts
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#step-3-claude-analysis-call + FEATURE_SPEC.md#step-5-claude-json-assembly-call
- **Dependencies**: None (parallel with WFL-001)
- **Touches**: `main.js`

**What to do**:
1. Add `workflow` entry to `MODE_CONFIG`: `{ name: 'Workflow', passthrough: true, instruction: '' }` — passthrough:true causes generate-prompt to return transcript immediately; actual Claude calls use generate-raw.
2. Add `'workflow'` to the `show-mode-menu` array (after video).
3. The two system prompts (analysis + JSON assembly) live in the renderer (WorkflowBuilderState / App.jsx) and are passed via generate-raw — nothing extra in main.js for prompts.

**Acceptance criteria**:
- [x] 'Workflow' appears in the right-click mode menu
- [x] MODE_CONFIG.workflow has passthrough: true
- [x] show-mode-menu array includes 'workflow'
- [x] No existing MODE_CONFIG entries changed

**Self-verify**: Read main.js MODE_CONFIG and show-mode-menu. Confirm workflow present and passthrough true.
**Test requirement**: Manual — right-click bar, confirm "Workflow" appears in mode menu with checkmark when active.
**⚠️ Boundaries**: Only main.js. Do not add IPC channels.
**CODEBASE.md update?**: Yes — update main.js row: add workflow to MODE_CONFIG (passthrough) + show-mode-menu count.
**Architecture compliance**: MODE_CONFIG passthrough pattern (matches image/video builders).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-003 · WorkflowBuilderState.jsx — node cards review screen
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#workflow_builder-review-screen
- **Dependencies**: WFL-001, WFL-002
- **Touches**: `src/renderer/components/WorkflowBuilderState.jsx` (new file)

**What to do**: Create WorkflowBuilderState.jsx — the WORKFLOW_BUILDER state review screen. Full props interface:

```js
WorkflowBuilderState({
  transcript,           // string — original spoken transcript
  workflowAnalysis,     // object — Claude phase 1 result
  filledPlaceholders,   // object — keyed by `${nodeId}-${paramKey}`
  onFillPlaceholder,    // fn(nodeId, paramKey, value)
  onAddNode,            // fn() — adds blank node card
  onConfirm,            // fn() — triggers phase 2 JSON assembly
  onReiterate,          // fn() — re-records
  onStartOver,          // fn() — returns to IDLE
  isExpanded,           // boolean
})
```

Render:
- Header: workflow icon SVG + workflowAnalysis.workflowName + amber placeholder count badge + "↺ Reiterate" link
- "YOU SAID" + transcript (italic, rgba(255,255,255,0.38))
- Divider
- Scrollable node cards (see spec for full card spec including trigger=green badge, action=blue badge)
- Placeholder chips: amber, tappable → inline text input → on blur/enter saves via onFillPlaceholder → chip becomes green value display
- Connectors between cards (↓ arrow + relationship description derived from workflowAnalysis.connections — if single-string, show it verbatim under first connector; for multi-node, show "↓" only)
- Blank node card schema (from spec fix P1-006): { id: auto-increment from existing max+1, name: '', type: '', purpose: '', parameters: {}, placeholders: [], credentialType: null } — name and type shown as text inputs, all other fields hidden until filled
- Add another node: dashed button below last card
- Action row: amber warning if placeholders unfilled + "Start over" + "Confirm & generate JSON →" (disabled if any placeholder unfilled)

**Acceptance criteria**:
- [x] Node cards render with correct green/blue number badges (trigger=1=green, action=blue)
- [x] Placeholder chips are amber, clicking opens inline input
- [x] Filling placeholder updates chip to green value display
- [x] Unfilled placeholder count shown in header badge
- [x] ~~Confirm button disabled while any placeholder unfilled~~ (removed D-WFL-NOGATE 2026-04-29 — button always enabled)
- [x] Advisory hint shown when placeholders unfilled (not a blocking gate)
- [x] "Add another node" adds blank card with text inputs for name and type
- [x] "↺ Reiterate" calls onReiterate
- [x] "Start over" calls onStartOver
- [x] Connector line appears between each node card pair

**Self-verify**: Re-read FEATURE_SPEC.md#workflow_builder-review-screen. Tick every visual criterion.
**Test requirement**: Manual — load with a 3-node workflowAnalysis, fill all placeholders, confirm button enables.
**⚠️ Boundaries**: New file only. No dangerouslySetInnerHTML. All text via JSX text nodes. No runtime npm deps.
**CODEBASE.md update?**: Yes — add WorkflowBuilderState.jsx row.
**Architecture compliance**: Functional component; inline styles for stateful values; Tailwind for static layout; no direct IPC.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-004 · WorkflowBuilderDoneState.jsx — done screen
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#workflow_builder_done-layout
- **Dependencies**: WFL-001, WFL-002
- **Touches**: `src/renderer/components/WorkflowBuilderDoneState.jsx` (new file)

**What to do**: Create WorkflowBuilderDoneState.jsx — the WORKFLOW_BUILDER_DONE state. Full props interface:

```js
WorkflowBuilderDoneState({
  workflowAnalysis,   // object — phase 1 result (for "How it works" column)
  workflowJson,       // string — raw JSON from phase 2
  onEdit,             // fn() — returns to WORKFLOW_BUILDER
  onStartOver,        // fn() — returns to IDLE
  onSave,             // fn() — toggles isSaved flag (bookmarks history entry)
  isSaved,            // boolean — Save button shows "Saved ✓" when true
  onCopy,             // fn() — copies workflowJson to clipboard
  isCopied,           // boolean — Copy button shows "Copied!" flash
  isExpanded,         // boolean
})
```

Render:
- Header: green dot + workflowAnalysis.workflowName + node count badge + "← Edit nodes" + "Start over"
- Two-column layout (1fr 1fr):
  - Left: "HOW IT WORKS" — numbered steps (green trigger circle, blue action circles) + connecting lines + import instructions box
  - Right: "N8N WORKFLOW JSON" — syntax-highlighted JSON preview
    - Syntax highlight rules: keys=blue rgba(100,170,255,0.8), string values=green rgba(74,222,128,0.8), numbers=orange rgba(251,146,60,0.8), booleans/null=rgba(255,255,255,0.4)
    - Note: no amber highlight for placeholders — all placeholders replaced before phase 2 (see spec fix P1-004)
    - Implement via a simple regex renderer over the JSON string (no library)
- Action row: "Save" (secondary, shows "Saved ✓" when isSaved) + "Copy JSON" (primary green gradient, shows "Copied!" flash when isCopied)

**Acceptance criteria**:
- [x] Two-column layout renders (left HOW IT WORKS, right JSON)
- [x] Numbered steps use green circle for trigger node, blue for action nodes
- [x] Import instructions box renders below steps
- [x] JSON preview shows syntax-highlighted JSON (blue keys, green strings, orange numbers)
- [x] Copy JSON button calls onCopy and shows "Copied!" flash
- [x] Save button calls onSave and shows "Saved ✓" when isSaved=true
- [x] "← Edit nodes" calls onEdit
- [x] "Start over" calls onStartOver

**Self-verify**: Re-read FEATURE_SPEC.md#workflow_builder_done-layout. Tick every visual criterion.
**Test requirement**: Manual — load with sample workflowAnalysis + workflowJson, verify both columns render, copy to clipboard works.
**⚠️ Boundaries**: New file only. JSON syntax highlight must be custom regex — no highlight.js or similar. No dangerouslySetInnerHTML with workflowJson — render highlighted spans via JSX map.
**CODEBASE.md update?**: Yes — add WorkflowBuilderDoneState.jsx row.
**Architecture compliance**: Functional component; inline styles; no direct IPC.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-005 · App.jsx — WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE states + auto-expand + disable collapse
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#state-machine-additions + FEATURE_SPEC.md#critical-behaviour
- **Dependencies**: WFL-003, WFL-004
- **Touches**: `src/renderer/App.jsx`

**What to do**:
1. Add `WORKFLOW_BUILDER` and `WORKFLOW_BUILDER_DONE` to STATES object.
2. Add `workflowAnalysis`, `filledPlaceholders`, `workflowJson`, `isSaved`, `isCopied`, `isReiteratingWorkflow` to App state.
3. In `handleGenerateResult`: add workflow branch — if mode==='workflow', call `runWorkflowAnalysis(transcript)` from useWorkflowBuilder (WFL-006).
4. Auto-expand on mode switch: in the `mode-selected` IPC handler (in useKeyboardShortcuts or App's mode-selected useEffect), add: `if (newMode === 'workflow' && !isExpandedRef.current) { handleExpand() }` — follow exact same pattern as video builder's auto-expand.
5. Pass `workflowBuilderProps` bundle to ExpandedView → ExpandedDetailPanel (same pattern as imageBuilderProps / videoBuilderProps).
6. In ExpandedTransportBar / ExpandedView: pass `mode` prop so collapse button can be disabled — already done for video mode, extend to also disable for 'workflow'. The tooltip is `title="Workflow mode uses full view"` (HTML title attribute — matches simplest approach).
7. `thinkingLabel` and `thinkingAccentColor` wired for both phases (green `rgba(34,197,94,0.85)`).

**Acceptance criteria**:
- [x] STATES.WORKFLOW_BUILDER and STATES.WORKFLOW_BUILDER_DONE defined
- [x] handleGenerateResult routes workflow mode to runWorkflowAnalysis
- [x] Auto-expand fires when mode switches to 'workflow' while minimized
- [x] Collapse button disabled (opacity 0.4, cursor not-allowed) when mode==='workflow'
- [x] thinkingLabel shows "Mapping your workflow..." for phase 1
- [x] thinkingAccentColor is green rgba(34,197,94,0.85) for workflow THINKING
- [x] workflowBuilderProps bundle passed to ExpandedView

**Self-verify**: Re-read FEATURE_SPEC.md#state-machine-additions and #critical-behaviour. Tick every criterion.
**Test requirement**: Manual — switch to workflow mode while minimized, confirm auto-expand. Switch to another mode, confirm collapse button re-enables.
**⚠️ Boundaries**: Only App.jsx. Follow video builder pattern exactly for auto-expand. Do not change existing mode flows.
**CODEBASE.md update?**: Yes — update App.jsx row: new states, new state vars, workflowBuilderProps bundle.
**Architecture compliance**: All state transitions via transition(). No direct DOM mutation.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-006 · App.jsx — workflow handlers via useWorkflowBuilder hook
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#step-3 + FEATURE_SPEC.md#step-5 + FEATURE_SPEC.md#reiterate-behaviour
- **Dependencies**: WFL-005
- **Touches**: `src/renderer/App.jsx` (+ new hook file if extracted — follow video builder pattern)

**What to do**: Implement workflow-specific handlers, preferably extracted into `src/renderer/hooks/useWorkflowBuilder.js` following the useVideoBuilder/useImageBuilder pattern:

- `runWorkflowAnalysis(transcript)`: calls generate-raw with phase 1 system prompt (analysis JSON) → parses JSON response → sets workflowAnalysis → transitions to WORKFLOW_BUILDER. On error (parse failure, empty nodes, generate-raw failure) → transition to ERROR with message "Workflow mapping failed. Please try again."
- `assembleWorkflowJson()`: calls generate-raw with phase 2 system prompt (JSON assembly) using workflowAnalysis + filledPlaceholders → sets workflowJson → calls saveToHistory → transitions to WORKFLOW_BUILDER_DONE. On error → transition to ERROR with message "JSON assembly failed. Please try again."
- `handleFillPlaceholder(nodeId, paramKey, value)`: updates filledPlaceholders state keyed by `${nodeId}-${paramKey}`.
- `handleAddNode()`: appends blank node `{ id: maxExistingId+1, name: '', type: '', purpose: '', parameters: {}, placeholders: [], credentialType: null }` to workflowAnalysis.nodes.
- `handleWorkflowConfirm()`: validates all placeholders filled → transitions to THINKING (phase 2 label "Assembling JSON...") → calls assembleWorkflowJson().
- `handleWorkflowReiterate()`: sets isReiteratingWorkflow=true → transitions to RECORDING; on next generation, runWorkflowAnalysis runs with new transcript; filledPlaceholders values preserved for matching nodeId+paramKey keys; user-added nodes (id > original count) discarded.
- `handleWorkflowStartOver()`: resets workflowAnalysis, filledPlaceholders, workflowJson, isReiteratingWorkflow → transitions to IDLE.
- `handleWorkflowEdit()`: transitions back to WORKFLOW_BUILDER (workflowAnalysis + filledPlaceholders preserved).
- `handleWorkflowSave()`: toggles isSaved flag (bookmarks the history entry via bookmarkHistoryItem).
- `handleWorkflowCopy()`: copies workflowJson to clipboard via copyToClipboard IPC → flashes isCopied for 1.8s.

**Acceptance criteria**:
- [x] Phase 1 failure → ERROR state with "Workflow mapping failed. Please try again."
- [x] Phase 1 empty nodes array → ERROR state
- [x] Phase 2 failure → ERROR state with "JSON assembly failed. Please try again."
- [x] handleFillPlaceholder updates filledPlaceholders correctly
- [x] handleWorkflowReiterate preserves matching filled placeholders
- [x] handleWorkflowReiterate discards user-added nodes
- [x] handleWorkflowSave toggles isSaved flag
- [x] saveToHistory called in assembleWorkflowJson before WORKFLOW_BUILDER_DONE transition

**Self-verify**: Re-read FEATURE_SPEC.md#step-3, #step-5, #reiterate-behaviour, and error states section. Tick every criterion.
**Test requirement**: Manual — force an invalid Claude response (bad JSON), confirm ERROR state fires with correct message.
**⚠️ Boundaries**: Use existing generate-raw IPC only — no new IPC channels. History saving via utils/history.js saveToHistory only.
**CODEBASE.md update?**: Yes — add useWorkflowBuilder.js row if extracted as hook.
**Architecture compliance**: generate-raw passthrough pattern; abortRef guard for stale async results; transitionRef not currentState for async callbacks.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-007 · App.jsx — STATE_HEIGHTS for WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#state-machine-additions
- **Dependencies**: WFL-005
- **Touches**: `src/renderer/App.jsx`

**What to do**: Add to STATE_HEIGHTS:
```js
WORKFLOW_BUILDER: 860,
WORKFLOW_BUILDER_DONE: 860,
```
Both are always expanded-only (never rendered in collapsed bar). The transition() function skips resizeWindow while isExpanded (guarded by isExpandedRef.current) — no special handling needed.

**Acceptance criteria**:
- [x] STATE_HEIGHTS.WORKFLOW_BUILDER === 860
- [x] STATE_HEIGHTS.WORKFLOW_BUILDER_DONE === 860

**Self-verify**: Read App.jsx STATE_HEIGHTS block. Confirm both entries present.
**Test requirement**: Implicit — covered by WFL-005 smoke test.
**⚠️ Boundaries**: App.jsx only. Do not change any existing STATE_HEIGHTS entries.
**CODEBASE.md update?**: No — STATE_HEIGHTS is internal, covered by state table update in WFL-005.
**Architecture compliance**: Follows video builder precedent (VIDEO_BUILDER: 860, VIDEO_BUILDER_DONE: 860).

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-008 · App.jsx — Reiterate flow with isReiteratingWorkflow flag
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#reiterate-behaviour
- **Dependencies**: WFL-006
- **Touches**: `src/renderer/App.jsx` (or useWorkflowBuilder.js if extracted)

**What to do**: Implement the reiterate re-entry path in handleGenerateResult (or runWorkflowAnalysis):
- When `isReiteratingWorkflow === true`: call runWorkflowAnalysis with new transcript.
- After new workflowAnalysis arrives: merge filledPlaceholders — preserve values where `${node.id}-${paramKey}` key exists in both old and new analysis. Discard user-added nodes (ids beyond original node count). Set isReiteratingWorkflow=false.
- thinkingLabel for reiterate phase 1: "Re-mapping workflow..." (not "Mapping your workflow...").
- filledPlaceholders keys from discarded nodes are also discarded from state.

This is likely already partially implemented in WFL-006 handleWorkflowReiterate — this task confirms the merge logic is correct and tested.

**Acceptance criteria**:
- [x] Reiterate triggers new recording → new transcript
- [x] THINKING shows "Re-mapping workflow..." during reiterate
- [x] After new analysis: placeholder values from matching nodeId+paramKey keys preserved
- [x] Placeholder values from user-added nodes (not in new analysis) discarded
- [x] New placeholder keys from new analysis start unfilled
- [x] isReiteratingWorkflow reset to false after new analysis arrives

**Self-verify**: Re-read FEATURE_SPEC.md#reiterate-behaviour. Trace the reiterate code path end-to-end.
**Test requirement**: Manual — fill 2 placeholders, reiterate with same idea, confirm filled values reappear on matching keys.
**⚠️ Boundaries**: Do not change recording or transcription logic. Only the post-analysis merge logic.
**CODEBASE.md update?**: No — covered by WFL-006 doc entry.
**Architecture compliance**: isReiteratingWorkflow mirrors isReiteratingRef pattern from video builder.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-009 · History saving — workflow entries with mode 'workflow'
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (history entry)
- **Dependencies**: WFL-006
- **Touches**: `src/renderer/App.jsx` (or useWorkflowBuilder.js), `src/renderer/utils/promptUtils.js`

**What to do**:
1. In `assembleWorkflowJson` (WFL-006), call saveToHistory with:
   ```js
   saveToHistory({
     transcript: originalTranscript.current,
     prompt: `${workflowAnalysis.workflowName} — ${workflowAnalysis.nodes.length} nodes`,
     mode: 'workflow',
   })
   ```
   The `prompt` field stores a human-readable summary (name + node count), NOT the raw JSON (too large for localStorage). workflowJson is not persisted in history.

2. In `src/renderer/utils/promptUtils.js`, add 'workflow' case to `getModeTagStyle()`:
   ```js
   case 'workflow':
     return { background: 'rgba(34,197,94,0.1)', color: 'rgba(74,222,128,0.65)' };
   ```
   Add `promptUtils.js` to files touched by this task.

**Acceptance criteria**:
- [x] After WORKFLOW_BUILDER_DONE: new entry appears in ExpandedHistoryList
- [x] Entry shows mode tag with green background rgba(34,197,94,0.1) + color rgba(74,222,128,0.65)
- [x] Entry title shows workflowName from workflowAnalysis
- [x] getModeTagStyle('workflow') returns correct green colours

**Self-verify**: Read promptUtils.js getModeTagStyle. Confirm 'workflow' case present. Check history entry renders correctly in ExpandedHistoryList.
**Test requirement**: Manual — complete a workflow build end-to-end, confirm history entry appears with green mode tag.
**⚠️ Boundaries**: promptUtils.js is now explicitly in scope for this task only (getModeTagStyle update). Do not change any other getModeTagStyle cases.
**CODEBASE.md update?**: Yes — update promptUtils.js row: add workflow case to getModeTagStyle.
**Architecture compliance**: saveToHistory via utils/history.js only. No direct localStorage access.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-010 · ExpandedTransportBar — hide collapse button in workflow mode
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#critical-behaviour
- **Dependencies**: WFL-005
- **Touches**: `src/renderer/components/ExpandedTransportBar.jsx`

**What to do**: The collapse button in ExpandedTransportBar already handles `mode === 'video'` (disabled/hidden). Extend the same logic to also disable for `mode === 'workflow'`:
- Collapse button: `disabled={mode === 'video' || mode === 'workflow'}` and `opacity: (mode === 'video' || mode === 'workflow') ? 0.3 : 1`, `cursor: 'default'`, `pointerEvents: 'none'`
- Add `title="Workflow mode uses full view"` to the collapse button when mode === 'workflow' (HTML title attribute for tooltip — simplest approach consistent with existing codebase; no new tooltip component).
- When mode switches away from workflow, collapse button re-enables (already handled by the conditional above).

**Acceptance criteria**:
- [x] Collapse button is visually dimmed (opacity 0.3) when mode === 'workflow'
- [x] Collapse button is not clickable (pointerEvents: none) when mode === 'workflow'
- [x] Hovering collapse button in workflow mode shows browser tooltip "Workflow mode uses full view"
- [x] Collapse button returns to full opacity and clickable when mode !== 'workflow'
- [x] Video mode collapse behaviour unchanged

**Self-verify**: Read ExpandedTransportBar.jsx collapse button section. Confirm workflow condition added alongside video condition.
**Test requirement**: Manual — switch to workflow mode, confirm collapse button is dimmed and non-clickable.
**⚠️ Boundaries**: Only ExpandedTransportBar.jsx. Do not change any other button behaviour.
**CODEBASE.md update?**: Yes — update ExpandedTransportBar.jsx row: note workflow mode also disables collapse.
**Architecture compliance**: Inline style for dynamic opacity; mode prop already available.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

### WFL-011 · Docs — CODEBASE.md, DECISIONS.md, TASKS.md
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: All
- **Dependencies**: WFL-001 through WFL-010 (runs last)
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `vibe/features/2026-04-27-workflow-builder/FEATURE_TASKS.md`

**What to do**:
1. CODEBASE.md: Add rows for WorkflowBuilderState.jsx, WorkflowBuilderDoneState.jsx, useWorkflowBuilder.js (if created). Update App.jsx row (new states, new state vars). Update useMode.js row (workflow added). Update main.js row (workflow in MODE_CONFIG). Update promptUtils.js row (getModeTagStyle workflow case). Update state table with WORKFLOW_BUILDER and WORKFLOW_BUILDER_DONE rows.
2. DECISIONS.md: Log D-WORKFLOW-BUILDER-002 drift entry summarising any implementation decisions made during build.
3. TASKS.md: Mark all WFL tasks complete, update "What just happened" and "What's next".
4. FEATURE_TASKS.md: Tick all tasks complete, fill Decisions sections.

**Acceptance criteria**:
- [x] CODEBASE.md has rows for both new components
- [x] CODEBASE.md state table includes WORKFLOW_BUILDER and WORKFLOW_BUILDER_DONE
- [x] TASKS.md shows FEATURE-WORKFLOW-BUILDER as complete (11/11 ✅)
- [x] DECISIONS.md has D-WORKFLOW-BUILDER entry for the feature

**Self-verify**: grep CODEBASE.md for WorkflowBuilder. Confirm both components present.
**Test requirement**: N/A — doc-only task.
**⚠️ Boundaries**: Doc files only. Never mix code + doc changes in one commit.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: Doc commit always separate from code commit.

**Decisions**:
> Filled in by agent after completing.
- None yet.
---

#### Conformance: FEATURE-WORKFLOW-BUILDER
> Tick after every task. All items ✅ before feature is shippable.
- [x] Workflow mode appears in right-click menu with green accent
- [x] Idle bar shows green dot + "Describe your automation" in workflow mode
- [x] ⌥ Space auto-expands if minimized when mode === 'workflow'
- [x] THINKING phase 1: green spinner "Mapping your workflow..."
- [x] WORKFLOW_BUILDER shows node cards — trigger green, action blue
- [x] Placeholder chips amber, tappable → inline input → green on fill
- [x] Confirm button always enabled — advisory hint shown if unfilled (D-WFL-NOGATE)
- [x] Reiterate preserves filled placeholder values on matching keys
- [x] User-added nodes discarded on reiterate
- [x] THINKING phase 2: green spinner "Assembling JSON..."
- [x] WORKFLOW_BUILDER_DONE two-column layout renders
- [x] JSON preview syntax-highlighted (blue keys, green strings, orange numbers)
- [x] Copy JSON copies full workflowJson to clipboard
- [x] Collapse button dimmed and non-clickable in workflow mode
- [x] History entry saves with green mode tag + workflowName as title
- [x] Phase 1 Claude failure → ERROR state with clear message
- [x] Phase 2 Claude failure → ERROR state with clear message
- [x] All new component lint passes (0 errors)
- [x] No regressions in other modes (video, image, polish)
- [x] CODEBASE.md updated for all new files
---
