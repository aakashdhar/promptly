# FEATURE_TASKS.md — Preflight Health Checks & Build Assertions
> Folder: vibe/features/2026-05-19-preflight-health-checks/
> Added: 2026-05-19

> **Estimated effort:** 6 tasks — M: 1, S: 5 — approx. 3–4 hours total

---

### PFLT-001 · scripts/preflight.sh — environment reachability checks (CHECKs 1-6)
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: None
- **Touches**: `scripts/preflight.sh` (new)

**What to do**:
Create `scripts/preflight.sh` with:
1. Shebang `#!/bin/bash`, helper functions `ok()` and `fail()`
2. CHECK 1 — `NODE=$(env -i HOME="$HOME" /bin/sh -c 'command -v node' 2>/dev/null)`. If empty, call `fail` with the exact message from FEATURE_SPEC.md (includes the export PATH hint).
3. CHECK 2 — same pattern for `command -v claude`.
4. CHECK 3 — run `env -i HOME="$HOME" /bin/sh -c 'claude -p "respond with READY"'` with a 60-second timeout (`timeout 60`). Capture output. If output does not contain "READY", fail with the exact message from spec.
5. CHECK 4 — `command -v ffmpeg` in non-login shell. Failure message: `FAIL: ffmpeg not found in non-login shell PATH.`
6. CHECK 5 — `command -v whisper` in non-login shell. Failure message: `FAIL: whisper not found in non-login shell PATH.`
7. CHECK 6 — `env -i HOME="$HOME" /bin/sh -c 'whisper --help' 2>/dev/null`. Check exit code is 0. Failure message from spec.
8. Print `"All preflight checks passed."` and exit 0.

After creating, run `chmod +x scripts/preflight.sh`.

**Exact failure messages** (must match spec verbatim):
```
FAIL: node not found in non-login shell PATH.
 Electron child processes will fail with env: node: No such file or directory. Run: export PATH=$(dirname $(which node)):$PATH
```
```
FAIL: claude not found in non-login shell PATH.
```
```
FAIL: claude binary found but not executable in non-login shell.
 Likely a symlinked binary whose node is not in PATH.
```
```
FAIL: ffmpeg not found in non-login shell PATH.
```
```
FAIL: whisper not found in non-login shell PATH.
```
```
FAIL: whisper found but failed to execute. Check Python PATH and SSL certificate environment variables.
```

**Acceptance criteria**:
- [ ] File exists at `scripts/preflight.sh` and is executable
- [ ] `bash scripts/preflight.sh` passes on the current dev machine
- [ ] CHECK 1 message includes the `export PATH=...` hint
- [ ] CHECK 3 uses `timeout 60` to prevent script hanging
- [ ] Passing run prints one ✓ line per check + "All preflight checks passed."

**Self-verify**: Run `bash scripts/preflight.sh` from the repo root. Confirm all 6 checks print ✓. Then test CHECK 1 failure: `env -i HOME=$HOME /bin/sh -c 'command -v node'` — if this returns empty on your machine, CHECK 1 would fail (expected on nvm systems without PATH export).
**Test requirement**: Manual execution — exits 0 on passing machine.
**⚠️ Boundaries**: Do not touch any file outside `scripts/preflight.sh`. Do not add runtime npm dependencies.
**CODEBASE.md update?**: No — deferred to PFLT-006.
**Architecture compliance**: Shell scripts follow the nvm-init pattern from ARCHITECTURE.md. No runtime npm deps added.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PFLT-002 · scripts/preflight.sh — codebase assertion checks (CHECKs 7-10)
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria
- **Dependencies**: PFLT-001 (adds to the same file)
- **Touches**: `scripts/preflight.sh`

**What to do**:
Append CHECKs 7-10 to `scripts/preflight.sh` (before the final "All preflight checks passed." line):

**CHECK 7** — Embed a python3 heredoc that reads `main.js`, finds all `spawn(claudePath` calls, checks that `makeClaudeEnv` appears within a 5-line window (2 lines before + 3 lines after). Print FAIL + line number for any missing call, exit 1. Otherwise `ok "CHECK 7: all spawn(claudePath calls use makeClaudeEnv"`.

```bash
python3 - <<'PYEOF'
import sys
with open('main.js') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'spawn(claudePath' in line and not line.strip().startswith('//'):
        window = ''.join(lines[max(0,i-2):min(len(lines),i+4)])
        if 'makeClaudeEnv' not in window:
            print(f"FAIL: spawn call at line {i+1} in main.js does not use makeClaudeEnv(). This will break on nvm/non-standard installs.")
            sys.exit(1)
PYEOF
[ $? -ne 0 ] && exit 1
ok "CHECK 7: all spawn(claudePath calls use makeClaudeEnv"
```

