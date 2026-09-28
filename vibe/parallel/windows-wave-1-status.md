# Wave 1 — Promptly for Windows
Started: 2026-09-28T09:22:54Z · Base: 837ce6b (feature/windows-version)
Context mode: baseline (ARCHITECTURE.md + CODEBASE.md); vibe/graph is stale, not used
Isolation: one git worktree per task; main session merges, then runs the Mac e2e suite once

## Tasks
| ID | Size | Status | Commit | Notes |
|----|------|--------|--------|-------|
| WIN-009 | M | ✅ complete | 183cf2d | 253 unit tests; e2e after merge |
| WIN-012 | L | 🟡 partial | da125d1 | cargo test 36/36, Windows target compiles; key presses need Windows |
| WIN-015 | M | 🟡 partial | 02f0ab6 | written, not run (no PowerShell on the Mac) |
| WIN-016 | M | ✅ complete | 128a7d8 | e2e 48/48 with the Node fakes |

## Summary
Total 4 · Complete 2 · Partial 2 · Failed 0. After merge: npm test 253/253, lint 0 errors, preflight ok, Mac e2e 48/48.
Setup note: three of the four worktrees were created from `main`, not the feature branch; WIN-009/012/016 reset to 837ce6b before working, WIN-015 was cherry-picked (new files only).

## Unmet criteria (need Windows)
WIN-012: key-down→hotkey latency <150 ms; real double-tap Ctrl / right Alt / Alt+Space.
WIN-015: commit/checksum refusal and transcription — script not run.

## Warnings passed downstream
WIN-013 (helper `t`, context stub), WIN-014 (crt-static needs cargo run from native/helper-win), WIN-017 (no DLLs to ship), WIN-019 (whisper/helper spawns need spawnArgs for .cmd fakes), WIN-010 (splash Windows copy).

## Next wave
Wave 2 — WIN-010, WIN-011, WIN-013, WIN-014
