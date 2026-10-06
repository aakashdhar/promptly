# INTERFACES — Project modes (build contract for parallel tasks)
> Every module below is CommonJS, `'use strict'`, no Electron imports, unit-tested in its own `tests/projects-<name>.test.js` (email.js + extract.js: `projects-email`; llm.js tool runs: `projects-llm`).
> Agents build TO these signatures; integration (PRJ-009) wires them in main.js. Change a signature only by updating this file in the same commit.

## Shared shapes
```js
// A project record (config.json `projects[]`)
Project = { id /* 8 lowercase hex */, name /* cleaned, ≤ 80 chars */, dir /* realpath */, color, role: Role, writes: Write[],
            defaultOutput: 'email'|'prompt'|'polish', folders: { [rel]: { kind: Kind, on: boolean } }, lookDeeper: boolean, keepInFolder: boolean,
            wrotePromptlyMd: boolean, summaryUpdatedAt: number|null, summaryFileCount: number, lastUsedAt: number|null }
Role  = 'manager'|'developer'|'designer'|'sales'|'other'
Write = 'client-emails'|'team-prompts'|'status-updates'|'other'
Kind  = 'overview'|'conversations'|'agreements'|'build'|'reference'|'exclude'|'unsure'
// rel: POSIX path relative to the project folder. A file's rel is never ''; in folder lists ('folders') '' = the top-level files.
FileEntry = { rel, size, mtimeMs, ext /* lowercase, with the dot */, top }   // top = first path segment ('' for root files)
Manifest  = { [rel]: { size, mtimeMs, sha1, kind, extractedAt, inSummary } }  // diffManifest adds new ones as kind: null, extractedAt: null, inSummary: false
Doc       = { rel, kind, date /* ISO yyyy-mm-dd */, sender, title, text, sha1? /* manifest sha1, the facts-cache key */ }   // extracted text ready for summary/search
Source    = { rel, date }   // date: ISO from search/threads, 'D Mon YYYY' from sourcesOf, '' when unknown
Run       = (prompt, opts) => Promise<{ success, prompt?: string, error?, errorType?, cancelled?, timedOut?, provider? }>  // a main/llm.js router run
// errorType: 'auth'|'timeout'|'cancelled'|'empty'|'max-turns'|'unknown' from Claude Code; an API-key run adds 'offline'|'rate'|'no-key'
```

## main/projects/store.js — PRJ-001
```js
createProjectStore({ config /* main/config.js store */, dataDir /* userData/projects */, appDataDir? /* userData; guarded like dataDir */, fsImpl = fs, randomId }) → {
  list(): Project[]                // only records with an 8-hex id and a non-empty string dir; the next save drops the rest
  get(id): Project|null, findByDir(dir, exceptId?): Project|null   // realpath-compared (letter case too); exceptId is skipped
  create(fields): Project          // fields: dir + optional name, role ('other'), writes ([]), folders ({}), lookDeeper (true), keepInFolder (false); colour = first unused
  relocate(id, dir): Project       // "Locate…": same id, summary and index on a new dir; the only way dir changes
  update(id, patch): Project       // id/dir never change, invalid fields ignored; writes without defaultOutput moves defaultOutput with it
  remove(id): void                 // deletes only dataDir/<id> (first), then the record
  paths(id): { root, summary /* summary.md */, pins /* pins.json */, manifest /* manifest.json */, text /* text/ */, db /* search.db */ }   // throws 'Invalid project id'
}
// create/relocate check in order and throw: 'Choose a folder' (dir not a non-empty string, or fields not an object) | 'Folder not found'
//   | "Choose a project folder, not one that holds Promptly's own files" (dir is, holds or sits inside dataDir/appDataDir) | 'Already connected as <name>'
// relocate/update also throw 'Project not found'. folders keys that could leave the folder are dropped; `on` defaults to kind !== 'exclude'.
PROJECT_COLORS: string[]  // 8 hex colours distinct from the mode colours in shared/modes.json
ROLES, WRITES, KINDS: string[]   // the Role, Write and Kind values above
defaultOutputFor(writes): 'email'|'prompt'|'polish'   // spec §17 precedence: client-emails → email, team-prompts → prompt, status-updates → polish, else prompt
nameForFolder(dir, pathImpl = path): string   // default name: the folder name, cleaned (control chars/whitespace runs → one space, ≤ 80 chars); drive root 'E:\' → 'Drive E'
```

