# FEATURE_PLAN — Project modes
> Spec: FEATURE_SPEC.md (same folder) · Branch: feature/project-modes, merged `--no-ff` so one revert undoes it

## 1. Impact map
**New files**
- `main/projects/store.js` — project records in config + userData/projects/<id>/ paths, create/update/remove
- `main/projects/scan.js` — folder walk, ignore rules (.gitignore/.promptlyignore, built-ins, code roots, binary/size), manifest diff
- `main/projects/extract.js` — text per type (md/txt as is; eml/mbox via email.js; docx/rtf/doc/html via `platform.extractTextCommand`)
- `main/projects/email.js` — RFC 5322/MIME parsing, encoded words, threading, quote stripping
- `main/projects/search.js` — node:sqlite FTS5 index: upsert/delete chunks, `search(query, { kinds, limit })` with recency tiebreak
- `main/projects/watch.js` — fs.watch recursive + debounce + focus rescan; dirty/new-file counts
- `main/projects/summary.js` — map-reduce build, refresh diff apply, pins, section caps, PROMPTLY.md sync
- `main/projects/context.js` — output picker (§17), `<project>` block assembly (§20), sources list
- `main/projects/suggest.js` — project match for a dictation (§26)
- `main/prompts/project-classify.txt`, `project-facts.txt`, `project-merge.txt`, `project-refresh.txt`, `project-context.txt`
- Renderer: `components/ProjectsSection.jsx`, `ProjectConnect.jsx`, `ProjectSummaryEditor.jsx`, `ProjectSources.jsx`, `WriteAsPicker.jsx`; `hooks/useProjects.js`
- Tests: `tests/projects-scan.test.js`, `projects-email.test.js`, `projects-search.test.js`, `projects-summary.test.js`, `projects-context.test.js`; e2e fixture `e2e/fixtures/project-acme/` + specs in `e2e/app.spec.mjs` / `ui.spec.mjs`

**Modified files**
- `main/llm.js` — `run(prompt, { cwd, tools, maxTurns })` (read-only look-deeper); default unchanged
- `main/prompts.js` — `buildProjectPrompts`, `<project>` part in `buildContextBlock`
- `main/platform/darwin.js`, `win32.js` — `extractTextCommand(ext)`
- `shared/modes.json` — `project` kind definition
- `main.js` — IPC handlers, watcher start/stop, `runGeneratePrompt` project branch, history-free (renderer saves history)
- `preload.js`, `tests/ipc-contract.test.js`
- `src/renderer/components/ModeDropdown.jsx`, `ExpandedTransportBar.jsx`, `SettingsPanel.jsx`, `ExpandedPromptReadyContent.jsx`, `EmailReadyState.jsx`, `PolishReadyState`/polish view, `ExpandedHistoryList.jsx` (project tag), `hooks/useMode.js`, `utils/modes.js`, `hooks/useDictation.js`, `hooks/useRecording.js`/`useTextInput.js` (pass project option), `utils/history.js` (project field)
- Docs: `vibe/ARCHITECTURE.md` (IPC table, rule 1 note on read-only tools), `vibe/CODEBASE.md`, `vibe/DECISIONS.md` (D-PROJECT-MODES), `CLAUDE.md` structure block

## 2. Out of scope (do not touch)
Dictation pipeline (`main/dictation.js`, `cleanUpDictation`, whisper), Harness, image/video/workflow builders, `native/**`, release scripts, the website, history/profile formats beyond the optional `project` field.

## 3. Data / migrations
No migration: `projects` is a new config key (absent = none). userData/projects/ is created on first connect. Removing the feature leaves an unused key and folder (harmless).

## 4. Main process
- Scan and extraction run off the request path (setImmediate batches) so the window stays responsive; progress events per 25 files.
- Every Claude call goes through the existing routers (`claude` for summary/classify; `claude.run` with project context for requests). Look deeper uses a dedicated `createClaudeRunner` call with `tools: ['Read','Grep','Glob']`, `cwd: <userData>/projects/<id>/text`, `maxTurns: 12`, stream-json to collect `Read` tool paths for Based on.
- Paths: the renderer only ever sends a project id and relative paths that main checks against the manifest.
- node:sqlite is required lazily (`require('node:sqlite')`) inside search.js so a failure disables search (summary-only context) with a log line instead of crashing.

## 5. Renderer
- Mode keys for projects are `project:<id>`; `resolveModeKey` passes them through; the mode menu reads `projects-list`.
- Connect flow is a full-window panel like Settings (two steps), reachable from Settings › Projects and the mode menu.
- Result screens: a `WriteAsPicker` in the header and `ProjectSources` under the result when `result.sources` exists.

## 6. Conventions
CommonJS + 'use strict' in main; no Electron imports in `main/projects/*`; external commands via execFile arg arrays (textutil); theme tokens and 11–17 px type; IPC = preload method + ipcMain.handle with the contract test; prompt text only in main/prompts/; all renderer state changes through `transition()`; async work tagged with `opIdRef`.

## 7. Task order
Data → main (store, scan, extract, email, search, watch) → AI (classify, summary, context, llm options) → IPC → renderer (connect, settings, mode menu, result, dictation suggestion) → look deeper → e2e/UI audit → docs.

## 8. Rollback
Branch merged with `--no-ff`; `git revert -m 1 <merge>` removes it. Users' folders are never modified (except opt-in PROMPTLY.md). Keep the 2.22.2 DMGs as the fallback build.

## 9. Testing
- Unit: ignore rules and code-root detection; eml/mbox parsing incl. base64/QP/encoded words and quote stripping; FTS5 search ranking + recency; summary diff apply with pins; output picker phrases; suggestion matching; context budget/ordering; llm run options produce `--tools Read Grep Glob`, keep `--strict-mcp-config`, set cwd.
- e2e (fake Claude): connect `e2e/fixtures/project-acme/` → map → summary → save; project email shows Based on; add a file → next request includes it, hint shows, Refresh clears; Dictation unchanged; suggestion appears on a name.
- UI audit: connect, summary, Settings › Projects, mode menu with projects, result with sources — both themes.

## 10. CODEBASE.md to update
File map (all new files above), IPC note, Gotchas: node:sqlite is release-candidate; fs.watch unreliable on network drives; never `--restricted` without `--effort`.
