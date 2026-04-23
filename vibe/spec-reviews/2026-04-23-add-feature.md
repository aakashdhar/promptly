# Spec Review — FEATURE-014 Text Input (Type Prompt)
> Date: 2026-04-23 | Trigger: add-feature
> Audited: FEATURE_SPEC.md + FEATURE_PLAN.md + FEATURE_TASKS.md + SPEC.md (cross-check)

## Result: ✅ All findings fixed — spec ready

---

## P0 (0 found)
None.

## P1 (1 found — fixed)

**P1-001 · FEATURE_TASKS.md · TXT-003 placement values**
- Issue: Three inconsistent `right:` values across kit (72px, 108px, 124px). None matched the correct geometry. Mode pill at right:20px + ~112px wide → left edge at ~132px from right. Button (32px) at right:108px would overlap pill by ~24px.
- Fix applied: Changed to `right:'140px'` (8px gap from pill left edge). Added position calculation comment. Removed conflicting right:72px from FEATURE_PLAN.md §5.

## P2 (2 found — fixed)

**P2-001 · `mode` prop on TypingState — unnecessary**
- Issue: `mode` was received by TypingState but unused inside it. handleTypingSubmit reads mode from App.jsx closure.
- Fix applied: Removed `mode` from TypingState function signature in FEATURE_TASKS.md TXT-002. Removed `mode={mode}` from render call in TXT-004. Updated FEATURE_SPEC.md §5. Updated FEATURE_PLAN.md §5.

**P2-002 · `resizeWindow` as prop — architecture deviation**
- Issue: Deviates from useWindowResize() hook pattern used elsewhere.
- Fix applied: Noted deviation explicitly in FEATURE_PLAN.md §6 with rationale. No code change needed — both approaches produce identical IPC calls.

## Cross-document consistency
No contradictions between FEATURE_SPEC.md and SPEC.md.
