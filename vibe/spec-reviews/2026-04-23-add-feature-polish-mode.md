# Spec Review — FEATURE-015 Polish Mode
> Trigger: add-feature | Date: 2026-04-23
> Documents: vibe/features/2026-04-23-polish-mode/FEATURE_SPEC.md + vibe/SPEC.md

---

## P0 — Critical (0 found)
None — no critical gaps found ✅

## P1 — Warnings (2 found — both fixed inline)

**P1-001 · FEATURE_TASKS.md POL-004 — stale closure on polishTone**
Issue: `polishTone` captured by `useCallback([mode])` closures. If not mirrored via ref, tone silently defaults to 'formal' regardless of user selection.
Fix applied: POL-004 now mandates `polishToneRef = useRef(polishTone)` + sync effect + ref used in generate calls.

**P1-002 · FEATURE_SPEC.md + FEATURE_TASKS.md — Edit button no-op UX defect**
Issue: Edit button rendered in PolishReadyState with explicit no-op handler — a non-functional button worse than no button.
Fix applied: Edit button removed from PolishReadyState spec and tasks. Component renders Copy only.

## P2 — Notes (3)
- vibe/SPEC.md F4 references "5 modes" — pre-existing stale doc, not a blocker
- `handlePolishToneChange` empty deps array acceptable (all deps are refs or stable setters)
- `onReuse` should use `setWindowSize` not `resizeWindowWidth` — task updated to clarify

## Verdict
✅ P1s fixed inline — spec ready for build. 0 P0, 0 P1 remaining.
