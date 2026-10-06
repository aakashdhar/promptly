# FEATURE_SPEC — Project modes (prompts and emails written from a project folder)
> Folder: vibe/features/2026-10-06-project-modes/ · Branch: feature/project-modes (never main until the owner merges)
> Requested by a team member; shaped with the owner 2026-10-06. Research: 3 research agents + local tests (see §11).
> Mockups: https://claude.ai/artifact/Q268jeDcxKXtnBxVaQ89GB (6 screens: connect, summary, Settings › Projects, mode menu, result, Dictation suggestion).

## 1. Overview
A person connects a local project folder (any structure: exported emails, meeting notes, contracts, specs, docs). The folder becomes its own mode in the mode menu ("Infer360"). In that mode, what they say is written as an email, a prompt or polished text **grounded in that project**: who's who, what's agreed, what's open, how the client likes to be written to, and the newest material. Dictation never uses a project.

Why: today every Craft prompt starts from zero context, so a PM re-explains the project each time. No voice app grounds on a folder (they only use what is on screen); the products that do (Claude/ChatGPT Projects, NotebookLM) are chat windows, not "speak anywhere".

## 2. User stories
- As a PM, I connect my Infer360 folder once, check what Promptly found, answer two questions, read and correct the summary, and save.
- As a PM in Infer360 mode, I say "reply to Aparna, yes we can add the copyable link this week, and remind them we need the tenant ID" and get an email that uses the right names, dates and commitments from the folder, with the files it used listed under it.
- As anyone whose folder gets new emails daily, today's files count straight away, and I press Refresh when I want the summary updated.
- As a person dictating, I talk normally; when I tap to turn it into something and I mentioned someone from a project, Promptly offers "As an Infer360 email".
- As a teammate with a different folder layout (or a different role), the same flow works: Promptly works out what my folders are and asks only what it can't tell.

## 3. Acceptance criteria

### A. Connecting a folder (screens 1–2)
1. Settings › Projects › **Connect a folder…** (and "+ Connect a folder" in the mode menu) opens the system folder picker; the chosen folder starts the connect flow. The project's name defaults to the folder name and can be renamed.
2. **Local scan, no AI:** Promptly walks the folder (no symlinks followed outside it) and skips, without asking: `.git`, `node_modules`, `dist`, `build`, `vendor`, `venv`/`.venv`, any path in `.gitignore` or `.promptlyignore`, hidden files/folders, files over 2 MB, binary files (a NUL byte in the first 8 KB), images/audio/video/archives, and code files (by extension); a subtree with a code-root marker (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `*.xcodeproj`) is "Left out: code". Readable types in this feature: `.md`, `.markdown`, `.txt`, `.eml`, `.mbox`, plus `.docx`, `.rtf`, `.doc`, `.html` on macOS (converted with the built-in `textutil`). At most 5,000 readable files; past that the flow says how many were left out.
3. **Folder map:** one Claude call receives only a manifest (relative path, size, modified date, the first 300 characters of up to 3 files per folder; at most 40 KB in total) and returns JSON: each top-level folder (and top-level files as "Overview") gets a kind — `overview`, `conversations`, `agreements`, `build` ("How it's built"), `reference`, `exclude` — or `unsure` with a one-line question. Invalid JSON → one retry, then every folder is shown as `reference` with a note "Promptly couldn't sort these; check them". If the call fails (Claude Code signed out, usage limit, offline, timeout), the same fallback map is shown with the error's usual wording above it (e.g. "Claude Code is signed out. Sign in from Settings") and **Write the summary** stays disabled until a retry succeeds.
4. The map screen shows per folder: name, kind (as plain words), file count, newest date, what it's used for, and an on/off switch; `exclude` rows are off by default; `unsure` rows show the question with 3 one-tap answers. The person can change any kind or switch.
5. **Two questions** on the same screen: role (Manager, Developer, Designer, Sales, Other) and what they mostly write (multi-select: Client emails, Prompts for the team, Status updates, Something else). The answers set the project's default output (§D) and which kinds each output reads (§E).
6. Before building, the button reads "Write the summary (about N Claude calls)", N = map batches + 1, so the person knows it uses their plan. **Write the summary** builds the project summary (§B) with visible progress ("Reading comms… 40 of 96"), cancellable; then the summary preview screen shows it with Edit, and a "Keep the summary" choice: **In Promptly** (default) or **In the folder too** (writes `PROMPTLY.md` at the folder root, and keeps it in step on every refresh). **Save project** finishes; the project appears in the mode menu and Settings › Projects.

