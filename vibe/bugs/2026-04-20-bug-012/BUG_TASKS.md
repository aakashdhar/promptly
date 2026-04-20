# BUG_TASKS.md — BUG-012: PATH resolution fails in packaged DMG

---

### BUG-012-001 · Implement fix in main.js
- **Status**: `[ ]` | **Depends on**: None | **Touches**: `main.js`
- **CODEBASE.md update**: Yes — whisperPath row

**What to do**:
1. Replace `resolveClaudePath()` with common-paths + zsh → bash fallback (see BUG_PLAN.md Change 1)
2. Add `resolveWhisperPath()` after it (see BUG_PLAN.md Change 2)
3. In `app.whenReady()` — replace fire-and-forget whisper exec with `await resolveWhisperPath()` (Change 3)
4. In `transcribe-audio` IPC — construct `whisperCmd` to handle `'python3 -m whisper'` case (Change 4)
5. Update CODEBASE.md whisperPath row

**Acceptance criteria**:
- [ ] `resolveClaudePath()` tries common paths first, then zsh, then bash
- [ ] `resolveWhisperPath()` function exists with common paths + python3 fallback
- [ ] Both paths awaited before window creation in `app.whenReady()`
- [ ] `transcribe-audio` uses `whisperCmd` that handles `'python3 -m whisper'`
- [ ] `os` and `fs` already imported — no new imports needed
- [ ] CODEBASE.md whisperPath row updated

**⚠️ Boundaries**: Only `main.js` and `vibe/CODEBASE.md` — touch nothing else.

---

### BUG-012-002 · Verify and run lint
- **Status**: `[ ]` | **Depends on**: BUG-012-001 | **Touches**: none

**What to do**:
1. Run `npm run lint` — must be clean (0 errors)
2. Run `npm start` — verify app boots, splash shows
3. Check CODEBASE.md whisperPath row reflects `resolveWhisperPath()`

**Acceptance criteria**:
- [ ] `npm run lint` — 0 errors
- [ ] App boots in dev mode, splash shows correctly
- [ ] CODEBASE.md updated

---

### BUG-012-003 · Update docs
- **Status**: `[ ]` | **Depends on**: BUG-012-002 | **Touches**: `vibe/ARCHITECTURE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. Update ARCHITECTURE.md "PATH resolution" section — document expanded search pattern
2. Append BUG-012 entry to DECISIONS.md
3. Mark BUG-012 complete in TASKS.md

**Acceptance criteria**:
- [ ] ARCHITECTURE.md PATH resolution section reflects new pattern
- [ ] DECISIONS.md has BUG-012 entry
- [ ] TASKS.md shows BUG-012 complete

---

#### Bug Fix Sign-off: BUG-012 — PATH resolution fails in packaged DMG
- [ ] Fix implemented — common paths + zsh → bash fallback for both claude and whisper
- [ ] Race condition eliminated — whisperPath awaited before window creation
- [ ] python3 -m whisper case handled in transcribe-audio exec
- [ ] Linter clean
- [ ] No files outside BUG_PLAN.md scope modified
- [ ] CODEBASE.md updated
- [ ] ARCHITECTURE.md updated
- [ ] DECISIONS.md updated
