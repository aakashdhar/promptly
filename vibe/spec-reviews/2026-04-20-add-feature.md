# Spec Review — 2026-04-20 — add-feature (FEATURE-012 Iteration Mode)

## Summary
- P0: 0
- P1: 2 (both fixed)
- P2: 2 (acknowledged, not blocking)
- Verdict: ✅ SPEC READY after fixes applied

## P1-001 — originalTranscript mutation deviation — FIXED
- Added architecture deviation note to FEATURE_SPEC.md section 5
- Added exception comment to ARCHITECTURE.md Never list entry
- DECISIONS.md D-ITER-003 already documented the reasoning

## P1-002 — Untestable multi-iteration criterion — FIXED
- Replaced "Multiple sequential iterations work correctly" with specific 3-iteration smoke test criterion

## P2 — Acknowledged, not fixed
- "preserves original structure" criterion — acceptable for manual smoke test philosophy
- ITR-005 touches 2 files — small enough to keep combined
