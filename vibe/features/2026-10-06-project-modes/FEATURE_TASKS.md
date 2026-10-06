# FEATURE_TASKS — Project modes
> **Estimated effort:** 17 tasks — S: 4 (<2 h), M: 11 (2–4 h), L: 2 (4+ h) — approx. 51 hours total
> Branch: feature/project-modes. Spec: FEATURE_SPEC.md. Plan: FEATURE_PLAN.md. Status: planned, not started (owner reviewing the spec and mockups).

---
### PRJ-001 · Project store
- **Status**: `[ ]` · **Size**: S · **Spec ref**: FEATURE_SPEC.md#6-data-model · **Dependencies**: None
- **Touches**: main/projects/store.js, tests/projects-store.test.js

**What to do**: CRUD for `config.projects` records and the userData/projects/<id>/ layout (summary.md, pins.json, manifest.json, text/, search.db paths). Ids are short random hex; colours rotate through a fixed palette distinct from mode colours. Refuse a second project on the same `dir`.

**Acceptance criteria**:
- [ ] create/update/remove/list work against a temp config; remove deletes only userData/projects/<id>
- [ ] duplicate folder refused with the existing project's name

**Self-verify**: re-read §6. **Test requirement**: unit tests on a temp dir. **⚠️ Boundaries**: never write into `dir`. **CODEBASE.md update?**: Yes (new module). **Architecture compliance**: no Electron imports; config via main/config.js.
**Decisions**: - None yet.
---
### PRJ-002 · Folder scan and ignore rules
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#3-acceptance-criteria (A2) · **Dependencies**: PRJ-001
- **Touches**: main/projects/scan.js, tests/projects-scan.test.js

**What to do**: Walk the folder without following symlinks outside it; apply built-in skips, .gitignore/.promptlyignore (basic glob support: `*`, `**`, trailing `/`, `!` negation), hidden files, >2 MB, NUL-byte binary check, media/archive/code extensions, code-root subtrees; cap 5,000 readable files newest first. Return per-top-level-folder stats (count, newest mtime, skipped reasons) and a manifest diff (added/changed/removed by size+mtime, sha1 for changed).

**Acceptance criteria**:
- [ ] fixture with node_modules, .git, _legacy code root, images and a 3 MB file → only readable docs listed; skipped counts per reason
- [ ] manifest diff detects add/change/remove/rename-as-remove+add

**Self-verify**: A2. **Test requirement**: unit tests with a generated fixture tree. **⚠️ Boundaries**: read-only on the user's folder. **CODEBASE.md update?**: Yes. **Architecture compliance**: fs only, no shell.
**Decisions**: - None yet.
---
### PRJ-003 · Text extraction and email parsing
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#f-email-files · **Dependencies**: PRJ-002
- **Touches**: main/projects/extract.js, main/projects/email.js, main/platform/darwin.js, main/platform/win32.js, tests/projects-email.test.js

**What to do**: md/txt as is; eml/mbox parsing (headers, encoded words, multipart, base64, QP, charsets, HTML→text), thread grouping and quote stripping (§23–25); docx/rtf/doc/html through `platform.extractTextCommand(ext)` → `['/usr/bin/textutil', ['-convert','txt','-stdout', file]]` on macOS, null on Windows. Write extracted text into `text/` mirroring paths.

**Acceptance criteria**:
- [ ] sample .eml files (plain, multipart/alternative, base64, QP, ISO-8859-1, encoded subject) parse correctly
- [ ] a 3-message thread keeps the newest in full and only new text of older ones
- [ ] .md with From/Date/Subject header lines is recognised as email

