# BUG_PLAN — WorkflowBuilderState: placeholder fill UX + missing delete node

## Exact files to modify
1. `src/renderer/components/WorkflowBuilderState.jsx`
2. `src/renderer/hooks/useWorkflowBuilder.js`

## Files NOT to touch
All other files — ExpandedDetailPanel, App.jsx, ExpandedView, WorkflowBuilderDoneState, preload.js, main.js, CODEBASE.md (updated in BUG-004).

## Change descriptions

### useWorkflowBuilder.js
Add `handleDeleteNode` callback (line ~180, after `handleAddNode`):
```js
const handleDeleteNode = useCallback((nodeId) => {
  setWorkflowAnalysis(prev => {
    if (!prev || prev.nodes.length <= 1) return prev
    return { ...prev, nodes: prev.nodes.filter(n => n.id !== nodeId) }
  })
  setFilledPlaceholders(prev => {
    const next = { ...prev }
    Object.keys(next).forEach(k => { if (k.startsWith(`${nodeId}-`)) delete next[k] })
    return next
  })
}, [])
```
Expose it in `workflowBuilderProps` as `onDeleteNode: handleDeleteNode`.

### WorkflowBuilderState.jsx

**Bug 1 — Warning text** (action row, ~line 415):
Change:
```jsx
⚠ Fill {unfilled} placeholder{unfilled !== 1 ? 's' : ''} before generating
```
To:
```jsx
⚠ Click the amber values above to fill {unfilled} placeholder{unfilled !== 1 ? 's' : ''}
```

**Bug 2 — Delete button** (card header, ~line 290):
Accept `onDeleteNode` prop. Inside each node card header (`cardHeaderStyle` div), add a × button after the Trigger/Action badge. Only show it when `nodes.length > 1` (prevent deleting last node):
```jsx
{nodes.length > 1 && (
  <button
    onClick={() => onDeleteNode(node.id)}
    style={{
      fontSize: 13, lineHeight: 1,
      color: 'rgba(255,255,255,0.2)',
      background: 'none', border: 'none',
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
      padding: '0 2px',
      flexShrink: 0,
    }}
  >
    ×
  </button>
)}
```

## Conventions to follow
- `WebkitAppRegion: 'no-drag'` on all clickable elements (per ARCHITECTURE.md)
- No new state, no new IPC, inline styles only for dynamic values
- Functional React, hooks-only mutation

## Side effects check
- Deleting a node that has filled placeholders: handled — `handleDeleteNode` removes those keys from `filledPlaceholders`
- Deleting all nodes: guarded — `prev.nodes.length <= 1` early return
- Reiterate after delete: safe — reiterate replaces `workflowAnalysis` entirely from new Claude response

## Test plan
1. Manual smoke — workflow mode end-to-end (all states)
2. Bug 1 verify: warning text updated; click amber chip → input opens → fill → green chip appears → confirm enables
3. Bug 2 verify: add node → × appears → click × → node gone; only 1 node → no × button

## Rollback plan
`git revert HEAD` after the code commit. Changes are additive (new button + text tweak) so no data loss risk.

## CODEBASE.md update needed?
Yes — WorkflowBuilderState props list gains `onDeleteNode`; useWorkflowBuilder exports gains `handleDeleteNode`. Update in BUG-004.

## ARCHITECTURE.md update needed?
No — no new patterns introduced.