## main/projects/scan.js — PRJ-002
```js
scanFolder(dir, { maxFiles = 5000, maxEntries = 200000 /* both: Infinity = no cap; negative/non-number → the default */, signal /* AbortSignal */,
                  platform = process.platform, fsImpl = fs /* promises.{readdir,realpath,lstat,readFile,open} required (else TypeError); realpath(p, cb) optional, else fs.realpath */ }) → Promise<{
  files: FileEntry[] /* readable only, newest first, ≤ maxFiles */,
  folders: [{ rel /* top-level folder (none for one skipped whole, e.g. node_modules); '' = top-level files, only when it has some */, count, newestMs, codeRoot: boolean /* is one, or holds nothing readable but code roots */, skippedCount /* a code root counts 1 */ }],
  skipped: { [reason]: count }  /* reasons: ignored, hidden (. or ~$), builtin, too-big (> 2 MB), binary, media, unsupported, code, code-root, symlink, empty, unreadable, truncated */,
  tooMany: number /* readable files past maxFiles */,
  unchecked: rel[] /* what it couldn't look at, for diffManifest's keep: read errors, a folder behind an unreadable ignore file, a folder resolving outside dir,
                      and at maxEntries each entry never reached (its folder instead, past 1,000 in one folder); [''] alone = everything (signal stop, root unreadable or cut short) */,
  warnings: [{ rel /* the ignore file */, reason: 'ignore file links outside the folder' | 'ignore file link is broken' | "ignore file can't be read" }]  /* its rules weren't applied */ }>
// never throws on stop (maxEntries or signal: skipped.truncated counts entries never reached, a folder never opened once); TypeError for an empty dir or a missing fsImpl method
// realpath: native first, Node's JS realpath when it fails (libuv fails on Windows volumes without a drive letter); a path is compared only with the root resolved the same way
// win32: a listing's link (libuv: any reparse point, e.g. OneDrive online-only files) is confirmed with lstat
// code-root (counted once per folder, never walked): a subfolder holding package.json, Cargo.toml, go.mod, pyproject.toml, setup.py, Pipfile, pom.xml,
//   build.gradle, Gemfile, composer.json or a *.xcodeproj; the connected folder itself never is (its code files are skipped by type)
// ignore files: every .gitignore, then the root .promptlyignore last; on darwin/win32 found in any letter case (the exact name first).
//   A symlinked one is read only when its real path is a file inside dir; outside, dangling or not a file → not applied + warning.
//   One that exists but can't be read (or a link loop) → warning, and that folder is unchecked, not walked (root one → files [], skipped { unreadable: 1 }, unchecked [''])
// matching (darwin/win32 fold case): every rule matches as git does (ASCII letters only; set members and escaped letters as written: "[A]", "\A" match nothing);
//   a rule that ignores also matches the pattern and path composed and lowercased per character (never changing UTF-8 length); a "!" rule only as git does,
//   so a path git ignores is always ignored. linux: exact bytes, plus composed (NFC) for ignoring rules.
readableExtensions(platform) → Set<string>   // .md .markdown .txt .eml .mbox .html .htm everywhere; + .docx .rtf .doc on darwin (textutil)
// a UTF-16 BOM counts as text only for .md .markdown .txt .html .htm; UTF-16 .eml/.mbox/.rtf and UTF-32 are 'binary'
hashFile(abs) → Promise<sha1 hex>   // opens with O_NOFOLLOW, so rejects a symlink (where the platform has the flag; not Windows)
diffManifest(prev: Manifest, files: FileEntry[], { dir /* required: the scanned folder */, hashFile = hashFile /* (path.join(dir, rel), entry) */, keep /* rel[], usually scan.unchecked; null = none */ })
  → Promise<{ added: rel[], changed: rel[], removed: rel[], next: Manifest, failed: rel[] }>
// same size + mtime → kept unhashed. failed: couldn't hash (previous entry kept, a new one waits) | under a kept path ('' = all: previous entry carried
//   into next instead of removed) | a rel not spelled as a scan writes it or leaving dir ('./a.md', 'a.md/', 'a//b.md', '..', absolute, '\' on Windows: never hashed or kept)
// TypeError for a missing dir, a non-function hashFile or a non-array keep
```

