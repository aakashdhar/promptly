SPEC REVIEW — Promptly · Project modes — add-feature
══════════════════════════════════════════════
Documents audited: vibe/features/2026-10-06-project-modes/FEATURE_SPEC.md, FEATURE_TASKS.md, FEATURE_PLAN.md; vibe/SPEC.md (contradiction check)
Documents missing: none relevant (no BRIEF.md / AGENT_ARCH.md for this repo)

ROUND 1
P0 — Critical (0 found) — none ✅

P1 — Warnings (5 found, all fixed autonomously)
  P1-001 · FEATURE_SPEC §A3 · classify failure states — only invalid JSON was covered; Claude signed out / limit / offline / timeout had no behaviour. Fixed: fallback map + usual error wording; Write the summary disabled until a retry succeeds.
  P1-002 · FEATURE_SPEC §A6 · usage cost of the map-reduce build (~N Claude calls on the user's plan) was invisible. Fixed: button states "about N Claude calls".
  P1-003 · FEATURE_SPEC §17 · default output undefined when only "Something else" (or nothing) is selected. Fixed: → Prompt; explicit precedence order.
  P1-004 · FEATURE_SPEC §26 · several projects matching a dictation had no rule. Fixed: most distinct matches, tie → most recently used.
  P1-005 · FEATURE_TASKS PRJ-004 · FTS5 availability only verified on macOS Electron; Windows CI unverified. Fixed: acceptance criterion for an FTS5 unit test in windows.yml.

P2 — Notes (4)
  · FEATURE_SPEC §28 — Look deeper default On is the recommended default, owner still to confirm (logged in D-PROJECT-MODES).
  · FEATURE_TASKS PRJ-009/PRJ-012 — touch several files but each is one concern (IPC surface; mode keys); left as is.
  · FEATURE_SPEC §20.2 — mapping spoken names to email addresses relies on People + headers; acceptable, revisit in build.
  · New patterns (read-only Claude tools, node:sqlite, fs.watch) — ARCHITECTURE.md updates are scheduled in PRJ-015/PRJ-017.

ROUND 2 (re-review after fixes)
P0: 0 · P1: 0 · P2: 4 (above)

O'REILLY SIX CORE AREAS (CLAUDE.md + ARCHITECTURE.md + feature section)
  Commands ✅ · Testing ✅ · Project structure ✅ · Code style ✅ · Git workflow ✅ (branch, commit formats) · Boundaries ✅ (Always / Ask first / Never)

CROSS-DOCUMENT CONSISTENCY
  ✅ vibe/SPEC.md lists "accounts" as out of scope — the feature adds no login or accounts. D-CLI-ONLY / D-AI-PROVIDERS respected (all AI via main/llm.js; API keys supported except Look deeper). No contradictions.

VERDICT
  ✅ SPEC READY — 0 P0, 0 P1 after 1 fix round. Build waits for the owner's review of the spec and mockups.
