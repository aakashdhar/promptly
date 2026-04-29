# BUG_SPEC — WorkflowBuilderState: placeholder fill UX + missing delete node

## Bug summary
Two bugs in WorkflowBuilderState: (1) the warning "Fill X placeholders before generating" gives no guidance on HOW to fill them (users don't discover the click-to-edit amber chips); (2) there is an "Add another node" button but no way to delete a node once added.

## Files involved
- `src/renderer/components/WorkflowBuilderState.jsx` — renders node cards, amber chips, action row, add-node button
- `src/renderer/hooks/useWorkflowBuilder.js` — owns `handleAddNode`, `workflowBuilderProps`; missing `handleDeleteNode`

## Root cause hypothesis

**Bug 1 — Placeholder fill discoverability**
The action row warning reads "⚠ Fill X placeholders before generating" but provides no affordance pointing users to the amber chips scattered throughout node card parameter rows. The amber chips have a ✎ pencil icon and `cursor: pointer`, but these are subtle. Users see the warning, scan for a form or dedicated fill UI, find none, and conclude there is no way to fill. The fill mechanism (click amber chip → inline text input with autoFocus) is correct and functional — it is purely a discoverability failure.

**Bug 2 — Missing delete node**
`handleAddNode` in the hook appends a blank node. No `handleDeleteNode` exists anywhere. WorkflowBuilderState renders no × or remove button on any node card.

## Confidence level
**Bug 1**: High — code inspection confirms the amber chip mechanism works; no data-integrity edge case can cause the warning unless `node.placeholders` is non-empty, in which case chips DO render. The only failure is discoverability.  
**Bug 2**: Certain — no delete handler exists in hook or component.

## Blast radius
- WorkflowBuilderState.jsx and useWorkflowBuilder.js only
- No other components or hooks reference these
- No IPC change needed

## Fix approach

**Bug 1**: Update the action-row warning to read "↑ Click the amber values in the cards to fill them in" (or similar). Optionally add a subtle `animation: pulse 2s infinite` border to unfilled chips to draw the eye.

**Bug 2**: 
1. Add `handleDeleteNode(nodeId)` to useWorkflowBuilder.js — filters that node out of `workflowAnalysis.nodes`, also removes its filled placeholder entries.
2. Expose `onDeleteNode` in `workflowBuilderProps`.
3. Add a × button (top-right of each card, only on non-trigger nodes or all nodes with a guard that at least 1 remains) in WorkflowBuilderState.jsx.

## What NOT to change
- The amber chip click → inline input mechanism — it works correctly
- `handleAddNode` logic
- Reiterate merge logic
- WorkflowBuilderDoneState, App.jsx, ExpandedDetailPanel

## Verification plan
1. Run workflow mode, get a result with placeholders — confirm warning now reads "Click the amber values…"
2. Click an amber chip — inline input appears, type, press Enter — chip turns green, confirm button enables
3. Add a node — delete button (×) appears — click × — node removed, cards re-number correctly
4. Verify trigger node (node 1) can also be deleted if >1 node exists, and button is hidden/disabled when only 1 node remains

## Regression test
Manual smoke: workflow mode end-to-end — existing fill/confirm/add flows must continue to work after fix.
