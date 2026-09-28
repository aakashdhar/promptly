# SPEC REVIEW — Promptly for Windows — add-feature
> 2026-09-28 · Scope: vibe/features/2026-09-27-windows-version/{FEATURE_SPEC,FEATURE_PLAN,FEATURE_TASKS}.md vs vibe/SPEC.md, vibe/ARCHITECTURE.md

Documents audited: FEATURE_SPEC.md, FEATURE_PLAN.md, FEATURE_TASKS.md, vibe/SPEC.md, vibe/ARCHITECTURE.md
Documents missing: none (BRIEF.md / AGENT_ARCH.md not applicable)

## P0 — Critical (0)
None — no build-breaking gaps.

## P1 — Warnings (5)

**P1-001 · vibe/SPEC.md line 166 ↔ FEATURE_SPEC.md §1**
Issue: SPEC.md still says "Windows / Linux support — macOS only"; the approved feature reverses it for Windows. The
edit is deferred to WIN-022, so for ~21 tasks any agent reading SPEC.md sees Windows as out of scope.
Fix: change the line now to "Linux support — out of scope (Windows: see vibe/features/2026-09-27-windows-version/)".

**P1-002 · FEATURE_SPEC.md §3 AC 7 ↔ FEATURE_PLAN.md §1 ↔ FEATURE_TASKS.md WIN-013**
Issue: AC 7 requires selected text from Notepad, VS Code, Chrome and Word. The plan keeps a "simulated Ctrl+C with
clipboard restore" fallback; WIN-013 drops it ("no simulated Ctrl+C in phase 1"). Chrome and many Electron apps don't
expose selections through UI Automation, so AC 7 can't pass as written with WIN-013 as written.
Fix: pick one — (a) keep the fallback in WIN-013 (save clipboard, Ctrl+C, read, restore, ≤ 300 ms), or (b) reword AC 7
to "apps that expose the selection through UI Automation (Notepad, Word, VS Code); others proceed without it".

**P1-003 · FEATURE_SPEC.md §3 AC 17**
Issue: "user data is kept unless the user chooses 'Remove my data' in Settings (same as Mac's reset)". There is no
such option in Settings; on the Mac, data is removed by the tray's "Uninstall Promptly…" (main.js handleUninstall).
The AC points at UI that doesn't exist, so it's untestable and would pull in a new Settings feature.
Fix: "The NSIS uninstaller keeps %APPDATA%\Promptly; the tray's Uninstall Promptly… removes the app and its data,
as on the Mac."

**P1-004 · FEATURE_SPEC.md §8 (antivirus/SmartScreen edge case) ↔ FEATURE_TASKS.md**
Issue: "setup checks each binary runs and reports which one was blocked" has no task; no Touches field covers it.
Fix: add it to WIN-008 (setup) — run `whisper-cli.exe --help` and `promptly-helper.exe` status once at setup and name
the blocked one — or add a task WIN-008b.

**P1-005 · FEATURE_SPEC.md §9 (hold-to-talk latency under 150 ms)**
Issue: no measurement method, so the NFR can't be verified.
Fix: the helper stamps `t` (ms) on each `hotkey` event and main logs the gap to recording start; WIN-023 reads it
from main.log for 20 presses (p95 < 150 ms).

## P2 — Notes (6)
- FEATURE_SPEC.md §7 — "or expose via getStoredPaths/getPreferences — decided in the plan"; the plan chose `get-platform`. Delete the alternative.
- FEATURE_TASKS.md WIN-006 — touches 15 files; acceptable as one concern (labels), keep it one task.
- FEATURE_TASKS.md WIN-012 — "helper.js tests pass unchanged against the protocol" doesn't exercise the Rust binary; add a small protocol script run against both helpers.
- FEATURE_SPEC.md §8 — WSL-only Claude "clear setup message": no task words the message; fold into WIN-002/WIN-008.
- FEATURE_SPEC.md §8 — DIP / multi-monitor pill positions: no code task, only the manual pass; fine if WIN-023 finds nothing.
- vibe/SPEC.md generally predates the one-window design (Electron v31, 480 px floating bar); out of this feature's scope, worth a separate refresh.

## O'Reilly six core areas (for this feature, via CLAUDE.md + FEATURE_*)
Commands ✅ · Testing ✅ · Project structure ✅ · Code style ✅ · Git workflow ✅ · Boundaries ✅

## Cross-document consistency
- SPEC.md ↔ FEATURE_SPEC.md: P1-001 (knowingly reversed, not yet recorded in SPEC.md)
- FEATURE_PLAN.md ↔ FEATURE_TASKS.md: P1-002
- ARCHITECTURE.md ↔ feature: consistent — ARCHITECTURE already names win32.js as the planned seam; the new patterns
  (spawnArgs, scheduler, keys IPC) are documented in WIN-022.

## Verdict
⚠️ SPEC HAS WARNINGS — 0 P0, 5 P1, 6 P2.

## Resolution — 2026-09-28 (owner: "fix all")
- P1-001 fixed: SPEC.md now lists only Linux as out of scope, pointing at the Windows feature.
- P1-002 fixed with option (a): WIN-013 keeps the Ctrl+C fallback (save clipboard → copy → restore, ≤ 300 ms,
  never in password fields); AC 7 unchanged.
- P1-003 fixed: AC 17, WIN-009 and the conformance item describe the real uninstall paths (NSIS keeps data; tray
  Uninstall removes it).
- P1-004 fixed: WIN-008 checks whisper-cli.exe and the helper start at setup and names a blocked one.
- P1-005 fixed: the helper stamps `t` on hotkey events; main logs the delay; WIN-023 checks p95 < 150 ms.
- P2 (§7 alternative IPC) fixed; the other five P2 notes stay open, low risk.
Re-check: 0 P0, 0 P1 open → ✅ SPEC READY.
