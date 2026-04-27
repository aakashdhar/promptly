# BUG_PLAN — release.sh nvm PATH fix
> Date: 2026-04-28

## Exact files to modify
- `scripts/release.sh` — insert 5 lines after shebang + arg check section

## Exact files NOT to touch
Everything else. main.js, package.json, preload.js, any renderer file.

## Change description

### `scripts/release.sh`

**Insert after line 8 (after `step() { ... }` helpers block), before the arg check:**

```bash
# ── nvm init ───────────────────────────────────────────────────────────────────
# nvm installs node into a versioned shim dir that only loads in login shells.
# Running `bash release.sh` skips .zshrc/.bashrc, so node/npx are invisible.
# Source nvm explicitly — same pattern as main.js resolveClaudePath().
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ── preflight ──────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || fail "node not found — install Node.js or ensure nvm is configured"
command -v npx  >/dev/null 2>&1 || fail "npx not found — ensure npm is installed"
```

**Why:** Ensures nvm-managed node is on PATH before any `node -e` or `npx` call. Falls back to system node if nvm is not present (the `. nvm.sh` line is guarded by `[ -s ... ]`).

## Conventions to follow
- Match the comment style used in the rest of `release.sh` (`# ── label ─────`)
- `fail()` helper already defined in the script — reuse it

## Side effects check
- **No side effects.** Sourcing `nvm.sh` only modifies PATH within the subshell running `release.sh`. The calling shell is unaffected.
- If nvm is not installed, the `[ -s ... ]` guard is false — no error, falls through to system node. If system node also absent → clean `fail` message.

## Test plan
Manual verification (no unit test possible for shell PATH):
1. Simulate minimal PATH: `env -i HOME=$HOME PATH=/usr/bin:/bin bash scripts/release.sh 1.5.0`
   - Before fix: `env: node: No such file or directory` or `bash: node: command not found`
   - After fix with nvm: succeeds (nvm.sh sources node)
   - After fix without nvm AND without system node: `fail "node not found — install Node.js..."`
2. Normal run: `bash scripts/release.sh 1.5.0` → succeeds end-to-end (regression check)

## Rollback plan
`git checkout scripts/release.sh`

## CODEBASE.md update needed?
No — `release.sh` is not in the CODEBASE.md file map (it's a dev script, not app source).

## ARCHITECTURE.md update needed?
Yes — add a note to the PATH resolution section that the nvm-init pattern also applies to `release.sh`, not just `main.js`.