**CHECK 8** — grep ExpandedTransportBar.jsx for `onOpenSettings`:
```bash
count=$(grep -c "onOpenSettings" src/renderer/components/ExpandedTransportBar.jsx 2>/dev/null || echo 0)
[ "$count" -lt 1 ] && fail "Settings button not found in ExpandedTransportBar.jsx. Users cannot open settings."
ok "CHECK 8: settings button present in ExpandedTransportBar"
```

**CHECK 9** — check SettingsPanel.jsx for all 3 path field state vars:
```bash
settings_file="src/renderer/components/SettingsPanel.jsx"
for field in claudeVal whisperVal ffmpegVal; do
  grep -q "$field" "$settings_file" || fail "$field not configurable in SettingsPanel.jsx. Users cannot override this path after install."
done
ok "CHECK 9: all 3 path fields present in SettingsPanel"
```

**CHECK 10** — verify ffmpegPath in all 3 IPC handler bodies. Use awk to extract each handler block:
```bash
for handler in "save-paths" "get-stored-paths" "recheck-paths"; do
  # Extract lines from the handler channel name to the next handle( call
  block=$(awk "/handle\('${handler}'/,/ipcMain\.handle\(/" main.js | head -30)
  echo "$block" | grep -q "ffmpegPath" || fail "ffmpegPath not wired in ${handler} IPC handler."
done
ok "CHECK 10: ffmpegPath wired in all 3 path IPC handlers"
```

