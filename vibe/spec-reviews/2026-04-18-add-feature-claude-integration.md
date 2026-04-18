# Spec Review — F-CLAUDE (add-feature) — 2026-04-18

## Documents audited
- vibe/features/2026-04-18-claude-integration/FEATURE_SPEC.md
- vibe/features/2026-04-18-claude-integration/FEATURE_PLAN.md
- vibe/features/2026-04-18-claude-integration/FEATURE_TASKS.md
- vibe/SPEC.md (contradiction check)
- vibe/ARCHITECTURE.md (boundary check)

## Result: ✅ 0 P0 · 1 P1 fixed · 1 P2 logged

---

## P1-001 · FCL-001 — Claude CLI invocation flags unverified

**Status**: Fixed

**Issue**: FEATURE_PLAN.md showed `spawn(claudePath, ['-p', systemPrompt])` with transcript via stdin as a concrete implementation. The actual `claude -p` interface was not verified — `-p` most likely takes the user message, not a system prompt, and there may be a separate `--system` flag or no stdin support.

**Fix applied**: Added step 0 to FCL-001 "What to do" requiring agent to run `claude --help` and verify the exact flags before writing spawn code. Added ⚠️ note to FEATURE_PLAN.md §2. Provided three common alternative invocation patterns as fallbacks.

---

## P2-001 · THINKING spinner text mismatch

**Status**: Logged (out of scope for F-CLAUDE)

**Issue**: THINKING spinner text reads "Generating prompt…" but after FCL-002 ships it covers both the Whisper transcription phase AND the Claude generation phase. Pre-existing from F-STATE. Changing user-facing copy requires "ask first" per ARCHITECTURE.md.

**Action**: Log for Phase 3 polish audit.

---

## Cross-document consistency: ✅ clean

- All 5 system prompts deferred to SPEC.md F4 exact strings ✅
- 30-second timeout message matches SPEC.md exactly ✅
- Mode order matches SPEC.md ✅
- claudePath-null error message matches SPEC.md exactly ✅
- No new IPC channels ✅
- No runtime npm deps ✅
- generatedPrompt → F-ACTIONS dependency chain intact ✅
