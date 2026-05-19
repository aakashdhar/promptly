# Spec Review — Preflight Health Checks — add-feature
> Date: 2026-05-19 | Trigger: add-feature | Verdict: ⚠️ fixed — 0 P0, 2 P1 resolved, 2 P2 resolved

## Documents audited
- vibe/features/2026-05-19-preflight-health-checks/FEATURE_SPEC.md

## Findings

### P0 (0 found)
None.

### P1 (2 found — both fixed)

**P1-001 — CHECK 7 scope narrower than original requirement**
- Issue: FEATURE_SPEC specified `spawn(claudePath` only; original user spec said "all spawn/exec/execFile/execSync calls"
- Fix applied: Extended CHECK 7 to also scan `exec(whisperCmd` + `whisperEnv` verification. Added explicit note that PATH resolution exec calls are intentionally excluded.

**P1-002 — CI acceptance criteria contradicted FEATURE_PLAN.md**
- Issue: CI section said "runs bash scripts/preflight.sh" but CHECKs 2+3 require logged-in claude CLI not available in CI runners
- Fix applied: CI acceptance criteria now states workflow runs only `node scripts/assert-splash.js` + CHECK 7 inline python3 step. Explicit note: full preflight.sh is developer-machine-only.

### P2 (2 found — both fixed)

- release.sh insertion point: corrected "before nvm init block" → "after nvm init block" (node must be in PATH to run assert)
- ASSERT 4 failure message: replaced `[dependency]` placeholder with specific messages: "Claude CLI error state" and "Whisper/ffmpeg error state"

## Verdict
✅ All findings resolved — spec ready for build.
