# Wave 2 — Promptly for Windows
Started: 2026-09-28T09:40:50Z · Base: 843235a (feature/windows-version)

## Tasks
| ID | Size | Status | Commit | Notes |
|----|------|--------|--------|-------|
| WIN-010 | S | ✅ complete | 447ba71 | e2e 48/48 in its worktree |
| WIN-011 | S | ✅ complete | ab74ad7 | Mac icon pixels pinned by hash |
| WIN-013 | L | 🟡 partial | d39f5e1 | cargo test 59/59; real apps need Windows |
| WIN-014 | S | 🟡 partial | 5c817aa | written, not run |

Main-session follow-ups: a990deb (Shortcuts strip on Windows; lint ignores .claude/), f727688 (tray icons wired, setup-info/setup-checks split, admin-app paste reason in the pill, Windows destinations).

## Summary
Total 4 · Complete 2 · Partial 2 · Failed 0. After merge: npm test 266/266, lint 0 errors, preflight ok, Mac e2e 48/48, cargo test 59/59, clippy clean for x86_64-pc-windows-msvc.

## Next wave
Wave 3 — WIN-017 (NSIS installer), WIN-019 (Windows-aware e2e; whisper/helper spawns via spawnArgs for .cmd fakes)