## main/projects/email.js + extract.js — PRJ-003
```js
// email.js
parseEml(input /* Buffer|string */) → { from, fromAddress /* lowercased address or '' */, to, cc, date /* ISO or '' */, time /* ms or 0 */,
                                        subject, messageId, inReplyTo, references: string[], text }
splitMbox(text) → string[]
emailFromText(text) → parsed|null   // same shape; .md/.txt whose top lines are From: plus Date:/Sent:/Subject: (plain, **bold** or YAML front matter; an optional # heading = subject)
stripQuoted(text) → string
threadMessages(msgs) → [{ key, subject, messages /* oldest → newest */ }]   // threads newest activity first
renderThread(thread, { maxBytes = 12000 /* Infinity ok */, keepQuotes = false } = {}) → string   // newest message in full, older ones de-quoted (or in full with keepQuotes), newest last; oldest go first to fit
isForward(msg) → boolean, dequote(msg) → string   // a message's own words; a forward keeps everything
decodeBytes(buf, charset) → string, htmlToText(html) → string, isoDate(value) → ISO|'', normalizeSubject(subject) → string   // Re:/Fwd:/AW:/[tag] prefixes off
// extract.js
extractDoc(abs, rel, { kind, platform = require('../platform'), execFileImpl = execFile }) → Promise<Doc|null>   // null = not readable / empty; never throws
//   Doc.kind = kind || 'reference'; quotes come off only for kind 'conversations' (.eml, mail in .md/.txt, older .mbox messages)
//   date: mail date, else a YYYY-MM-DD in the file name, else the file's local mtime day; title: subject, # heading or <title>, else the file name
writeExtracted(textDir, rel, text) → void   // mirrors rel under textDir as <rel>.txt, never escapes textDir (throws)
// platform seam (darwin.js + win32.js, same export on both): extractTextCommand(ext, file) → [cmd, string[]] | null
//   darwin: .docx .rtf .doc → ['/usr/bin/textutil', ['-convert', 'txt', '-stdout', file]]; win32: always null
```

## main/projects/search.js — PRJ-004
```js
openIndex(dbPath, { onReset } = {}) → { available /* getter */, fresh: boolean, movedAside: string|null, upsert(doc: Doc), remove(rel),
                                        search(text, { kinds, limit = 20 }) → [{ rel, date, kind, title, excerpt, score }], close() }
// available === false (every method a no-op, search → []) when node:sqlite can't load or the file can't be opened; turns false after a reset that couldn't make a new file
// fresh: the index started empty this open (new file, older layout emptied, broken file set aside) → upsert every file again
// movedAside: where a broken search.db went (search.db.corrupt-<ms>; only the newest copy is kept), for the log
// onReset({ available, movedAside }): damage (CORRUPT/NOTADB) found in upsert/remove/search → file set aside, fresh index, the op retried once;
//   the caller upserts every file again, or treats the index as gone when !available
// upsert replaces that rel's chunks; upsert/remove throw on other SQLite errors; search never throws
// search: one hit per file (its best chunk), BM25 then newer first among hits within 10%; kinds: list, Set, one string, or null/[] = all; excerpt starts 'title · date · sender'
// layout: schema version 2 (PRAGMA user_version): contentless FTS5 `chunks` (needs SQLite ≥ 3.43) + `chunk_files` + `chunk_text`
chunkText(text, size = 2000) → string[]
queryTerms(text) → string[]   // ≤ 24 terms; stop words and fillers dropped, names kept (will/can/an/do/so/my only when capitalised mid-sentence or possessive); CJK as two-character pairs
```
Tests that need node:sqlite use `it.skipIf(!hasSqlite)`; `npm run test:sqlite` runs them under Electron's Node 24.