**Acceptance criteria**:
- [ ] CHECK 7 passes (all current spawn(claudePath calls use makeClaudeEnv)
- [ ] CHECK 8 passes (ExpandedTransportBar.jsx has onOpenSettings)
- [ ] CHECK 9 passes (SettingsPanel.jsx has all 3 path field vars)
- [ ] CHECK 10 passes (main.js has ffmpegPath in all 3 handlers)
- [ ] `bash scripts/preflight.sh` exits 0 end-to-end

**Self-verify**: Run `bash scripts/preflight.sh` — all 10 checks print ✓. Then simulate a failure: temporarily comment out a `makeClaudeEnv` reference and re-run — CHECK 7 should fail with the line number. Restore.
**Test requirement**: Manual end-to-end run.
**⚠️ Boundaries**: Only touch `scripts/preflight.sh`. Do not modify `main.js` or any component file.
**CODEBASE.md update?**: No — deferred to PFLT-006.
**Architecture compliance**: python3 is available on all macOS 11+ machines. No npm packages used.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PFLT-003 · scripts/assert-splash.js — splash screen escape-hatch assertions
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (assert-splash.js section)
- **Dependencies**: None
- **Touches**: `scripts/assert-splash.js` (new)

**What to do**:
Create `scripts/assert-splash.js`:

```js
#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const splashPath = path.join(__dirname, '..', 'splash.html');
const html = fs.readFileSync(splashPath, 'utf8');
let passed = 0;

function ok(msg) { console.log('  ✓ ' + msg); passed++; }
function fail(msg) {
  console.error('');
  console.error('  FAIL: ' + msg);
  console.error('');
  process.exit(1);
}

// ASSERT 1 — s1-notfound has manual path input
if (!html.includes('id="s1-manual-path"'))
  fail('s1-notfound state has no manual path input field. Users with non-standard installs have no escape hatch.');
ok('ASSERT 1: s1-notfound has manual path input (#s1-manual-path)');

// ASSERT 2 — s1-notresponding has manual path input
if (!html.includes('id="s1-notresponding-path"'))
  fail('s1-notresponding state has no manual path input field. This was BUG-NVM-PATH — users are completely stuck.');
ok('ASSERT 2: s1-notresponding has manual path input (#s1-notresponding-path)');

// ASSERT 3 — submit buttons exist for both path inputs
if (!html.includes('s1UseManualPath()'))
  fail('Manual path input exists but has no submit button (s1UseManualPath missing).');
if (!html.includes('s1NotrespondingUseManualPath()'))
  fail('Manual path input exists but has no submit button (s1NotrespondingUseManualPath missing).');
ok('ASSERT 3: submit buttons present for both path inputs');

// ASSERT 4 — "Check again" triggers on all dependency error screens
if (!html.includes('runScreen1()'))
  fail('Claude error state has no Check again button (runScreen1 missing as onclick).');
if (!html.includes('runScreen2()'))
  fail('Whisper/ffmpeg error state has no Check again button (runScreen2 missing as onclick).');
ok('ASSERT 4: Check again buttons present on all dependency error screens');

console.log('');
console.log('  All ' + passed + ' splash assertions passed.');
console.log('');
```

**Acceptance criteria**:
- [ ] File exists at `scripts/assert-splash.js`
- [ ] `node scripts/assert-splash.js` exits 0 on current `splash.html`
- [ ] Temporarily removing `id="s1-notresponding-path"` from splash.html causes ASSERT 2 to fail with the exact message
- [ ] Passing run prints 4 ✓ lines + "All 4 splash assertions passed."

**Self-verify**: Run `node scripts/assert-splash.js`. All 4 ✓. Then test failure: grep for `s1-notresponding-path` in splash.html to confirm it's there (`grep -c 's1-notresponding-path' splash.html` → expect ≥1).
**Test requirement**: Manual execution, confirm exit codes.
**⚠️ Boundaries**: Only touch `scripts/assert-splash.js`. Do not modify `splash.html`.
**CODEBASE.md update?**: No — deferred to PFLT-006.
**Architecture compliance**: CommonJS only, no external modules (only `fs`, `path`).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PFLT-004 · Wire into release.sh and package.json
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (release.sh and package.json)
- **Dependencies**: PFLT-001, PFLT-002, PFLT-003 (scripts must exist)
- **Touches**: `scripts/release.sh`, `package.json`

**What to do**:

**release.sh** — after the existing nvm init block and preflight node/npx checks (around line 30), add before the arg check section:

```bash
# ── health checks ─────────────────────────────────────────────────────────────
echo "Running preflight checks..."
bash scripts/preflight.sh || exit 1
echo "Running splash assertions..."
node scripts/assert-splash.js || exit 1
echo "All checks passed. Proceeding with build."
```

Read `scripts/release.sh` first to find the exact insertion point — it should be after `command -v npx` check and before `VERSION="$1"`.

**package.json** — in the `"scripts"` block, add three entries:
```json
"preflight": "bash scripts/preflight.sh",
"assert": "node scripts/assert-splash.js",
"prerelease": "npm run preflight && npm run assert"
```

**Acceptance criteria**:
- [ ] `scripts/release.sh` contains `bash scripts/preflight.sh || exit 1` before any build step
- [ ] `scripts/release.sh` contains `node scripts/assert-splash.js || exit 1` before any build step
- [ ] `npm run preflight` runs the preflight script from the repo root
- [ ] `npm run assert` runs the assert script from the repo root
- [ ] `npm run prerelease` runs both scripts in sequence

**Self-verify**: `npm run preflight` and `npm run assert` — both exit 0. `cat scripts/release.sh | grep "preflight\|assert"` confirms both are present.
**Test requirement**: Manual runs of `npm run preflight` and `npm run assert`.
**⚠️ Boundaries**: Only modify the preamble of `release.sh` (before arg parsing). Do not change build steps, version bump logic, or dmg creation steps.
**CODEBASE.md update?**: No — deferred to PFLT-006.
**Architecture compliance**: No new deps. Follows existing release.sh conventions.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PFLT-005 · .github/workflows/preflight.yml — CI gate
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (CI section)
- **Dependencies**: PFLT-001, PFLT-003 (scripts must exist)
- **Touches**: `.github/workflows/preflight.yml` (new), `.github/` directory (new if missing)

**What to do**:
Create `.github/workflows/preflight.yml`:

```yaml
name: Preflight

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  preflight:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Run preflight checks
        run: bash scripts/preflight.sh
      - name: Run splash assertions
        run: node scripts/assert-splash.js
```

**Note on CHECK 3 in CI**: CHECK 3 (claude CLI test generation) requires a logged-in Claude CLI account. CI runners do not have this. The CI workflow intentionally runs CHECK 1-2 (binary presence) and will skip CHECK 3 in CI by design — OR add a note in the workflow that CHECK 3 is developer-machine-only. Since `bash scripts/preflight.sh` will fail CHECK 2 in CI (no claude installed), the CI workflow may need to be scoped to only run `node scripts/assert-splash.js`. Adjust accordingly: if CI can't run preflight.sh (no claude binary), only run assert-splash.js in CI.

**Pragmatic CI approach**: CI runs only `node scripts/assert-splash.js` (no binary deps) and `bash scripts/preflight.sh` only for CHECKs 7-10 (code-only checks). Alternatively, create a separate `scripts/preflight-ci.sh` that only runs checks 7-10. For simplicity: CI runs only the splash assertion, developer machine runs full preflight.

**Updated CI workflow for practicality**:
```yaml
name: Preflight

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  preflight:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Run splash screen assertions
        run: node scripts/assert-splash.js
      - name: Check makeClaudeEnv coverage (CHECK 7)
        run: python3 - <<'EOF'
          import sys
          with open('main.js') as f:
              lines = f.readlines()
          for i, line in enumerate(lines):
              if 'spawn(claudePath' in line and not line.strip().startswith('//'):
                  window = ''.join(lines[max(0,i-2):min(len(lines),i+4)])
                  if 'makeClaudeEnv' not in window:
                      print(f"FAIL: spawn call at line {i+1} does not use makeClaudeEnv()")
                      sys.exit(1)
          print("OK: all spawn(claudePath calls use makeClaudeEnv")
          EOF
```

**Acceptance criteria**:
- [ ] `.github/workflows/preflight.yml` exists
- [ ] Workflow triggers on push to main and PR to main
- [ ] Workflow runs `node scripts/assert-splash.js`
- [ ] Workflow runs CHECK 7 (makeClaudeEnv coverage) as a standalone step
- [ ] Workflow uses `macos-latest` runner (Electron is macOS-only)

**Self-verify**: `cat .github/workflows/preflight.yml` — confirm triggers and steps are correct. Workflow will actually run on next push to main.
**Test requirement**: File exists and is valid YAML — `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/preflight.yml'))"` if python-yaml available, else manual review.
**⚠️ Boundaries**: Do not touch any other workflow files or GitHub Actions config.
**CODEBASE.md update?**: No — deferred to PFLT-006.
**Architecture compliance**: macos-latest is required (macOS-only app). node 20 matches project's node usage.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### PFLT-006 · Docs — CODEBASE.md + DECISIONS.md + TASKS.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md (conformance checklist)
- **Dependencies**: PFLT-001 through PFLT-005
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:

**CODEBASE.md** — add to the File map table:
```
| `scripts/preflight.sh` | Pre-release environment checks (CHECKs 1-10): non-login shell reachability for node/claude/ffmpeg/whisper, makeClaudeEnv coverage scan, SettingsPanel path field presence, IPC handler ffmpegPath wiring | — |
| `scripts/assert-splash.js` | Structural assertions on splash.html escape hatches: s1-notfound path input, s1-notresponding path input, submit buttons, check-again triggers | — |
| `.github/workflows/preflight.yml` | CI: runs splash assertions + makeClaudeEnv CHECK 7 on push/PR to main | — |
```

Update `package.json` row to note: `"preflight", "assert", "prerelease"` scripts added.

**DECISIONS.md** — append:
```
---
## D-PFLT-001 — Pre-release health check scripts — 2026-05-19
> Feature: FEATURE-PREFLIGHT-HEALTH-CHECKS
> Motivated by: friend's Mac install session — missing binaries and nvm PATH issues went undetected until the user hit them
> Decision: preflight.sh + assert-splash.js run as a required gate in release.sh before any build step
> CHECK 7 implementation: embedded python3 heredoc (no node script needed; python3 always available on macOS; avoids adding a new Node script dependency on python)
> CI: only runs splash assertions + CHECK 7 in CI (CHECK 3 requires logged-in claude CLI — cannot run in CI runners)
---
```

**TASKS.md** — mark PFLT feature as complete and update "What just happened" section.

**Acceptance criteria**:
- [ ] CODEBASE.md lists `scripts/preflight.sh` and `scripts/assert-splash.js` in the file map
- [ ] DECISIONS.md has D-PFLT-001 entry
- [ ] TASKS.md updated with feature complete status

**Self-verify**: `grep -c "preflight.sh" vibe/CODEBASE.md` → ≥ 1.
**Test requirement**: None — doc-only task.
**⚠️ Boundaries**: Only update the three listed doc files.
**CODEBASE.md update?**: Yes — this task IS the CODEBASE.md update.
**Architecture compliance**: DECISIONS.md append-only rule respected.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: Preflight Health Checks & Build Assertions
> Tick after every task. All items ✅ before feature is shippable.
- [ ] `scripts/preflight.sh` exists and is executable
- [ ] All 10 preflight checks implemented and pass on dev machine
- [ ] Each check prints a clear failure reason and exits 1
- [ ] `scripts/assert-splash.js` exists and passes on current `splash.html`
- [ ] All 4 splash assertions implemented
- [ ] `scripts/release.sh` runs both scripts before build steps
- [ ] `package.json` has `preflight`, `assert`, `prerelease` scripts
- [ ] `.github/workflows/preflight.yml` exists with correct triggers
- [ ] Running assert on a splash missing `id="s1-notresponding-path"` fails ASSERT 2 with exact message
- [ ] A clean passing run of both scripts prints "All checks passed" and exits 0
- [ ] No source file in scope was modified beyond what the spec permits
- [ ] CODEBASE.md updated for new scripts
- [ ] DECISIONS.md updated with D-PFLT-001
---
