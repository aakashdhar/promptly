# Bug Fix Review — WorkflowBuilderState: placeholder fill UX + delete node
**Date:** 2026-04-29
**Reviewer:** vibe-review
**Scope:** Bug fixes in `useWorkflowBuilder.js` + `WorkflowBuilderState.jsx` (+ `ExpandedDetailPanel.jsx` fix-in-review)
**Commits reviewed:** `504435a`, `647c451`, `4f98a18`

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` | ✅ 22/22 passing |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Carryover from previous reviews

Relevant prior workflow-builder findings (v3 review, 2026-04-29):
- ✅ All BL-WFL-001 through BL-WFL-009 resolved
- Open: BL-WFL-008 (App.jsx 659 lines — accepted, monitor only)
- Open: P3-VID-001 (ExpandedDetailPanel.jsx 24 props — pre-existing P3)

No prior carryover directly related to these two bugs.

---

## Dependency graph pre-screening

Graph exists. No cross-concept import violations introduced by these changes — both modified files are in the `workflow` concept and use only stable setState closures.

---

## P0 Finding — Found and fixed during review

### P0-001 — `onDeleteNode` not threaded through `ExpandedDetailPanel.jsx`
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx` line 408
- **Impact:** × button renders in `WorkflowBuilderState` but `onDeleteNode` prop arrives as `undefined`. Clicking throws `TypeError: onDeleteNode is not a function` — delete feature completely broken at runtime despite correct hook + component implementation.
- **Root cause:** Bug fix scope (`BUG_PLAN.md`) listed only 2 files and explicitly excluded `ExpandedDetailPanel.jsx`. The prop-threading render path was not identified as in-scope.
- **Fix applied:** `onDeleteNode={workflowBuilderProps.onDeleteNode}` added at `ExpandedDetailPanel.jsx:408` during this review. Commit: `4f98a18`. Lint + tests green.
- **Status:** ✅ FIXED in review

---

## Architecture drift

No drift detected.

- `WebkitAppRegion: 'no-drag'` on all new clickable elements ✓
- No `dangerouslySetInnerHTML` ✓
- No direct `localStorage` outside wrappers ✓
- No new IPC channels ✓
- No new runtime deps ✓
- `handleDeleteNode` uses `useCallback` with correct empty dep array (closes only over stable `setState` functions) ✓
- Inline styles for dynamic/stateful values ✓

---

## Code quality

### useWorkflowBuilder.js — `handleDeleteNode`

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

**Strengths:**
- Guard `prev.nodes.length <= 1` prevents deleting last node — matches UI guard, defence in depth ✓
- `startsWith(`${nodeId}-`)` uses `-` delimiter — verified no collision: `"10-x".startsWith("1-") === false` ✓
- Both `setWorkflowAnalysis` and `setFilledPlaceholders` batched by React 18 auto-batching (synchronous event handler context) ✓
- Cleanup is complete — removes node AND all its filled placeholder keys ✓
- Empty dep array correct — no external closures beyond stable setState refs ✓

**No issues.**

### WorkflowBuilderState.jsx — × delete button

```jsx
{nodes.length > 1 && (
  <button
    onClick={() => onDeleteNode(node.id)}
    style={{ ..., WebkitAppRegion: 'no-drag', ... }}
  >
    ×
  </button>
)}
```

**Strengths:**
- Guard matches hook guard (`nodes.length > 1`) ✓
- `WebkitAppRegion: 'no-drag'` present ✓
- Button positioned outside the `(node.name || node.type)` conditional — renders for blank nodes too (correct, blank nodes should be deletable) ✓
- After delete: `totalPlaceholders` and `filledCount` recompute from fresh `nodes` array — `allFilled` and `unfilled` update correctly ✓
- Connector rendering is index-based, not ID-based — no visual glitch after delete ✓

**Styling note (P3):** × button color `rgba(255,255,255,0.2)` is very subtle — users may not notice it. No hover state. Acceptable for a destructive action that shouldn't be prominent, but worth monitoring.

### WorkflowBuilderState.jsx — Warning text

```
Before: "⚠ Fill {unfilled} placeholder{s} before generating"
After:  "⚠ Click the amber values above to fill {unfilled} placeholder{s}"
```

Actionable and specific. Tells users exactly what to do. "Above" is correct orientation since the action row is below the scrollable cards. ✓

---

## SOLID review

- **SRP:** `handleDeleteNode` has one job — remove a node + its placeholder data. ✓
- **OCP:** Additive change — new prop + new handler, no existing behaviour modified. ✓
- **ISP:** `WorkflowBuilderState` props grew from 9 → 10. Still under ISP threshold. ✓
- **DIP:** No new concrete dependencies introduced. ✓
- **File sizes:** WorkflowBuilderState 471 lines (P1 threshold: 500 — within limit ✓), useWorkflowBuilder 265 lines ✓

---

## Security

No new attack surface. No user input rendered without sanitisation. No IPC changes. No secrets. ✓

---

## Testing

22/22 unit tests pass. No automated test for delete-node behaviour (UI interaction — manual smoke required). Acceptable for this project's testing philosophy.

---

## Strengths

1. Minimal blast radius — 3 files total (including ExpandedDetailPanel fix)
2. Hook cleanup is thorough and collision-safe
3. Warning text change is targeted and effective
4. Guard prevents last-node deletion in both hook and component (defence in depth)
5. Reiterate flow unaffected — `runWorkflowAnalysis(isReiterate=true)` rebuilds `workflowAnalysis` entirely from new Claude response, so deleted nodes don't resurface

---

## Quality score

| Deduction | Reason |
|-----------|--------|
| -1.0 | P0-001: `onDeleteNode` not threaded through ExpandedDetailPanel (fixed during review) |

**Score: 9.0 / 10.0 — Grade A-**

---

## Gate decision

✅ **PASS** — P0 fixed during review. No remaining P0 or P1 issues.

One P3 (× button hover state) logged to backlog.

CODEBASE.md updated with new prop and handler. ✓
