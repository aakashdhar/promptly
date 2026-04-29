# BUG_TASKS — WorkflowBuilderState: placeholder fill UX + missing delete node

---

### BUG-001 · Write the regression test
- **Status**: `[ ]` | **Depends on**: None | **Touches**: manual smoke (no automated test file — UI-only)

**What to do**: Confirm the two bugs reproduce before fixing:
1. Run workflow mode, get a result with placeholders — note the warning shows but user cannot tell HOW to fill
2. Attempt to "delete" a node (confirm no × or remove button exists anywhere)

**Acceptance criteria**:
- [ ] Bug 1 confirmed: warning shows "Fill X placeholders" with no click instruction
- [ ] Bug 2 confirmed: Add button exists, no delete button exists

**⚠️ Boundaries**: Do not touch any source files in this task.
**Decisions**: > Filled in by agent. None yet.

---

### BUG-002 · Implement the fix
- **Status**: `[ ]` | **Depends on**: BUG-001 | **Touches**: `src/renderer/components/WorkflowBuilderState.jsx`, `src/renderer/hooks/useWorkflowBuilder.js`
- **CODEBASE.md update**: Yes — WorkflowBuilderState props, useWorkflowBuilder exports (do in BUG-004)

**What to do**:

**useWorkflowBuilder.js** — after `handleAddNode` (~line 192):
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
Add `onDeleteNode: handleDeleteNode` to `workflowBuilderProps`.

**WorkflowBuilderState.jsx**:
1. Add `onDeleteNode` to props destructuring (line 12)
2. Update action-row warning text to: `"⚠ Click the amber values above to fill {unfilled} placeholder{...}"`
3. Add × delete button inside `cardHeaderStyle` div, shown only when `nodes.length > 1`

**Acceptance criteria**:
- [ ] `handleDeleteNode` added to hook and exposed in `workflowBuilderProps`
- [ ] `onDeleteNode` prop accepted in WorkflowBuilderState
- [ ] Warning text updated to explain HOW to fill
- [ ] × button renders per card when >1 node exists
- [ ] × button hidden when only 1 node remains
- [ ] Clicking × removes node + its filled placeholder entries
- [ ] Lint passes: `npm run lint 2>&1 | tail -10`

**⚠️ Boundaries**: Only modify the 2 files in BUG_PLAN.md — no other files.
**Decisions**: > Filled in by agent. None yet.

---

### BUG-003 · Verify fix and run full suite
- **Status**: `[ ]` | **Depends on**: BUG-002 | **Touches**: none

**What to do**:
1. Run `npm run lint` — must be 0 errors
2. Manually verify bug 1 fix: warning now reads "Click the amber values above to fill..."
3. Manually verify amber chip click → input opens → fill → green chip → confirm enables
4. Manually verify bug 2: add node → × appears → click × → node removed; 1 node remaining → no × button

**Acceptance criteria**:
- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] Bug 1 fixed: warning text is actionable
- [ ] Bug 2 fixed: delete works, guard prevents deleting last node
- [ ] Existing fill/confirm/reiterate/start-over flows unaffected

**Decisions**: > Filled in by agent. None yet.

---

### BUG-004 · Update docs
- **Status**: `[ ]` | **Depends on**: BUG-003
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. CODEBASE.md — WorkflowBuilderState props: add `onDeleteNode`; useWorkflowBuilder description: mention `handleDeleteNode`
2. DECISIONS.md — append D-BUG-WFL-PLACEHOLDER-DELETE entry
3. TASKS.md — mark bug section done, update What just happened + What's next

**Acceptance criteria**:
- [ ] CODEBASE.md reflects new prop and handler
- [ ] DECISIONS.md entry added
- [ ] TASKS.md bug block marked complete

**Decisions**: > Filled in by agent. None yet.

---

#### Bug Fix Sign-off: WorkflowBuilderState placeholder fill UX + delete node
- [ ] Bug 1 warning text updated to guide users on HOW to fill placeholders
- [ ] Bug 2 delete node: handler in hook + button in component + guard ≥1 node
- [ ] Linter clean
- [ ] No files outside BUG_PLAN.md scope modified (except docs in BUG-004)
- [ ] CODEBASE.md updated (WorkflowBuilderState props, useWorkflowBuilder description)
- [ ] ARCHITECTURE.md not updated (no new patterns)
- [ ] DECISIONS.md entry added
- [ ] Doc commits separate from code commits
