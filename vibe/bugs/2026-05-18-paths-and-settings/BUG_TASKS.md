# BUG_TASKS — paths-and-settings

---

### BUG-001 · Write the regression test
- **Status**: `[x]` | **Depends on**: None | **Touches**: `tests/utils.test.js`

**What to do**: No automated test is feasible for IPC path management in Electron. Manual regression test is the verification plan. Mark this done — verification occurs in BUG-003.

**Acceptance criteria**:
- [x] Manual smoke test plan documented in BUG_SPEC.md section 8
- [x] Confirmed: no existing automated test for `save-paths` or `get-stored-paths` in `tests/utils.test.js`

**Decisions**: Skipped automated test — IPC path management requires Electron runtime. Verification is manual smoke test per BUG_SPEC.

---

### BUG-002 · Implement the fix
- **Status**: `[x]` | **Depends on**: BUG-001 | **Touches**: `main.js`, `src/renderer/components/ExpandedTransportBar.jsx`, `src/renderer/components/SettingsPanel.jsx`, `splash.html`
- **CODEBASE.md update**: Yes — IPC channel docs + ExpandedTransportBar entry

**What to do**:

**main.js changes:**
1. Add `let ffmpegPath = null;` after line 209 (`let whisperPath = null;`)
2. In `resolveFfmpegPath()` (line 581): prepend config check before the commonPaths scan
3. Line ~738: add `ffmpegPath = await resolveFfmpegPath();` after whisperPath init
4. `get-stored-paths`: add `ffmpegPath: ffmpegPath || config.ffmpegPath || ''`
5. `save-paths`: add ffmpegPath destructure + save logic
6. `recheck-paths`: re-resolve ffmpegPath + return ffmpeg status

**ExpandedTransportBar.jsx:**
- Add gear icon button (left of collapse button) calling `onOpenSettings`; only renders when `onOpenSettings` is truthy

**SettingsPanel.jsx:**
- Add ffmpegVal/ffmpegStatus state
- Load ffmpegPath in useEffect
- Add handleBrowseFfmpeg
- Add ffmpeg path section in JSX
- Include ffmpegPath in savePaths call
- Update recheck + failure message logic

**splash.html:**
- Add whisper path input to `s2-both-notfound` state
- Add ffmpeg path row to pathPanel
- Update saveRecheckBtn handler for ffmpeg
- Add inline "Set path →" affordance to runChecks() failure states

**Acceptance criteria**:
- [ ] `let ffmpegPath = null` declared in main.js
- [ ] `resolveFfmpegPath()` checks config first
- [ ] `save-paths` stores ffmpegPath to config.json
- [ ] `get-stored-paths` returns ffmpegPath
- [ ] `recheck-paths` returns ffmpeg status
- [ ] Gear icon visible in ExpandedTransportBar header → clicking it opens settings
- [ ] SettingsPanel shows Claude + Whisper + ffmpeg path fields
- [ ] `s2-both-notfound` has whisper path input in wizard
- [ ] pathPanel in splash has ffmpeg path field
- [ ] CODEBASE.md updated

**⚠️ Boundaries**: Only touch the four listed files · no new patterns · no runtime npm packages
**Decisions**: > Filled in by agent. None yet.

---

### BUG-003 · Verify fix and run full suite
- **Status**: `[x]` | **Depends on**: BUG-002 | **Touches**: none

**What to do**:
1. `npm run lint` — must be clean
2. `npm start` — smoke test per BUG_SPEC.md section 8:
   - Gear icon visible in expanded transport bar → settings opens
   - Settings shows all three path fields + Browse + Save & Recheck
   - Bad path → red status; good path → green status
   - splash wizard s2-both-notfound: whisper path input visible
   - splash OLD flow (returning user): "Set path →" affordance visible on failure
   - Save paths → check userData/config.json contains ffmpegPath

**Acceptance criteria**:
- [ ] `npm run lint` — zero errors
- [ ] Settings panel opens from gear icon in expanded view
- [ ] All three path fields shown with verify status
- [ ] ffmpegPath persisted to config.json

**Decisions**: > Filled in by agent. None yet.

---

### BUG-004 · Update docs
- **Status**: `[x]` | **Depends on**: BUG-003

**What to do**:
1. Update `vibe/CODEBASE.md`: IPC channel section — note `save-paths` now accepts optional `ffmpegPath`; `get-stored-paths` now returns `ffmpegPath`; `recheck-paths` now returns `ffmpeg` status. Note gear button in ExpandedTransportBar.
2. Append to `vibe/DECISIONS.md`

**Acceptance criteria**:
- [ ] CODEBASE.md IPC section updated
- [ ] DECISIONS.md entry appended

**Decisions**: > Filled in by agent. None yet.

---

#### Bug Fix Sign-off: paths-and-settings
- [ ] Gear icon in main app UI opens settings panel
- [ ] SettingsPanel shows Claude + Whisper + ffmpeg path fields
- [ ] ffmpegPath stored in config.json via save-paths
- [ ] `s2-both-notfound` wizard state shows whisper path input
- [ ] splash pathPanel has ffmpeg path field
- [ ] runChecks() failure states have "Set path →" affordance
- [ ] `npm run lint` clean
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
- [ ] Doc commits separate from code commits