### B. The project summary
7. The summary is markdown with fixed sections: **The project** (what, phase, key dates), **People** (both sides, roles), **How they like to be written to**, **Agreed** (scope, decisions, money), **Open right now**, **Latest activity**, **Words** (names and terms). Target ≤ 1,500 words; hard cap 2,500 (longer answers are cut at a section boundary).
8. Every bullet carries its source: `[source: relative/path.md · 4 Oct]` (several files: `[source: comms · 31 emails]`). The preview shows sources as small labels, not raw markup.
9. Built map-reduce: each switched-on file → a short fact list (batched, several files per Claude call, ≤ 60 KB per call), then one merge call into the sections. Files are read newest first; for `conversations`, quoted replies are removed first (§F).
10. The person can edit the summary as text. Edited or added lines are **pinned** (stored with a pin id) and are never rewritten or removed by Refresh or Rebuild; a pinned line shows "Edited by you · kept on refresh".
11. **Refresh** (button; also offered from the "N new files" hint) sends only new/changed files since the last summary plus the current summary, and asks for a JSON diff (`add` / `change` / `retire` with reason and source per item); Promptly applies it to the unpinned lines; **Latest activity** is rewritten from the last 14 days of `conversations` on every refresh, never accumulated. Removed files retire their sourced lines.
12. **Rebuild summary** re-runs §9 over everything, keeping pinned lines. Settings shows when the summary was last updated and from how many files.

### C. Freshness
13. While Promptly runs, each project folder is watched (`fs.watch` recursive); any event marks the project dirty; after 2 s of quiet Promptly rescans size/mtime, re-extracts changed files, and updates the search index. The same rescan runs at app start and when the window gains focus (at most once a minute per project).
14. New or changed files are searchable for prompts within seconds, **before** any Refresh (§E uses the index, not only the summary).
15. Settings › Projects and the mode's idle hint show "N new files since your last refresh" when N > 0.

### D. Project modes
16. Each saved project is a mode in the mode menu's **Craft a prompt** tab, in a **Projects** group above "Prompt style", with its own colour dot; "+ Connect a folder" closes the group. Selecting it sets the header pill to the project's name; idle text: "Double-tap Control and say what you need for <Project>".
17. **Write as**: Email, Prompt or Polish. Picked per request: a phrase rule chooses Email for "reply to", "email", "write to", "respond to", "draft a mail", Prompt for "prompt", "brief for", "task for", "ask claude/the team to", otherwise the project's default (from §A5: Client emails → Email; Prompts for the team → Prompt; Status updates → Polish; first selected in that order wins; only "Something else" or nothing selected → Prompt). The result header shows "Write as [Email ▾]"; changing it re-runs the request with the other output.
18. The output uses the existing Email / Prompt / Polish prompts and result screens unchanged, with the project context added (§E). Email keeps its subject + body screen; Prompt keeps "For: Claude ▾" and the score; Polish keeps tone.
19. History entries from a project mode are tagged with the project name and its colour.

### E. Context for each request
20. Promptly assembles, in this order, inside a `<project>` block placed **before** the request:
    1. the summary;
    2. for Email, the newest `conversations` thread involving anyone named in the request (by name or address), latest message in full, older ones de-quoted, ≤ 12 KB;
    3. the best matches for the request from the search index (FTS5 BM25 over the kinds that output reads — Email/Polish: overview, conversations, agreements, reference; Prompt: overview, build, reference, agreements), newest first on near-ties, each excerpt labelled with path and date, deduplicated, up to ~30 KB in total.
    The prompt then tells the AI to use only facts in the project material for names, dates, numbers and commitments, never to invent them, and to say briefly when something asked for isn't in the material rather than guess. It must not copy `[source: …]` labels into the output (an email to a client must read like a normal email); the sources are shown to the person in **Based on** (§21) instead.
21. Under the result, **Based on** lists the summary plus each file used (path · date), each with × "Leave this file out and redo". Re-running with exclusions keeps them for that request only.
22. This works the same with Claude Code and with the user's own API key (it is all one prompt on stdin / one chat request).

### F. Email files
23. `.eml` is parsed without dependencies: headers (From, To, Date, Subject, Message-ID, In-Reply-To, References, RFC 2047 encoded words), MIME multipart, base64 and quoted-printable, charsets via `TextDecoder`, text/plain preferred over text/html (HTML stripped to text). `.mbox` is split on `From ` lines.
24. Quoted replies are removed from all but the newest message of a thread: lines starting `>`, "On … wrote:" blocks, "-----Original Message-----", Outlook "From: / Sent:" header blocks, and signatures after "-- ". Threads group by Message-ID/In-Reply-To/References, else by normalised subject.
25. Exported emails saved as `.md`/`.txt` with `From:`/`Date:`/`Subject:` lines at the top are treated as email too.

