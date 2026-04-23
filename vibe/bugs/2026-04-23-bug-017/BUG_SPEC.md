# BUG_SPEC.md — BUG-017: Distribution failures for nvm users and Gatekeeper quarantine

---

## 1. Bug summary

Two distinct distribution issues blocking team rollout:
- **A** — Claude CLI not found at startup for users who installed Node/claude via nvm
- **B** — macOS Gatekeeper blocks the DMG with a "cannot verify" malware warning

---

## 2. Files involved

| File | Role |
|------|------|
| `main.js` | `resolveClaudePath()` (lines 174–196) + `resolveWhisperPath()` (lines 211–248) |
| `INSTALL.md` | New root-level file — install guide + Gatekeeper bypass + Slack message template |
| `vibe/distribution/slack-message.md` | Existing Slack template — needs xattr line appended |

---

## 3. Root cause

### BUG-017-A — Claude CLI not found for nvm users

`resolveClaudePath()` checks 7 static paths then falls back to:
```js
exec('zsh -lc "which claude"', ...)
exec('bash -lc "which claude"', ...)
```

Two problems in this fallback:
1. **nvm paths not in static list** — nvm installs under `~/.nvm/versions/node/{version}/bin/`. None of these paths are enumerated. With many nvm users having 2–5 installed node versions, a dynamic scan is required.
2. **Shell fallback doesn't initialize nvm** — nvm requires `source ~/.nvm/nvm.sh` to add itself to PATH. In packaged Electron apps the spawned login shell may not source `~/.zshrc` / `~/.zprofile` if they only use `[ -f ~/.nvm/nvm.sh ] && source ...` guards, which can be skipped depending on shell startup ordering. The fallback exec must explicitly source nvm.sh to guarantee nvm's PATH entries are loaded.

Additional paths missing from static list: `~/.volta/bin/claude` (Volta node manager), `~/n/bin/claude` (n node manager).

### BUG-017-B — Gatekeeper quarantine

DMG downloaded from Google Drive receives a `com.apple.quarantine` extended attribute from macOS. Combined with the self-signed certificate not being notarized, Gatekeeper blocks execution. Users see "Promptly cannot be verified" or "Promptly is damaged" dialogs.

This is a distribution documentation gap, not a code bug — the fix is user instructions.

---

## 4. Confidence level

**BUG-017-A:** 10/10 — nvm PATH structure is well-documented and the static path list has always excluded `~/.nvm/`. The nvm shell initialization requirement for non-interactive shells is confirmed behavior.

**BUG-017-B:** 10/10 — `com.apple.quarantine` xattr is a standard macOS behavior for downloaded files; `xattr -d` is the documented removal command.

---

## 5. Blast radius

**BUG-017-A fix touches:** `resolveClaudePath()` and `resolveWhisperPath()` in main.js. No IPC channels change. No renderer changes. The splash-done `check-claude-path` IPC response is unaffected — same `{ found, path }` shape.

**Risk:** Adding nvm scan before shell fallback could theoretically pick up a stale/wrong node version. Mitigated by scanning in version-directory order (alphabetical), which is deterministic. Any installed nvm node version with claude in its bin is valid.

**BUG-017-B:** INSTALL.md is a new documentation file. Zero code impact.

---

## 6. Fix approach

### A — resolveClaudePath()
1. Add `~/.volta/bin/claude` and `~/n/bin/claude` to static `commonPaths`
2. After the static loop, add dynamic nvm scan: `readdirSync(~/.nvm/versions/node)` → check each `{version}/bin/claude`
3. Replace shell fallback with nvm-init version: `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which claude`

### B — resolveWhisperPath()
Add the same nvm bin scan after static loop, before existing shell fallback.
(Whisper is Python, but it's documented in the spec — adds no harm and aligns both functions.)

### C — INSTALL.md (new)
Create `INSTALL.md` at repo root with: install steps, Gatekeeper bypass (3 options), updated Slack message template including xattr line.

---

## 7. What NOT to change

- `preload.js` — no new IPC channels
- `src/renderer/**` — no renderer changes
- `splash.html` — CLI check uses cached `claudePath` from main.js, no change needed
- `entitlements.plist`, `package.json` — signing config unchanged
- `vibe/distribution/slack-message.md` — update in-place, not replace

---

## 8. Verification plan

1. `npm run lint` — 0 errors
2. `npm start` — splash CLI check shows green with nvm-installed claude
3. Manual: create `~/.nvm/versions/node/v20.0.0/bin/claude` (symlink to real claude), confirm `resolveClaudePath()` finds it (add temp console.log, remove after test)
4. Build + sign + repackage per smoke checklist
5. Open signed DMG on a fresh macOS user — confirm xattr removal unblocks Gatekeeper

---

## 9. Regression test (manual — no test framework)

In `main.js`, temporarily add after the static loop in `resolveClaudePath()`:
```js
console.log('[BUG-017 check] nvm scan reached — static paths failed');
```
Then install from DMG on an nvm-only machine — the log should appear without the nvm scan previously finding the path. Remove the log after fix is verified.

For the Gatekeeper path: download the signed DMG, verify it shows the malware warning without xattr removal, then run `xattr -d com.apple.quarantine` and confirm it opens cleanly.
