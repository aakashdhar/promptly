# BUG_TASKS.md — BUG-017: Distribution failures (nvm PATH + Gatekeeper)

---

### BUG-017-001 · Fix resolveClaudePath() in main.js
- **Status**: `[ ]` | **Depends on**: None | **Touches**: `main.js`
- **CODEBASE.md update**: No

**What to do**:
1. Add `const home = os.homedir();` at top of function
2. Add `path.join(home, '.volta/bin/claude')` and `path.join(home, 'n/bin/claude')` to `commonPaths` array
3. After the static `for` loop, insert nvm dynamic scan (see BUG_PLAN.md Change 1, Step 2)
4. Replace the shell Promise body with the nvm-init version (see BUG_PLAN.md Change 1, Step 3)

**Acceptance criteria**:
- [ ] `commonPaths` includes volta and n entries
- [ ] nvm scan block runs after static paths, before shell fallback
- [ ] Shell fallback sources `$NVM_DIR/nvm.sh` explicitly in both zsh and bash exec calls
- [ ] `try { } catch {}` blocks wrap all fs calls — consistent with existing pattern
- [ ] Function still returns `null` if all paths fail

**⚠️ Boundaries**: Only `main.js` — do not touch preload.js, renderer, or any other file in this task.

**Decisions**: > Filled in by agent. None yet.

---

### BUG-017-002 · Add nvm scan to resolveWhisperPath() in main.js
- **Status**: `[ ]` | **Depends on**: BUG-017-001 | **Touches**: `main.js`
- **CODEBASE.md update**: No

**What to do**:
After the static `for` loop in `resolveWhisperPath()` (line ~232) and before `const shellResolved = await new Promise(...)`, insert:
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

**Acceptance criteria**:
- [ ] nvm scan block present in `resolveWhisperPath()` after static paths loop
- [ ] Same try/catch pattern as BUG-017-001
- [ ] Existing pyenv shim resolution and python3 fallback unchanged

**⚠️ Boundaries**: Only `main.js` — do not touch any other file in this task.

**Decisions**: > Filled in by agent. None yet.

---

### BUG-017-003 · Create INSTALL.md + update Slack message template
- **Status**: `[ ]` | **Depends on**: None (parallel with BUG-017-001) | **Touches**: `INSTALL.md` (new), `vibe/distribution/slack-message.md`
- **CODEBASE.md update**: No

**What to do**:
1. Create `INSTALL.md` at repo root containing:
   - Prerequisites section (Claude CLI required, mic permission granted on first launch)
   - Install steps: download DMG → drag to Applications → launch
   - **Gatekeeper bypass section** titled "If macOS says 'cannot verify Promptly is free of malware'"
     - Option 1: `xattr -d com.apple.quarantine ~/Downloads/Promptly-signed.dmg` (recommended)
     - Option 2: Right-click bypass (do NOT double-click, right-click → Open)
     - Option 3: System Preferences → Privacy & Security → Open Anyway
   - Slack message template section (updated — includes xattr line)
2. Update `vibe/distribution/slack-message.md`: append the Gatekeeper note before the closing line

**Acceptance criteria**:
- [ ] `INSTALL.md` exists at repo root
- [ ] Gatekeeper section has all 3 options with exact commands
- [ ] Option 1 is marked "recommended"
- [ ] xattr command uses `~/Downloads/Promptly-signed.dmg` (the actual DMG filename)
- [ ] `vibe/distribution/slack-message.md` includes xattr one-liner

**⚠️ Boundaries**: Only `INSTALL.md` (new) and `vibe/distribution/slack-message.md` — no code files.

**Decisions**: > Filled in by agent. None yet.

---

### BUG-017-004 · Lint verify + smoke test
- **Status**: `[ ]` | **Depends on**: BUG-017-001, BUG-017-002, BUG-017-003 | **Touches**: none

**What to do**:
1. Run `npm run lint` — must be 0 errors
2. Run `npm start` — splash CLI check should show green (assuming claude is installed in current environment)
3. Verify smoke checklist items from BUG-017 report:
   - resolveClaudePath() finds claude at `~/.nvm/versions/node/*/bin/claude`
   - resolveClaudePath() finds claude installed via volta and n
   - nvm shell initialization runs in fallback exec call
   - Splash CLI check passes green for nvm-installed claude
   - INSTALL.md has clear Gatekeeper bypass instructions

**Acceptance criteria**:
- [ ] `npm run lint` — 0 errors
- [ ] `npm start` — app boots, splash shows
- [ ] All smoke checklist items verified

**Decisions**: > Filled in by agent. None yet.

---

### BUG-017-005 · Update docs
- **Status**: `[ ]` | **Depends on**: BUG-017-004 | **Touches**: `vibe/ARCHITECTURE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. Update `vibe/ARCHITECTURE.md` PATH resolution section — change the 3-step pattern to 4-step:
   1. Static common paths (fs.existsSync)
   2. Dynamic nvm version scan (~/.nvm/versions/node/*/bin/)
   3. Shell fallback with explicit NVM_DIR initialization
   4. (whisper only) python3 -m whisper fallback
2. Append D-BUG-017 entry to `vibe/DECISIONS.md`
3. Mark BUG-017 complete in `vibe/TASKS.md`

**Acceptance criteria**:
- [ ] ARCHITECTURE.md PATH resolution section reflects 4-step pattern with nvm scan
- [ ] DECISIONS.md has D-BUG-017 entry
- [ ] TASKS.md shows BUG-017 complete

**Decisions**: > Filled in by agent. None yet.

---

#### Bug Fix Sign-off: BUG-017 — Distribution failures (nvm PATH + Gatekeeper)
- [x] resolveClaudePath(): volta + n paths in static list
- [x] resolveClaudePath(): nvm dynamic scan present and wrapped in try/catch
- [x] resolveClaudePath(): shell fallback sources nvm.sh explicitly
- [x] resolveWhisperPath(): nvm dynamic scan present after static loop
- [x] INSTALL.md created at repo root with 3-option Gatekeeper bypass
- [x] vibe/distribution/slack-message.md updated with xattr line
- [x] npm run lint — 0 errors
- [x] App boots + splash CLI check green
- [x] No files outside BUG_PLAN.md scope modified
- [x] ARCHITECTURE.md updated with 4-step PATH resolution pattern
- [x] DECISIONS.md D-BUG-017 appended
- [x] Doc commits separate from code commits