**Self-verify**: §23–25. **Test requirement**: unit tests with fixture emails. **⚠️ Boundaries**: execFile with arg array only. **CODEBASE.md update?**: Yes. **Architecture compliance**: OS specifics only in main/platform/*.
**Decisions**: - None yet.
---
### PRJ-004 · Local search index (node:sqlite FTS5)
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#e-context-for-each-request · **Dependencies**: PRJ-003
- **Touches**: main/projects/search.js, tests/projects-search.test.js

**What to do**: Lazy `require('node:sqlite')`; FTS5 table with porter+unicode61; chunk ~2,000 chars with a "title · date · sender" header; upsert/delete by path; `search(text, { kinds, limit })` builds an OR query from content words (stop words dropped, names kept), ranks by bm25 then newer date on near-ties; returns excerpts with path/date. If node:sqlite is unavailable, `available() === false` and callers fall back to summary-only.

**Acceptance criteria**:
- [ ] "tenant ID SSO" ranks the standup note and SSO email above unrelated docs; a newer near-tie wins
- [ ] deleting a file removes its chunks
- [ ] runs under plain Node 24 (vitest) and Electron 41
- [ ] FTS5 confirmed on Windows: a unit test that opens an FTS5 table runs in .github/workflows/windows.yml

**Self-verify**: §20.3, §9 non-functional. **Test requirement**: unit tests. **⚠️ Boundaries**: no npm dependency. **CODEBASE.md update?**: Yes + Gotcha (RC API). **Architecture compliance**: rule 10.
**Decisions**: - None yet.
---
### PRJ-005 · Watching for new files
- **Status**: `[ ]` · **Size**: S · **Spec ref**: FEATURE_SPEC.md#c-freshness · **Dependencies**: PRJ-002, PRJ-004
- **Touches**: main/projects/watch.js, tests/projects-watch.test.js (the rescan → extract → index loop and newFiles are wired in PRJ-009)

**What to do**: fs.watch(dir, { recursive: true }) per project; any event marks dirty; 2 s debounce → scan diff → extract changed → index; also on start and on focus (≤ 1/min). Track files new or changed since `summaryUpdatedAt` as `newFiles`. Watcher errors fall back to focus rescans.

**Acceptance criteria**:
- [ ] adding a file updates the index within ~3 s and increments newFiles
- [ ] stop() closes all watchers on quit

**Self-verify**: §13–15. **Test requirement**: unit test with an injected clock/fs events. **⚠️ Boundaries**: —. **CODEBASE.md update?**: Yes. **Architecture compliance**: no Electron imports.
**Decisions**: - None yet.
---
### PRJ-006 · Folder map (classify call)
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#a-connecting-a-folder-screens-12 (A3–A4) · **Dependencies**: PRJ-002
- **Touches**: main/projects/classify.js, main/prompts/project-classify.txt, tests/projects-classify.test.js

**What to do**: Build the ≤40 KB manifest (paths, sizes, dates, 300-char snippets, ≤3 per folder), ask for JSON kinds per folder with optional question for `unsure`; parse with `parseJsonOutput`; one retry; fallback to `reference` with a note.

**Acceptance criteria**:
- [ ] owner-style layout and a sales-style layout fixture both classify into the 6 kinds via the fake Claude
- [ ] manifest never exceeds 40 KB; code/excluded folders send names only

**Self-verify**: A3–A4. **Test requirement**: unit tests with a fake runner. **⚠️ Boundaries**: prompt text only in main/prompts/. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 1, rule 4.
**Decisions**: - None yet.
---
### PRJ-007 · Project summary: build, refresh, rebuild, pins
- **Status**: `[ ]` · **Size**: L · **Spec ref**: FEATURE_SPEC.md#b-the-project-summary · **Dependencies**: PRJ-003, PRJ-006
- **Touches**: main/projects/summary.js, main/prompts/project-facts.txt, project-merge.txt, project-refresh.txt, tests/projects-summary.test.js

**What to do**: Map step (batched files ≤60 KB/call → fact lists with sources), merge step (fixed sections, sources on each bullet, ≤2,500 words), progress callback, cancel, resume. Refresh: new/changed files + current summary → JSON diff (add/change/retire) applied to unpinned lines; rewrite Latest activity from last 14 days of conversations. Pins: user-edited/added lines stored with ids and preserved. PROMPTLY.md write/read-back when keepInFolder.

**Acceptance criteria**:
- [ ] fake-Claude build yields all 7 sections with sources
- [ ] a pinned line survives refresh and rebuild; a retired file's lines go
- [ ] Latest activity is replaced, not appended, on each refresh

**Self-verify**: §7–12. **Test requirement**: unit tests for diff apply + pins + caps. **⚠️ Boundaries**: never write in the folder unless keepInFolder. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 1, rule 4.
**Decisions**: - None yet.
---
### PRJ-008 · Request context and Write as
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#e-context-for-each-request, #d-project-modes · **Dependencies**: PRJ-004, PRJ-007
- **Touches**: main/projects/context.js, main/prompts/project-context.txt, tests/projects-context.test.js (the runGeneratePrompt project branch in main.js is wired in PRJ-009)

**What to do**: Output picker (§17 phrases → email/prompt/polish, else default); assemble `<project>` (summary, thread for email, search excerpts by kind, ~30 KB budget, dedupe, documents before the request) and grounding instructions; `runGeneratePrompt` project branch uses the existing email/prompt/polish templates with the block in `{CONTEXT}`; result adds `sources`; exclusions honoured.

**Acceptance criteria**:
- [ ] "reply to Aparna…" → email; "write a prompt for…" → prompt; otherwise default
- [ ] block ordering and budget hold; excluded paths never appear
- [ ] non-project modes produce byte-identical prompts to today

**Self-verify**: §17–22. **Test requirement**: unit tests incl. a golden check that existing modes are unchanged. **⚠️ Boundaries**: don't change existing templates' text. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 4.
**Decisions**: - None yet.
---
### PRJ-009 · IPC for projects
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#7-ipc-all-via-preload · **Dependencies**: PRJ-001…PRJ-008
- **Touches**: main.js, preload.js, tests/ipc-contract.test.js

**What to do**: Handlers in §7 with `fromWindow` guards; the folder picker in main; scan tokens map to the dir main picked; watcher lifecycle on start/quit; summary progress events; generate-prompt `project` option.

**Acceptance criteria**:
- [ ] contract test green; the renderer cannot make main read a path it didn't pick
- [ ] removing a project stops its watcher and deletes only Promptly's data

**Self-verify**: §7. **Test requirement**: contract test + unit tests for token checks. **⚠️ Boundaries**: changing generate-prompt's response shape is additive only (`sources`). **CODEBASE.md update?**: Yes + ARCHITECTURE IPC table. **Architecture compliance**: rule 5, rule 7.
**Decisions**: - None yet.
---
### PRJ-010 · Connect flow screens (map, questions, summary preview)
- **Status**: `[ ]` · **Size**: L · **Spec ref**: FEATURE_SPEC.md#a-connecting-a-folder-screens-12 · **Dependencies**: PRJ-009
- **Touches**: src/renderer/components/ProjectConnect.jsx, ProjectSummaryEditor.jsx, hooks/useProjects.js, App.jsx (panel state via transition)

**What to do**: Build mockup screens 1–2: folder rows with kinds/switches/unsure questions, role + writes questions, Write the summary with progress + cancel, summary preview with source labels, Edit (pins), Keep the summary choice, Save project.

**Acceptance criteria**:
- [ ] matches mockups 1–2 in both themes; passes the layout audit
- [ ] cancel at any step leaves no project saved

**Self-verify**: A1–A6. **Test requirement**: ui.spec screenshots + audit. **⚠️ Boundaries**: theme tokens only; 11–17 px type. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 6, rule 8.
**Decisions**: - None yet.
---
### PRJ-011 · Settings › Projects
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#i-settings--projects-screen-3 · **Dependencies**: PRJ-009
- **Touches**: src/renderer/components/SettingsPanel.jsx, ProjectsSection.jsx

**What to do**: Mockup screen 3: list, new-file hint, Refresh, Open and edit summary, Change folders, Usually writes, Look deeper switch, Rebuild, Remove (with PROMPTLY.md option), missing-folder Locate….

**Acceptance criteria**:
- [ ] matches mockup 3; actions call the IPC and reflect progress/errors

**Self-verify**: §29–30. **Test requirement**: ui.spec + an e2e click-through. **⚠️ Boundaries**: —. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 8.
**Decisions**: - None yet.
---
### PRJ-012 · Projects in the mode menu and header
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#d-project-modes · **Dependencies**: PRJ-009
- **Touches**: src/renderer/components/ModeDropdown.jsx, ExpandedTransportBar.jsx, hooks/useMode.js, utils/modes.js, hooks/useRecording.js, hooks/useTextInput.js, utils/history.js, ExpandedHistoryList.jsx

**What to do**: Projects group (mockup 4), `project:<id>` mode keys, pill with project colour, idle text, passing `{ project }` on generate, history tag with project name/colour; a removed project's key falls back to Dictation.

**Acceptance criteria**:
- [ ] selecting a project mode and speaking produces a project result; existing modes unchanged
- [ ] history shows the project tag

**Self-verify**: §16, §19. **Test requirement**: e2e. **⚠️ Boundaries**: shared component change (ModeDropdown) is additive. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 6, rule 9.
**Decisions**: - None yet.
---
### PRJ-013 · Write as, and Based on
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#d-project-modes (§17), #e (§21) · **Dependencies**: PRJ-012
- **Touches**: src/renderer/components/WriteAsPicker.jsx, ProjectSources.jsx, ExpandedPromptReadyContent.jsx, EmailReadyState.jsx, polish result view

**What to do**: Mockup 5: Write as select re-runs with the other output; Based on chips with × redo (exclusions for that request only).

**Acceptance criteria**:
- [ ] switching Write as re-runs and swaps the result screen
- [ ] × removes the file and the redo's sources no longer list it

**Self-verify**: §17, §21. **Test requirement**: e2e. **⚠️ Boundaries**: result screens unchanged outside project modes. **CODEBASE.md update?**: Yes. **Architecture compliance**: rule 6 (opIdRef on redo).
**Decisions**: - None yet.
---
### PRJ-014 · Dictation suggestion
- **Status**: `[ ]` · **Size**: S · **Spec ref**: FEATURE_SPEC.md#g-dictation-suggestion-screen-6 · **Dependencies**: PRJ-008, PRJ-012
- **Touches**: main/projects/suggest.js, tests/projects-suggest.test.js (not built yet: hooks/useDictation.js, dictation result view)

**What to do**: Match project name / People / Words (≥4 letters, whole word) → `project-suggest`; show "As an <Project> email|prompt" beside As a prompt; runs the dictation through that project mode.

**Acceptance criteria**:
- [ ] shows only on a match; Dictation output unchanged either way

**Self-verify**: §26. **Test requirement**: unit + e2e. **⚠️ Boundaries**: no AI call; Dictation pipeline untouched. **CODEBASE.md update?**: Yes. **Architecture compliance**: —.
**Decisions**: - None yet.
---
### PRJ-015 · Look deeper (Claude Code, read-only)
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#h-look-deeper-claude-code-only · **Dependencies**: PRJ-008
- **Touches**: main/llm.js, tests/projects-llm.test.js (main.js wiring: text-cache cwd, Read paths into sources, the retry without Look deeper, in PRJ-009)

**What to do**: `run(prompt, { cwd, tools, maxTurns })`: replaces `--tools ''` with the list, keeps `--strict-mcp-config` and the user's settings, sets cwd to the text cache, `--max-turns`; collect `Read` tool paths from stream-json into sources; per-project setting; one retry without it on failure; API key → skipped.

**Acceptance criteria**:
- [ ] args contain `--tools Read Grep Glob` and `--strict-mcp-config`, never `--restricted`; cwd is the cache
- [ ] opened files appear in Based on

**Self-verify**: §27–28. **Test requirement**: runner unit tests with the fake CLI. **⚠️ Boundaries**: never give write/exec tools; never point cwd at the user's folder. **CODEBASE.md update?**: Yes + ARCHITECTURE rule 1 note. **Architecture compliance**: rule 1.
**Decisions**: - None yet.
---
### PRJ-016 · End-to-end tests and UI audit
- **Status**: `[ ]` · **Size**: M · **Spec ref**: FEATURE_SPEC.md#10-conformance-checklist · **Dependencies**: PRJ-010…PRJ-015
- **Touches**: e2e/fixtures/project-acme/**, e2e/app.spec.mjs, e2e/ui.spec.mjs, e2e/fakes/claude.mjs

**What to do**: Fake Claude answers classify/facts/merge/refresh/context prompts; tests per FEATURE_PLAN §9; UI screens in both themes.

**Acceptance criteria**:
- [ ] full e2e green (ask the owner before running), UI audit clean

**Self-verify**: §10. **Test requirement**: this task. **⚠️ Boundaries**: ask before the full e2e run. **CODEBASE.md update?**: No. **Architecture compliance**: testing philosophy.
**Decisions**: - None yet.
---
### PRJ-017 · Docs
- **Status**: `[ ]` · **Size**: S · **Spec ref**: — · **Dependencies**: PRJ-016
- **Touches**: vibe/DECISIONS.md, vibe/CODEBASE.md, vibe/ARCHITECTURE.md, CLAUDE.md, vibe/TASKS.md

**What to do**: D-PROJECT-MODES final, file map, IPC table, Gotchas, CLAUDE.md structure block.

**Acceptance criteria**:
- [ ] docs match the code; separate docs commit

**Self-verify**: —. **Test requirement**: —. **⚠️ Boundaries**: code and doc commits separate. **CODEBASE.md update?**: Yes. **Architecture compliance**: —.
**Decisions**: - None yet.
---

#### Conformance: Project modes
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Connect → map → questions → summary → save works on the owner's layout and a differently structured fixture
- [ ] Code, archive, hidden and ignored files are never extracted or sent
- [ ] Summary has the fixed sections, sources on every bullet, pinned edits survive Refresh and Rebuild
- [ ] A new file is used by the next request without a Refresh; the hint appears; Refresh clears it
- [ ] Project modes in the mode menu; Write as picks by phrase and can be changed
- [ ] Based on lists real files; × redo excludes them
- [ ] Dictation output identical with and without projects; suggestion only on a match
- [ ] Look deeper read-only, no MCP tools, only the text cache
- [ ] Works on an API key (without Look deeper)
- [ ] Remove project leaves the folder untouched
- [ ] All new tests pass · all existing tests pass · linter clean · no regressions
- [ ] CODEBASE.md and ARCHITECTURE.md updated
---
