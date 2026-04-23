# BUG_PLAN.md — BUG-017: Distribution failures (nvm PATH + Gatekeeper)

---

## 1. Exact files to modify

| File | Change type |
|------|------------|
| `main.js` | Modify `resolveClaudePath()` (lines 174–196) + `resolveWhisperPath()` (add nvm scan block) |
| `INSTALL.md` | New file — root-level install + Gatekeeper bypass guide |
| `vibe/distribution/slack-message.md` | Append xattr line to existing Slack template |
| `vibe/ARCHITECTURE.md` | Update PATH resolution section — document nvm scanning pattern |

---

## 2. Exact files NOT to touch

- `preload.js`
- `src/renderer/**` (all React components)
- `splash.html`
- `entitlements.plist`
- `package.json`
- `vibe/CODEBASE.md` (no structural change — functions already listed in file map)

---

## 3. Change description

### main.js — resolveClaudePath() (lines 174–196)

**Step 1:** Add volta + n paths to `commonPaths` array:
```js
path.join(home, '.volta/bin/claude'),
path.join(home, 'n/bin/claude'),
```

**Step 2:** After the static `for` loop and before the `return new Promise(...)`, insert nvm dynamic scan:
```js
const nvmDir = path.join(home, '.nvm', 'versions', 'node');
try {
  if (fs.existsSync(nvmDir)) {
    for (const version of fs.readdirSync(nvmDir)) {
      const claudeBin = path.join(nvmDir, version, 'bin', 'claude');
      try { if (fs.existsSync(claudeBin)) return claudeBin; } catch {}
    }
  }
} catch {}
```

**Step 3:** Replace shell fallback body to include NVM initialization:
```js
const nvmInit = `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; which claude`;
exec(`zsh -lc '${nvmInit}'`, (err, stdout) => {
  if (!err && stdout.trim()) { resolve(stdout.trim()); return; }
  exec(`bash -lc '${nvmInit}'`, (err2, stdout2) => {
    if (!err2 && stdout2.trim()) { resolve(stdout2.trim()); return; }
    resolve(null);
  });
});
```

Also: add `const home = os.homedir();` at top of function (replaces repeated `os.homedir()` calls — matches the user-supplied fix pattern).

### main.js — resolveWhisperPath() (after line 232)

After the static `for` loop (line 232) and before `const shellResolved = await new Promise(...)`, insert:
```js
const nvmWhisperDir = path.join(os.homedir(), '.nvm', 'versions', 'node');
try {
  if (fs.existsSync(nvmWhisperDir)) {
    for (const version of fs.readdirSync(nvmWhisperDir)) {
      const whisperBin = path.join(nvmWhisperDir, version, 'bin', 'whisper');
      try { if (fs.existsSync(whisperBin)) return whisperBin; } catch {}
    }
  }
} catch {}
```

### INSTALL.md (new root-level file)

Content:
- Prerequisites (Claude CLI, microphone permission)
- Install steps (download DMG → drag to Applications → launch)
- **Gatekeeper bypass section** — Option 1 (xattr), Option 2 (right-click), Option 3 (System Preferences)
- Slack message template including the xattr note

### vibe/distribution/slack-message.md

Append line:
> "If macOS flags it as unverified: open Terminal and run: `xattr -d com.apple.quarantine ~/Downloads/Promptly-signed.dmg` — then open the DMG normally."

### vibe/ARCHITECTURE.md — PATH resolution section

Update the pattern block to document nvm dynamic scanning as Step 2a, and the nvm-init shell fallback pattern.

---

## 4. Conventions to follow

- `os.homedir()` already imported via `const { app, BrowserWindow, ... } = require('electron')` and `const os = require('os')`
- `fs.existsSync` + `fs.readdirSync` — `fs` already required as `const fs = require('fs')`
- `try { } catch {}` — empty catch, consistent with existing pattern
- No new requires, no new IPC channels

---

## 5. Side effects check

- `resolveClaudePath()` is only called once in `app.whenReady()`, result cached in `claudePath`. No loop or re-invocation risk.
- `readdirSync` on a non-existent path is wrapped in try/catch — safe if `~/.nvm/` absent.
- nvm version directory names are strings like `v18.0.0` — no path traversal risk since we construct a full path with `path.join` and only call `fs.existsSync` on the result.
- Shell fallback change: single-quoting the nvmInit command avoids variable expansion by the outer shell. The inner nvm.sh path uses `$HOME` which expands correctly inside the single-quoted string when run by zsh/bash.

---

## 6. Test plan

1. `npm run lint` — 0 errors
2. `npm start` — splash CLI check green
3. Smoke checklist from bug report:
   - `resolveClaudePath()` finds claude at `~/.nvm/versions/node/*/bin/claude` ✓
   - `resolveClaudePath()` finds claude installed via volta + n ✓
   - nvm shell init runs in fallback ✓
   - Splash CLI check shows green for nvm-installed claude ✓
   - INSTALL.md has clear Gatekeeper bypass instructions ✓
4. Rebuild + re-sign + repackage per smoke checklist

---

## 7. Rollback plan

`git revert HEAD` — changes are isolated to `resolveClaudePath()` + `resolveWhisperPath()` internals and new INSTALL.md. No IPC contract changes. Reverting does not break any other code path.

---

## 8. CODEBASE.md update needed?

**No** — `resolveClaudePath()` and `resolveWhisperPath()` are already listed in the file map. Their external behavior (return type, callers, cached result) is unchanged. INSTALL.md is a distribution doc, not a source file tracked in CODEBASE.md.

---

## 9. ARCHITECTURE.md update needed?

**Yes** — PATH resolution section (line 146) documents the search pattern as 3 steps (common paths → zsh → bash). After this fix it's a 4-step pattern:
1. Static common paths
2. Dynamic nvm version scan
3. Shell fallback with explicit nvm initialization
4. (whisper only) python3 -m whisper fallback