## main/projects/watch.js — PRJ-005
```js
createFolderWatcher({ dir, onChange, onError /* ({ code, message }) */, debounceMs = 2000, maxWaitMs = 30000 /* Infinity = no cap */, watchImpl = fs.watch,
                      timers = { setTimeout, clearTimeout }, now = () => performance.now() /* monotonic ms */ })
  → { start(), stop(), poke(), failed /* getter */, error /* getter: frozen { code: string|null, message } | null */ }
// any fs event or poke() → onChange() once after debounceMs of quiet, or at most maxWaitMs after the burst's first change; changes while onChange runs → one more after it settles
// events under the 12 built-in dirs scan.js skips are ignored; a null filename counts
// watch errors (start throws or 'error' event) → failed/error set, onError called once, stays usable via poke(); a successful start() clears them
// stop() is final (start() after it does nothing); onChange must always settle
isIgnored(filename) → boolean
IGNORED_DIRS: Set<string>   // mirrors scan.js BUILTIN_DIRS: .git node_modules dist build vendor venv .venv __pycache__ .next .cache target coverage
```

## main/projects/classify.js — PRJ-006
```js
buildManifestText(scan, { readSnippet /* (rel) => Promise<string> */ = async () => '', maxBytes = 40000 /* clamped to [0, 40000]; non-finite → 40000 */ }) → Promise<string>
// per folder a name line (count, newest, skipped), then ≤ 3 newest files with 300-char snippets; code roots and empty folders send the name line only
// over the cap: snippets go first, then sample lines (largest folders first), then whole folders from the end at a line boundary
parseClassify(raw, rels?) → [{ rel, kind, question? }]   // throws on unusable output
// with rels: one entry per rel (exact name, else the single loose match on end spaces / trailing slash / case), missing ones → 'reference'
// without rels: plain top-level names only (none containing '/' or '\', nor '.' or '..'); unknown kind → 'reference'; 'unsure' without a question → 'reference'
classifyFolders({ run, scan, readSnippet }) → Promise<{ folders: [{ rel, kind, question?, on }], error?: { message, errorType } } | { cancelled: true }>
// '' (top-level files) → overview, on; code roots → exclude, off; neither is sent for a verdict (no call when nothing else is left); on = kind !== 'exclude'
// the whole prompt ≤ 40 KB; at most 100 folders asked (MAX_ASKED): the rest → reference, on, no error
// run(prompt, { timeoutMs: 60000, slowWarningMs: 0, thinking: false }); one retry on bad JSON, then every asked folder → { kind: 'reference', on: true } plus
//   error { message: "Promptly couldn't sort these; check them", errorType: 'parse' }; a failed run → the same with { message: error || 'Claude CLI error', errorType: errorType || 'unknown' }
```
Prompt text: `main/prompts/project-classify.txt` ({MANIFEST}, {FOLDERS}; loaded with `loadPrompt`/`fillTemplate` from main/prompts.js).

