# FEATURE_PLAN.md — Preflight Health Checks & Build Assertions
> Added: 2026-05-19

---

## 1. Impact map

### New files

| File | Purpose |
|------|---------|
| `scripts/preflight.sh` | 10-check environment + codebase assertion script |
| `scripts/assert-splash.js` | 4-check Node script validating splash.html escape hatches |
| `.github/workflows/preflight.yml` | CI workflow — runs both scripts on push/PR to main |

### Modified files

| File | Change |
|------|--------|
| `scripts/release.sh` | Add 3 lines at preamble — run preflight + assert before build steps |
| `package.json` | Add 3 script entries: `preflight`, `assert`, `prerelease` |

### Read-only files (asserted, not changed)

- `main.js` — grep target for CHECKs 7, 10
- `src/renderer/components/ExpandedTransportBar.jsx` — grep target for CHECK 8
- `src/renderer/components/SettingsPanel.jsx` — grep target for CHECK 9
- `splash.html` — text search target for all 4 ASSERTs

---

## 2. Files explicitly out of scope

- All `src/renderer/` components and hooks (except read-only greps)
- `preload.js`
- `main.js` application logic
- `splash.html` content
- `index.html`
- Any test file under `tests/`
- All other `scripts/` files (uninstall.sh, sign-app.sh, etc.)

---

## 3. scripts/preflight.sh — design

```bash
#!/bin/bash
# Preflight checks — run before every release build.
# Exits 1 on first failure with a clear human-readable message.

ok()   { echo "  ✓ $1"; }
fail() { echo ""; echo "  FAIL: $1"; echo ""; exit 1; }

# CHECK 1 — Node in non-login shell
# CHECK 2 — Claude in non-login shell
# CHECK 3 — Claude executes in non-login shell (with 60s timeout)
# CHECK 4 — ffmpeg in non-login shell
# CHECK 5 — whisper in non-login shell
# CHECK 6 — whisper --help exits 0

# CHECK 7 — makeClaudeEnv coverage (python3 one-liner embedded in heredoc)
#   Finds all `spawn(claudePath` lines in main.js.
#   For each, checks that `makeClaudeEnv` appears within a 5-line window.
#   Exits 1 if any call is missing env injection.

# CHECK 8 — Settings gear in ExpandedTransportBar.jsx
#   grep -c "onOpenSettings" src/renderer/components/ExpandedTransportBar.jsx

# CHECK 9 — All 3 path fields in SettingsPanel.jsx
#   grep -c "claudeVal" + "whisperVal" + "ffmpegVal"

# CHECK 10 — ffmpegPath in save-paths / get-stored-paths / recheck-paths
#   For each handler: find handler block via awk, check ffmpegPath appears inside
```

**Implementation notes for CHECK 7:**
```python
# Embedded python3 in heredoc — no external deps
import sys
with open('main.js') as f:
    lines = f.readlines()
bad = []
for i, line in enumerate(lines):
    if 'spawn(claudePath' in line and not line.strip().startswith('//'):
        window = ''.join(lines[max(0,i-2):i+4])
        if 'makeClaudeEnv' not in window:
            bad.append(i+1)
for n in bad:
    print(f"FAIL: spawn call at line {n} in main.js does not use makeClaudeEnv(). This will break on nvm/non-standard installs.")
    sys.exit(1)
```

**Implementation notes for CHECK 10 (IPC handler coverage):**
```bash
# Use awk to extract text between handler channel names and closing brace
# Simpler: just grep for all three in the whole file — false positives acceptable
# since we know the file structure
for handler in "save-paths" "get-stored-paths" "recheck-paths"; do
  if ! awk "/handle\\('$handler'/,/^\\}/" main.js | grep -q "ffmpegPath"; then
    fail "ffmpegPath not wired in $handler IPC handler."
  fi
done
```

---

## 4. scripts/assert-splash.js — design

```js
#!/usr/bin/env node
// Validates splash.html escape hatches.
// Run with: node scripts/assert-splash.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'splash.html'), 'utf8');

function assert(condition, msg) {
  if (!condition) {
    console.error('');
    console.error('  FAIL: ' + msg);
    console.error('');
    process.exit(1);
  }
  console.log('  ✓ ' + msg.split('.')[0]);
}

// ASSERT 1 — s1-notfound has path input
assert(html.includes('id="s1-manual-path"'), '...');
// ASSERT 2 — s1-notresponding has path input
assert(html.includes('id="s1-notresponding-path"'), '...');
// ASSERT 3 — submit buttons exist for each input
assert(html.includes('s1UseManualPath()') && html.includes('s1NotrespondingUseManualPath()'), '...');
// ASSERT 4 — check-again buttons on dependency error states
assert(html.includes('runScreen1()') && html.includes('runScreen2()'), '...');

console.log('\n  All assertions passed.\n');
```

---

## 5. release.sh modification

Add after the existing nvm init block and BEFORE the arg check:

```bash
# ── health checks ─────────────────────────────────────────────────────────────
echo "Running preflight checks..."
bash scripts/preflight.sh || exit 1
echo "Running splash assertions..."
node scripts/assert-splash.js || exit 1
echo "All checks passed. Proceeding with build."
```

---

## 6. Conventions to follow

- Shell scripts: `#!/bin/bash`, `set -e` NOT used (we control exits explicitly), helper fns `ok()`/`fail()`
- Node script: CommonJS (`require`), no external modules, `process.exit(1)` on failure
- Same nvm init pattern as `release.sh` already uses at the top — no need to add it to `preflight.sh` itself (preflight simulates non-login shells intentionally)
- `env -i HOME=$HOME` is the correct way to simulate Electron's non-login shell environment on macOS
- All failure messages match the exact strings in FEATURE_SPEC.md

---

## 7. Task breakdown

| Task ID | What | Size |
|---------|------|------|
| PFLT-001 | `scripts/preflight.sh` — CHECKs 1-6 (env reachability) | M |
| PFLT-002 | `scripts/preflight.sh` — CHECKs 7-10 (codebase assertions) | S |
| PFLT-003 | `scripts/assert-splash.js` — all 4 splash assertions | S |
| PFLT-004 | Wire into `release.sh` + `package.json` scripts | S |
| PFLT-005 | `.github/workflows/preflight.yml` CI workflow | S |
| PFLT-006 | Docs — CODEBASE.md + DECISIONS.md + TASKS.md | S |

---

## 8. Rollback plan

All changes are additive:
- `scripts/preflight.sh` and `scripts/assert-splash.js` can be deleted
- `release.sh` preflight lines can be removed (3 lines)
- `package.json` script entries can be removed (3 lines)
- `.github/workflows/preflight.yml` can be deleted

No application code is changed — rollback has zero impact on the shipped .dmg.

---

## 9. Testing strategy

The scripts are self-testing: a passing run exits 0, a failing run exits 1. Manual verification:
- Run `npm run preflight` on the dev machine — all 10 checks must pass
- Run `npm run assert` — all 4 assertions must pass
- Temporarily remove `id="s1-notresponding-path"` from splash.html, run assert — ASSERT 2 must fail with correct message. Restore.
- No new unit tests needed — these are integration/assertion scripts, not library code.

---

## 10. CODEBASE.md sections to update

After PFLT-006:
- Add `scripts/preflight.sh` and `scripts/assert-splash.js` to the File map table
- Add `.github/workflows/preflight.yml` if it didn't previously exist
- Update the `package.json` row to note the 3 new script entries