### G. Dictation suggestion (screen 6)
26. After a dictation, if the text names the project, or a person or term from its summary's **People**/**Words** sections (whole-word, case-insensitive, at least one match of ≥ 4 letters), the result's actions show **As an <Project> email** (or prompt, per §17's rule) next to "As a prompt". It runs the request in that project mode. If several projects match, the one with the most distinct matches wins; a tie goes to the most recently used project. No AI call is made to decide this; Dictation itself is unchanged and never uses project context.

### H. Look deeper (Claude Code only)
27. In a project mode on Claude Code, after §E's context, Claude may open more files: Promptly runs it read-only over the project's **text cache** (the extracted, switched-on files only) with `--tools Read,Grep,Glob`, `--strict-mcp-config` (no connected tools such as Gmail or Slack), `--max-turns 12`, `cwd` = the cache folder. Files it opened are added to **Based on**.
28. Setting per project: **Look deeper: On (default) / Off**. Off, or on an API key, the request uses §E only. A run that hits max turns returns whatever was written; a failed look-deeper run retries once without it.

### I. Settings › Projects (screen 3)
29. A **Projects** tab (between Prompts and You) lists projects: name, folder, "Up to date · date" or "N new files since your last refresh", **Refresh**; expanded: Summary (updated date, file count, pinned count, Open and edit), Folders it reads (Change → the map screen), Usually writes, Look deeper, **Rebuild summary**, **Remove project** (asks; removes Promptly's copy, index and cache; never touches the folder; removes `PROMPTLY.md` only if Promptly wrote it and the person ticks "also delete PROMPTLY.md").
30. A project whose folder is gone (moved/deleted/unmounted) shows "Folder not found · Locate…" and its mode says so instead of running.

## 4. Scope
**In:** everything in §3.
**Deferred:** PDF text (needs PDFKit in the Swift helper / Rust on Windows); `.docx` on Windows; Outlook `.msg`; automatic project choice from the app in front or the email recipient (phase 2; §G covers the spoken case); semantic (embedding) search; sharing or syncing projects between people (each person points at their own folder; a shared Drive/git folder works as is); Harness and the builders in project modes; the "spoken vs prompt" comparison idea (separate feature, awaiting the owner).

## 5. Integration points
- `main/llm.js` — stays the only place AI is called (ARCHITECTURE rule 1). `createClaudeRunner.run` gains `{ cwd, tools, maxTurns }` for §H; LEAN_FLAGS keep `--strict-mcp-config`; `--tools ''` is replaced only when `tools` is passed.
- New `main/projects/` modules (no Electron imports, unit-tested): `store.js`, `scan.js`, `extract.js`, `email.js`, `search.js` (node:sqlite FTS5), `watch.js`, `summary.js`, `context.js`, `suggest.js`.
- `main/platform/darwin.js` / `win32.js` — `extractTextCommand(ext)` seam (`textutil -convert txt -stdout` on macOS; none on Windows in this feature).
- `main/prompts.js` + new `main/prompts/project-classify.txt`, `project-facts.txt`, `project-merge.txt`, `project-refresh.txt`, `project-context.txt`; `buildContextBlock` gains the `<project>` part.
- `shared/modes.json` — one `project` kind definition (label pattern, outputs, tone default); projects themselves are user data, not modes.json entries.
- `main.js` — IPC handlers, watcher lifecycle, `runGeneratePrompt` project branch.
- `preload.js` + `tests/ipc-contract.test.js`.
- Renderer: `ModeDropdown.jsx`, `ExpandedTransportBar.jsx`, `useMode.js`/`utils/modes.js` (project keys), `SettingsPanel.jsx` (+ `ProjectsSection.jsx`), new `ProjectConnect.jsx` (map + questions), `ProjectSummaryEditor.jsx`, `ProjectSources.jsx`, `useProjects.js`; result screens get the Write-as control and Based-on row; `useDictation.js` gets the suggestion.

## 6. Data model
**config.json** (via `main/config.js`):
`projects: [{ id, name, dir, color, role, writes: [..], defaultOutput: 'email'|'prompt'|'polish', folders: { "<rel>": { kind, on } }, lookDeeper: true, keepInFolder: false, wrotePromptlyMd: false, summaryUpdatedAt, summaryFileCount }]`

**userData/projects/<id>/** (never inside the user's folder, except optional `PROMPTLY.md`):
- `summary.md` — the summary; `pins.json` — pinned line ids and text
- `manifest.json` — `{ rel: { size, mtimeMs, sha1, kind, extractedAt, inSummary } }`
- `text/` — extracted plain text mirroring relative paths (the §H cache)
- `search.db` — node:sqlite FTS5 table `chunks(path, date, kind, sender, title, body)`, chunks ~2,000 characters with a "title · date · sender" header prepended
History entries gain optional `project: { id, name, color }`.

## 7. IPC (all via preload)
- `projects-list` → `[{ id, name, dir, color, newFiles, summaryUpdatedAt, missing }]`
- `project-pick-folder` → `{ dir } | { cancelled }` (dialog in main; the renderer never sends a path for reading)
- `project-scan` (dir) → `{ token, folders: [...], skipped, tooMany }` (token ties later calls to the folder main picked)
- `project-classify` (token) → `{ folders: [{ rel, kind, question? }] }`
- `project-save` ({ token, name, role, writes, folders, keepInFolder }) → `{ id }` and starts the summary build
- `project-summary-progress` (event) → `{ id, done, total, stage }`
- `project-summary-get` (id) / `project-summary-set` (id, text) → `{ text, pins, updatedAt }`
- `project-refresh` (id) / `project-rebuild` (id) → `{ ok, error? }`
- `project-update` (id, patch) / `project-remove` (id, { deletePromptlyMd })
- `project-suggest` (text) → `{ id, name, output } | null`
- `generate-prompt` options gain `project: { id, output, exclude: [rel] }`; its result gains `sources: [{ rel, date }]`.

## 8. Edge cases
- Empty or unreadable folder → "Nothing Promptly can read here" with what was skipped and why.
- Folder on a network drive (watch unreliable) → rescans on focus/Refresh only; a note in Settings.
- Huge folder → 5,000-file cap, newest first; summary build caps at 400 files (newest first per kind) and says so.
- Non-UTF-8 text → decoded with the declared charset, else latin1 fallback; never crashes the scan.
- Two projects on the same folder → refused ("Already connected as …").
- File renamed → treated as removed + added; its summary lines move with the new source.
- Summary call fails mid-build → the files done so far are kept; Retry resumes.
- The person edits `PROMPTLY.md` by hand → read back on the next refresh as pinned lines (keepInFolder only).
- API-key users → everything except §H; classify/summary use the provider's main model.
- Cancel (Escape) during a project request → cancels like any Craft request.

## 9. Non-functional
- Nothing leaves the Mac until a Claude call; the classify call sends names and short snippets only, and the screen says so. Calls go to the user's own account.
- No runtime npm dependencies (node:sqlite is built into Electron 41's Node 24.18; verified FTS5 + bm25 in the app's runtime on 2026-10-06).
- Prompt assembly + search < 300 ms for 5,000 files. A project request takes about as long as today's Craft request plus up to ~25 s with Look deeper.
- Never write into the user's folder except `PROMPTLY.md` when chosen. Paths always stay inside the connected folder (reuse `safeRelativePath` rules).
- Claude Code calls keep the user's settings (effort level), per the 2.22.1 lesson; never `--restricted` without explicit `--effort`.

## 10. Conformance checklist
- [ ] Connect → map → questions → summary → save works on the owner's Infer360 layout and on a differently structured fixture folder
- [ ] Code, archive, hidden and ignored files are never extracted or sent
- [ ] Summary has the fixed sections, sources on every bullet, pinned edits survive Refresh and Rebuild
- [ ] A new file is used by the next request without a Refresh; the "N new files" hint appears; Refresh clears it
- [ ] Project modes in the mode menu; Write as picks Email/Prompt/Polish by phrase and can be changed
- [ ] Based on lists real files; × redo excludes them
- [ ] Dictation output is byte-identical with and without projects; the suggestion appears only on a name/term match
- [ ] Look deeper runs read-only with no MCP tools, only over the text cache
- [ ] Works on an API key (without Look deeper)
- [ ] Remove project leaves the folder untouched
- [ ] Unit tests, IPC contract, lint, e2e (fixture folder + fake Claude), UI audit both themes

## 11. Research basis (2026-10-06)
- No dictation app attaches documents (Wispr Flow, Superwhisper, VoiceInk, Aqua, MacWhisper, Willow, Monologue: screen context only). Claude Projects stuffs knowledge until it nears the limit, then switches to search; Lovable keeps an always-loaded knowledge file; Claude Code loads CLAUDE.md up front and greps just in time; Cursor dropped embeddings for grep (Jul 2026). Anthropic: under ~200k tokens, include material directly; put documents first and the request last; long contexts lose facts in the middle.
- Local test: Claude Code, read-only, on a sample client folder: 14 s, 6–7 turns, a correct reply using dates and names not in the request. `--tools` alone left the user's MCP tools (Gmail send/delete) loaded; `--strict-mcp-config` removes them.
- Summary drift controls (typed sections, sources, diff updates, pinned edits, periodic rebuild) follow memory research (Letta memory blocks, Anthropic memory tool, HaluMem findings).