## main/projects/summary.js — PRJ-007
```js
SECTIONS = ['The project','People','How they like to be written to','Agreed','Open right now','Latest activity','Words']
estimateCalls(docs) → number   // facts batches + 1 merge; 0 without usable docs
buildSummary({ run, docs: Doc[], onProgress, signal, factsCache?: Map, today? /* 'yyyy-mm-dd' */, pins?: Pin[] })
  → Promise<{ text, overCap: boolean, fileCount, leftOut: number, leftOutFiles: rel[] } | { cancelled: true }>
// map batches ≤ 60 KB and ≤ 15 files, newest first; a file an answer skipped gets one call of its own; merge to ≤ 2,500 words (in groups past 150 KB)
// a file counts as answered when a heading or line names it ('## path', '## 1. path', '## File: path', a heading mentioning only that file of the call)
//   or a fact line is tagged with it; a lone file's answer naming nothing counts only as "- nothing useful" (a refusal is never stored as facts)
// at most 400 files, kinds taking turns past that (leftOut*); PROMPTLY.md is never read back
// factsCache key `${rel}@${sha1}` (Doc.sha1), else `${rel}@${date}`: Retry reuses the Map, Rebuild passes a new one
// throws Error{ message, errorType, done, total, files?: rel[] } (files: whose facts Claude never gave, errorType 'parse')
// overCap: pinned lines alone pass 2,500 words (every unpinned line is cut)
refreshSummary({ run, summary, pins, docs /* new or changed */, removed: rel[], renamed?: { old: new }|Map, recent: Doc[] /* last 14 days of conversations */,
                 present? /* switched-on rels: array|Set|Map|manifest object */, writtenOn? /* day Promptly last wrote summary.md: ISO day|ms|Date */,
                 today?, signal?, onProgress?, factsCache? }) → Promise<{ text, overCap, fileCount, leftOut, leftOutFiles } | { cancelled: true }>   // throws as buildSummary
// fileCount differs from buildSummary's: here it counts only the new/changed files read this refresh (≤ 400), not the files the summary rests on;
//   PRJ-009 sets summaryFileCount from buildSummary's fileCount, then from its manifest (entries marked inSummary) after a refresh
// one JSON diff call, one retry on unreadable JSON (then errorType 'parse'); no docs and no recent → no call
// present: cited files missing from it count as removed, folder counts are capped (an empty list beside a summary that cites files = not given)
// a folder-count tag ('comms · 3 emails') loses one for every file removed from its folder (which files it counted isn't stored), and its line
//   retires at 0 even when the refresh makes no call; it is never kept on a count it may have lost (owner call: keep this or store per-line files)
applyDiff(summaryText, diff /* {add:[{section,text,source}], change:[{id|match,text,source?}], retire:[{id|match}|string], latest:[{text,source}]} */, pins,
          { removed?, docs?, today?, present?, writtenOn? }?) → string
// never touches a pinned line; add never writes to Latest activity; latest replaces it (pins aside), without it only lines on this run's files stay
// without docs only files the summary already cites can be cited, so PRJ-009 calls refreshSummary
parseSections(text) → { [section]: string[] /* bullets */ }, renderSections(sections, pins?) → string
// headings: the seven names (or a name then more words), numbered ('1.', '2)', 'IV.', '1 -', 'Section 1:'), or an alias ('Open questions', 'Glossary');
//   'Recent', 'Latest' and 'Project' only qualify the noun after them when it names a section ('Recent decisions' → Agreed, 'Project contacts' → People)
pinsFromEdit(before, after, { today }?) → Pin[]    Pin = { id, section, text, kind: 'keep'|'drop', at?: 'yyyy-mm-dd' /* day the person wrote it */ }
mergePins(existing, fresh) → Pin[]   // the newest word on a line wins
sourcesOf(summaryText) → Source[]    // { rel, date: 'D Mon YYYY' }, or a folder tag { rel /* top folder */, date: '', count, noun: 'emails'|'files' }
writePromptlyMd({ project, text, fsImpl? }) → boolean   // only when project.keepInFolder: dir/PROMPTLY.md via a random-named 'wx' temp file + rename, never through a symlink
readPromptlyMd({ project, stored /* summary Promptly last wrote */, pins, today?, fsImpl? }) → Pin[]   // the person's edits merged into pins; O_NOFOLLOW | O_NONBLOCK (a FIFO never blocks), regular file ≤ 1 MB; missing or no sections → pins as given
// stored tags: '[source: <rel> · <D Mon YYYY>]' (year always, unlike spec AC 8's '· 4 Oct'; the preview may shorten this year's dates) or '[source: <top> · N emails|files]'
// reading tags (sourcesOf, and every step): a tag ends where its brackets balance, or at a later close right after a date or count that closes more than
//   the groups opened after the balanced one ('[source: comms/RE] [EXT] Fee.eml · 8 Oct 2026]'); a run also takes the furthest close naming only files it knows
//   (a later close only when a known path holds that bracket, else the first close).
//   ';' splits a tag only after a piece ending in a date or count, or (in a run) where every piece is a file the run knows, longest reading first:
//   '[source: comms/RE; Invoice.eml · 1 Oct 2026]' is one file, and a date never runs past a ';' (in a run '[source: b.md · 2 Oct; a.md]' is two files).
//   Without a run (sourcesOf) an undated '[source: a.md; b.md]' is one path
//   cost: linear in the text. A run's lookups cost the same however many files it knows, and a line's lookups read it at most 4 times over; past that the
//   rest of the line is read by dates and brackets alone (a 1 MB PROMPTLY.md refreshes in well under 300 ms)
// onProgress({ done, total, stage: 'reading'|'merging', current }) before each call, plus a final done === total on success
// run(prompt, { timeoutMs: 120000, slowWarningMs: 0 })
```
Prompts: `project-facts.txt` ({DOCUMENTS}), `project-merge.txt` ({TODAY} {FROM} {WORDS} {FACTS} {KEPT} {DELETED}), `project-refresh.txt` ({TODAY} {FROM} {SUMMARY} {KEPT} {DELETED} {REMOVED} {NEW} {RECENT}).

