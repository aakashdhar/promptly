# Spec Review — add-feature (F-SPEECH)
> Date: 2026-04-18 | Trigger: vibe-add-feature
> Documents: FEATURE_SPEC.md + SPEC.md

---

## Summary
P0: 0 · P1: 1 (fixed) · P2: 1 (fixed)

## P1-001 — onerror `no-speech` branch missing (FIXED)
- **File**: FEATURE_PLAN.md §3 onerror handler + FEATURE_TASKS.md FPH-002
- **Issue**: `no-speech` error was grouped with generic errors → wrong message "Speech recognition error — try again" instead of "No speech detected — try again"
- **Fix applied**: Added `else if (event.error === 'no-speech')` branch to onerror handler in FEATURE_PLAN.md. Added criterion to FEATURE_TASKS.md FPH-002. Split criterion 13 in FEATURE_SPEC.md §3 into 12b (no-speech) and 13 (other).

## P2-001 — Blinking cursor animation ambiguity (FIXED)
- **File**: FEATURE_SPEC.md §4 Deferred
- **Issue**: SPEC.md F3 says "blinking cursor animation" alongside live transcript. Clarification needed that the existing `#recording-dot` pulse satisfies this for v1.
- **Fix applied**: Added note to §4 Deferred: blinking red dot covers this; text cursor deferred to v2.

## Verdict
✅ SPEC READY — 0 P0, all findings fixed. Proceed to build.
