# BUG_SPEC.md — BUG-012: PATH resolution fails in packaged DMG

## 1. Bug summary
Both `claude` and `whisper` binaries are not found when Promptly is launched from a packaged `.dmg` because the app's environment lacks the user's shell `PATH`, and whisper resolution has a race condition that causes it to always return null on splash check.

## 2. Files involved
- `main.js` — contains `resolveClaudePath()`, inline whisper exec, `transcribe-audio` IPC handler

## 3. Root cause hypothesis

**Cause A — resolveClaudePath() — no fallback:**
`resolveClaudePath()` only calls `exec('zsh -lc "which claude"')`. In a packaged `.app` (launched from DMG, double-clicked from Applications), the environment does not load the user's interactive shell profile. `zsh -lc` does load `.zshrc`/`.zprofile` but macOS Gatekeeper / app sandbox context can suppress this. More critically, if the shell lookup fails, there is no fallback to check common installation directories directly.

**Cause B — whisperPath — race condition + no common paths:**
Whisper is resolved with a fire-and-forget `exec()` callback — NOT awaited. `createWindow()` and `splashWin` are created immediately after, and the splash `splash-check-whisper` IPC handler returns `whisperPath` which may still be `null` when the splash renders and calls the check. This is a guaranteed race on fast machines. Additionally, no common path fallback exists.

**Cause C — python3 -m whisper — not handled:**
If whisper is installed via `pip` (not on PATH as a binary), it can only be invoked as `python3 -m whisper`. The current `exec()` call in `transcribe-audio` shell-quotes `whisperPath` which breaks for this multi-word invocation.

**Confidence:** High — root causes are structural and deterministic.

## 4. Blast radius
- `resolveClaudePath()` — fix is additive (new common-path checks before shell exec)
- `whisperPath` resolution — needs to become `async`/`await` — affects `app.whenReady()` startup sequence
- `transcribe-audio` IPC — needs `python3 -m whisper` exec string construction
- `splash-check-cli` + `splash-check-whisper` — already use cached paths (no change needed)

## 5. Fix approach
1. Replace `resolveClaudePath()` — add `commonPaths` array, check with `fs.existsSync`, then zsh → bash fallback
2. Add `resolveWhisperPath()` — same pattern, whisper-specific paths
3. `await resolveWhisperPath()` in `app.whenReady()` before creating windows (eliminates race)
4. In `transcribe-audio` — construct exec command from `whisperPath`, handling `'python3 -m whisper'` case

## 6. What NOT to change
- `splash-check-cli` / `splash-check-whisper` IPC handlers — already correct (use cached paths)
- All other IPC handlers — no change
- Window creation logic — no change
- `PROMPT_TEMPLATE`, `MODE_CONFIG` — no change

## 7. Verification plan
- `npm run dist:unsigned` — build succeeds
- Open DMG, install, right-click → Open
- Splash: Claude CLI check shows green ✅
- Splash: Whisper check shows green ✅
- Recording + transcription works in packaged app
- Prompt generation works in packaged app

## 8. Regression test
Manual smoke checklist (no automated test framework). The SMOKE CHECKLIST in the bug report serves as the regression test. Must pass fully on packaged DMG build.
