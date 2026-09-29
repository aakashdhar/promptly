# SPEC REVIEW — Promptly — add-feature (AI provider fallbacks)
Documents audited: vibe/features/2026-09-29-ai-provider-fallbacks/FEATURE_SPEC.md, FEATURE_PLAN.md, FEATURE_TASKS.md; vibe/ARCHITECTURE.md; vibe/SPEC.md; vibe/DECISIONS.md (D-CLI-ONLY, D-DICTATION-CLEANUP); CLAUDE.md
Mode: autonomous — P1s fixed in 1 round, re-checked.

## P0 — none

## P1 — 5 found, all fixed
- P1-001 · ARCHITECTURE.md (LLM line, Never list ×2) + CLAUDE.md rule 1 · forbade API keys outright, contradicting the feature. Fixed: amended to "Claude Code by default; user keys only via the D-AI-PROVIDERS router, encrypted, main process only; no SDKs/proxy/our keys".
- P1-002 · FEATURE_SPEC criterion 2 · "sensible default" model untestable. Fixed: explicit chat-model filter and version/fast-word rules.
- P1-003 · FEATURE_SPEC criterion 4 · "Claude ready" undefined. Fixed: claudePath resolved + last status signed in; refreshed at startup/setup/Settings; false after an auth failure.
- P1-004 · FEATURE_SPEC criterion 3 · "renderer never receives a key" ambiguous for the typed key. Fixed: typed key crosses once via save-ai-key; saved keys never sent back; exact refusal text when safeStorage is unavailable.
- P1-005 · FEATURE_SPEC criterion 8 · error texts incomplete. Fixed: exact errorType + message per status.

## P2 — notes
- vibe/SPEC.md is the April v1 spec (Claude-only, F4) and predates D-CLI-ONLY/D-AI-PROVIDERS — historical; no change.
- AIP-007 touches five renderer files for one concern (provider-aware wording) — acceptable.
- AIP-008 e2e runs only with the owner's go-ahead.

## Cross-document consistency
D-DICTATION-CLEANUP (Sonnet on Claude) holds; on a key the clean-up uses the fast model — stated in spec criterion 5. No other contradictions.

## Verdict
✅ SPEC READY — 0 P0, 0 open P1.
