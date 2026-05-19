# FEATURE_SPEC.md — Preflight Health Checks & Build Assertions
> Added: 2026-05-19 | Unplanned addition (not in original PLAN.md)
> Motivated by: friend's Mac install session that revealed missing binaries, missing env injection, and missing splash escape hatches going undetected until a user hit them.

---

## 1. Feature overview

Adds a pre-release safety net consisting of two scripts and CI wiring:

1. **`scripts/preflight.sh`** — 10 environment checks that simulate the conditions Electron uses when spawning child processes. Catches missing binaries, misconfigured PATH, and codebase-level env injection gaps before the build starts.
2. **`scripts/assert-splash.js`** — 4 structural assertions on `splash.html` that verify every error state has a manual path escape hatch. Catches regressions where a new splash redesign inadvertently removes a user's only recovery path.

Both scripts are wired into `release.sh` (blocks the build on failure) and `package.json` (runnable independently during development).

---

## 2. User stories

**As a developer building a Promptly release:**
- I want `npm run preflight` to tell me immediately if my machine's environment will cause install failures on user Macs, so I don't ship a broken .dmg.
- I want `npm run assert` to verify the splash screen still has all escape hatches, so a splash UI redesign can't silently remove a user's recovery path.
- I want both checks to run automatically before any build step in `release.sh`, so there is no way to accidentally skip them.

**As a developer making changes to `main.js`:**
- I want CHECK 7 to flag any new `spawn()` / `exec()` / `execFile()` call that doesn't pass `makeClaudeEnv()` or an equivalent env object, so the nvm PATH bug cannot be reintroduced.

---

## 3. Acceptance criteria

### scripts/preflight.sh

