# BUG_SPEC — release.sh fails on nvm-managed machines
> Date: 2026-04-28 | ID: BUG-RELEASE-NODE-PATH

## Bug summary
`release.sh` fails with `env: node: No such file or directory` on any machine where Node.js is managed by nvm, because the script runs in a non-login shell where nvm has not sourced its PATH entries.

## Files involved
- `scripts/release.sh` — lines 34 (node -e) and 55 (npx electron-builder)

## Root cause hypothesis
**Confidence: High.**

`release.sh` step 1 (line 34) calls `node -e "..."` directly. Step 4 (line 55) calls `npx electron-builder`. The `npx` binary installed by nvm has shebang `#!/usr/bin/env node`.

On a machine where Node.js is installed via nvm:
- nvm works by injecting its shim directory into `$PATH` via shell config (`.zshrc`/`.bashrc`)
- This PATH injection only happens in **login shells** or **interactive shells** that source the config
- `bash scripts/release.sh` runs in a **non-login, non-interactive subshell** — nvm never initializes
- `/usr/bin/env` looks for `node` in the minimal system PATH — not found
- → `env: node: No such file or directory`

The app's `main.js` already solved this exact problem for runtime binary resolution in `resolveClaudePath()` and `resolveWhisperPath()`, using:
```js
const nvmInit = `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which X`;
exec(`zsh -lc '${nvmInit}'`, ...);
```

`release.sh` has no equivalent. The pattern was never ported to the shell script.

## Blast radius
- Affects ONLY `scripts/release.sh` — the packaged `.app` and `.dmg` are completely clean
- Any developer with nvm-managed Node.js who runs `release.sh` on a new machine hits this at step 1 or step 4
- Does not affect `npm start` or `npm run dist` (those run in the user's shell session where nvm is already loaded)

## Fix approach
Add nvm initialization at the top of `release.sh`, before any `node`/`npm`/`npx` calls:

```bash
# Source nvm if available — required for nvm-managed node installs
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Then add a preflight check that fails fast with a clear message if `node` still isn't found:

```bash
command -v node >/dev/null 2>&1 || fail "node not found — install Node.js or ensure nvm is configured"
command -v npx  >/dev/null 2>&1 || fail "npx not found — install Node.js or ensure nvm is configured"
```

## What NOT to change
- `main.js` — already has correct nvm resolution
- `package.json`, build config, any source files
- Any other script in `scripts/`

## Verification plan
1. Temporarily prepend `export PATH="/usr/bin:/bin"` to `release.sh` to simulate a minimal-PATH shell
2. Run `bash scripts/release.sh 1.5.0` → should fail with the clear preflight error (not "env: node: no such file or directory")
3. Remove the PATH override → run again → should succeed end-to-end

## Regression test
Not unit-testable (shell environment test). Verification is manual:
- Confirm `bash scripts/release.sh 1.5.0` succeeds on a fresh Terminal session where nvm is configured but the current shell was launched without sourcing `.zshrc`