## main/projects/context.js — PRJ-008
```js
pickOutput(transcript, defaultOutput) → 'email'|'prompt'|'polish'      // spec §17 phrases, whole words, the phrase said first wins; else defaultOutput, else 'prompt'
assembleContext({ name = '', summary, transcript, output, search /* (text, { kinds, limit: 20 }) => hits, synchronous */,
                  thread /* (transcript) => { rel, date, text, sources?: Array<Source|rel> } | null, synchronous, asked for output 'email' only */,
                  exclude = [], budgetBytes = 30000 /* <document> elements only */ } = {}) → { block /* '<project name="…">…</project>' */, sources: Source[] }
// order: <summary> (≤ 12 KB; lines citing an excluded file dropped), <thread path date> (≤ 12 KB, newest end kept; dropped whole if any of its files is excluded),
//   one <document path date> per file (its excerpts joined; a hit past the budget is skipped, not cut), then project-context.txt
// sources: the thread's files first, then each document; a lookup that throws or returns a promise counts as no result; output not one of the three → 'prompt'
KINDS_FOR = { email: ['overview','conversations','agreements','reference'], prompt: ['overview','build','reference','agreements'], polish: ['overview','conversations','agreements','reference'] }   // frozen
```
Grounding instructions: `main/prompts/project-context.txt`.

## main/projects/suggest.js — PRJ-014
```js
suggestProject(text, projects /* [{ id, name, people: string[], words: string[], lastUsedAt, defaultOutput }] */, { pickOutput }? /* context.pickOutput, passed by main.js */)
  → { id, name, output }|null
// whole-word matches: the name 2, each person (full name, or a first name of ≥ 4 letters) and each Word 1; a name under 4 letters only adds to a match;
// highest score wins, ties → most recently used; reads the first 50,000 characters; output = pickOutput(text, defaultOutput), else defaultOutput, else 'prompt'
termsFromSummary(summaryText) → { people: string[], words: string[] }   // People/Words read with summary.js section rules; roles, labels, placeholders and nested notes dropped
```

## main/llm.js — PRJ-015
`createClaudeRunner().run(prompt, { timeoutMs = 45000, slowWarningMs = 30000, onDelta, thinking = true, cwd, tools, maxTurns, onTool })` → a Run result; never rejects.
- Without `tools` (undefined, null, false, `''` or `[]`) every argument is exactly as today (`--tools ''`).
- `tools` must be an array drawn only from `['Read','Grep','Glob']` (duplicates removed); anything else truthy → `{ success:false, errorType:'unknown', error:'Unsupported tool' }`, nothing spawned.
- `cwd`, when given, must be an existing folder Claude can enter (stat + R_OK|X_OK), and a tool run requires it; otherwise `{ success:false, errorType:'unknown', error:"The folder for Claude to look in is missing or can't be opened" }`, nothing spawned. Spawn `cwd` = `cwd`.
- A tool run needs the lean flags (a CLI known to reject them → "This version of Claude Code can't look through the files — update it"). `--tools` gets the list instead of `''`, `--no-session-persistence --strict-mcp-config --system-prompt …` stay, exactly one `--max-turns N` (N = `maxTurns` when an integer 1–50, else 12), stream-json always; the user's settings still load (no `--setting-sources`, never `--restricted`).
- `onTool({ name, input })`: once per tool call whose tool_result came back without `is_error: true`; `input` as given (Read's `file_path` is absolute; successful Glob/Grep calls are reported too).
- `onDelta('')` clears the shown text when a tool call starts; the last value is always the text written after the last tool call (a caller's throttle must pass `''` through).
- Out of turns → `{ success:false, errorType:'max-turns', error:'Claude opened too many files without answering — try again' }` (success with that text if any was written after the last tool call); the caller asks again without tools.
- A tool run retries once with the quick-start flags off, only when it failed before any tool succeeded and wasn't cancelled, timed out or out of turns; it never changes what the runner learns about flags.
- Through `createAiRouter`, an API-key run gets only `timeoutMs` and `onDelta`: `tools`, `cwd` and `onTool` are Claude Code only.

`createStreamParser(onDelta, onTool)` → `{ feed(chunk), flush(), text(), result() }` (same tool and reset rules). `parseJsonOutput(raw)` → parsed JSON (``` fences stripped; throws when there is none).