- [ ] Script exists at `scripts/preflight.sh` and is executable (`chmod +x`)
- [ ] **CHECK 1** — `env -i HOME=$HOME /bin/sh -c 'command -v node'` must return a path. Failure message: `FAIL: node not found in non-login shell PATH. Electron child processes will fail with env: node: No such file or directory. Run: export PATH=$(dirname $(which node)):$PATH`. Exit 1.
- [ ] **CHECK 2** — `env -i HOME=$HOME /bin/sh -c 'command -v claude'` must return a path. Failure: `FAIL: claude not found in non-login shell PATH.` Exit 1.
- [ ] **CHECK 3** — `env -i HOME=$HOME /bin/sh -c 'claude -p "respond with READY"'` response must contain "READY". Failure: `FAIL: claude binary found but not executable in non-login shell. Likely a symlinked binary whose node is not in PATH.` Exit 1.
- [ ] **CHECK 4** — `env -i HOME=$HOME /bin/sh -c 'command -v ffmpeg'` must return a path. Failure: `FAIL: ffmpeg not found in non-login shell PATH.` Exit 1.
- [ ] **CHECK 5** — `env -i HOME=$HOME /bin/sh -c 'command -v whisper'` must return a path. Failure: `FAIL: whisper not found in non-login shell PATH.` Exit 1.
- [ ] **CHECK 6** — `env -i HOME=$HOME /bin/sh -c 'whisper --help'` must exit 0. Failure: `FAIL: whisper found but failed to execute. Check Python PATH and SSL certificate environment variables.` Exit 1.
- [ ] **CHECK 7** — Scan `main.js` for all `spawn(claudePath` calls (runtime binary invocations — PATH resolution exec calls intentionally excluded as they don't invoke binaries); each must have `makeClaudeEnv` in the surrounding 5 lines. Any missing call prints: `FAIL: spawn call at line N in main.js does not use makeClaudeEnv(). This will break on nvm/non-standard installs.` Exit 1. Also scan for `exec(whisperCmd` calls — each must have `whisperEnv` in the surrounding 5 lines (whisperEnv is the equivalent env object for whisper invocations).
- [ ] **CHECK 8** — `grep -c "onOpenSettings" src/renderer/components/ExpandedTransportBar.jsx` must be ≥ 1. Failure: `FAIL: Settings button not found in ExpandedTransportBar.jsx. Users cannot open settings.` Exit 1.
- [ ] **CHECK 9** — `SettingsPanel.jsx` must contain fields referencing `claudeVal`, `whisperVal`, and `ffmpegVal` (the state variables for each path input). Failure per missing field: `FAIL: [field] not configurable in SettingsPanel.jsx. Users cannot override this path after install.` Exit 1.
- [ ] **CHECK 10** — `main.js` must contain `ffmpegPath` in the `save-paths`, `get-stored-paths`, and `recheck-paths` IPC handler bodies. Failure per missing reference: `FAIL: ffmpegPath not wired in [handler] IPC handler.` Exit 1.
- [ ] A clean passing run prints all CHECK lines with ✓ and exits 0.

### scripts/assert-splash.js

- [ ] Script exists at `scripts/assert-splash.js` and runs with `node scripts/assert-splash.js`
- [ ] **ASSERT 1** — `splash.html` must contain `id="s1-manual-path"`. Failure: `FAIL: s1-notfound state has no manual path input field. Users with non-standard installs have no escape hatch.` Exit 1.
- [ ] **ASSERT 2** — `splash.html` must contain `id="s1-notresponding-path"`. Failure: `FAIL: s1-notresponding state has no manual path input field. This was BUG-NVM-PATH — users are completely stuck.` Exit 1.
- [ ] **ASSERT 3** — `splash.html` must contain `s1UseManualPath()` and `s1NotrespondingUseManualPath()` function calls (submit buttons). Failure: `FAIL: Manual path input exists but has no submit button.` Exit 1.
- [ ] **ASSERT 4** — `splash.html` must contain `runScreen1()` and `runScreen2()` as onclick values (Check again triggers). Missing `runScreen1()`: `FAIL: Claude CLI error state has no Check again button.` Missing `runScreen2()`: `FAIL: Whisper/ffmpeg error state has no Check again button.` Exit 1.
- [ ] A clean passing run prints all ASSERT lines with ✓ and exits 0.

### release.sh and package.json

- [ ] `release.sh` runs `bash scripts/preflight.sh || exit 1` before any build step
- [ ] `release.sh` runs `node scripts/assert-splash.js || exit 1` before any build step
- [ ] `package.json` has `"preflight": "bash scripts/preflight.sh"` script
- [ ] `package.json` has `"assert": "node scripts/assert-splash.js"` script
- [ ] `package.json` has `"prerelease": "npm run preflight && npm run assert"` script

### CI (optional)

- [ ] `.github/workflows/preflight.yml` exists and triggers on push to main and PR to main
- [ ] Workflow runs `node scripts/assert-splash.js` (no claude CLI available in CI runners)
- [ ] Workflow runs CHECK 7 as a standalone inline python3 step (not full preflight.sh — CHECKs 2+3 require a logged-in claude CLI account not available in CI)
- [ ] Workflow does NOT run `bash scripts/preflight.sh` in CI — full preflight is developer-machine-only

---

## 4. Scope boundaries

**In scope:**
- `scripts/preflight.sh` — new shell script
- `scripts/assert-splash.js` — new Node script
- `scripts/release.sh` — add preflight calls at top only (no other changes)
- `package.json` — add 3 script entries only
- `.github/workflows/preflight.yml` — new CI workflow

**Explicitly out of scope:**
- No changes to `main.js` application logic
- No changes to `splash.html` content (asserted, not changed)
- No changes to any React component
- No new npm dependencies (Node's built-in `fs` is sufficient)
- No changes to existing scripts other than `release.sh` preamble

---

## 5. Integration points

**`main.js` (read-only):**
- CHECK 7 greps for `spawn(claudePath` patterns — these all use `makeClaudeEnv()` today
- CHECK 10 greps for `ffmpegPath` in three IPC handler bodies: `save-paths`, `get-stored-paths`, `recheck-paths`

**`src/renderer/components/ExpandedTransportBar.jsx` (read-only):**
- CHECK 8 greps for `onOpenSettings`

**`src/renderer/components/SettingsPanel.jsx` (read-only):**
- CHECK 9 greps for `claudeVal`, `whisperVal`, `ffmpegVal`

**`splash.html` (read-only):**
- All 4 ASSERT checks search this file for required IDs and function references

**`scripts/release.sh` (modified — preamble only):**
- Three lines added after the nvm init block (node must be in PATH to run the assert script): preflight + assert invocation + "All checks passed" message

---

## 6. Edge cases and error states

- **CHECK 3 timeout:** Claude CLI may take up to 30 seconds to respond. The preflight check should timeout after 60 seconds and report failure so the script doesn't hang indefinitely.
- **CHECK 6 whisper --help exit codes:** Some Python-managed whisper installs exit non-zero from `--help`. The check should treat exit code 0 as the only pass condition.
- **env -i stripping HOME:** `env -i` strips all env vars including HOME. We pass HOME explicitly to allow `~` expansion in nvm paths. Without HOME, the `~/.nvm` paths fail.
- **CHECK 7 multi-line spawn calls:** spawn options are typically on the same or adjacent line. The python3 check uses a 5-line window (2 before, 3 after) to accommodate multi-line calls.

---

## 7. Non-functional requirements

- All checks must complete within 120 seconds total (Claude CLI test response is the bottleneck).
- Failed checks print the failure reason to stdout before exiting — never silent.
- Passing run is terse: one ✓ line per check, then "All checks passed."
- The scripts have no runtime npm dependencies — use only shell built-ins and Node.js stdlib (`fs`, `path`).

---

## 8. Conformance checklist

- [ ] `scripts/preflight.sh` exists, is executable, all 10 checks pass on a clean machine
- [ ] `scripts/assert-splash.js` exists, all 4 assertions pass on current `splash.html`
- [ ] `release.sh` preamble updated — build cannot proceed if either script fails
- [ ] `package.json` has all 3 new script entries
- [ ] `.github/workflows/preflight.yml` created (CI gate)
- [ ] No source file in scope was modified beyond what the spec lists
- [ ] Running with a broken splash (missing s1-notresponding-path) fails ASSERT 2 with the exact message
- [ ] Running on a machine without node in non-login PATH fails CHECK 1 with the exact message
