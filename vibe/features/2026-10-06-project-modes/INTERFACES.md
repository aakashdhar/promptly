# INTERFACES — Project modes (build contract for parallel tasks)
> Every module below is CommonJS, `'use strict'`, no Electron imports, unit-tested in its own `tests/projects-<name>.test.js`.
> Agents build TO these signatures; integration (PRJ-009) wires them in main.js. Change a signature only by updating this file in the same commit.

## Shared shapes
```js
// A project record (config.json `projects[]`)
Project = { id, name, dir, color, role, writes: string[], defaultOutput: 'email'|'prompt'|'polish',
            folders: { [rel]: { kind: Kind, on: boolean } }, lookDeeper: boolean, keepInFolder: boolean,
            wrotePromptlyMd: boolean, summaryUpdatedAt: number|null, summaryFileCount: number, lastUsedAt: number|null }
Kind = 'overview'|'conversations'|'agreements'|'build'|'reference'|'exclude'|'unsure'
// rel: POSIX relative path inside the project folder ('' never; top-level files have top === '')
FileEntry = { rel, size, mtimeMs, ext, top }          // top = first path segment ('' for root files)
Manifest  = { [rel]: { size, mtimeMs, sha1, kind, extractedAt, inSummary } }
Doc       = { rel, kind, date /* ISO yyyy-mm-dd */, sender, title, text }   // extracted text ready for summary/search
Source    = { rel, date }
Run       = (prompt, opts) => Promise<{ success, prompt?: string, error?, errorType?, cancelled? }>  // a main/llm.js router run
```

## main/projects/store.js — PRJ-001
```js
createProjectStore({ config /* main/config.js store */, dataDir /* userData/projects */, fsImpl = fs, randomId }) → {
  list(): Project[], get(id): Project|null, findByDir(dir): Project|null,
  create(fields): Project        // throws Error('Already connected as <name>') for a duplicate dir (realpath-compared)
  update(id, patch): Project, remove(id): void   // deletes only dataDir/<id>
  paths(id): { root, summary /* summary.md */, pins /* pins.json */, manifest /* manifest.json */, text /* text/ */, db /* search.db */ }
}
PROJECT_COLORS: string[]  // 8 hex colours distinct from the mode colours in shared/modes.json
defaultOutputFor(writes): 'email'|'prompt'|'polish'   // spec §17 precedence
```

## main/projects/scan.js — PRJ-002
```js
scanFolder(dir, { maxFiles = 5000, platform = process.platform, fsImpl }) → Promise<{
  files: FileEntry[] /* readable only, newest first, ≤ maxFiles */,
  folders: [{ rel /* top-level name, '' = top-level files */, count, newestMs, codeRoot: boolean }],
  skipped: { [reason]: count }  /* reasons: ignored, hidden, too-big, binary, media, code, code-root, symlink-outside, unreadable */,
  tooMany: number }>
readableExtensions(platform) → Set<string>   // .md .markdown .txt .eml .mbox (+ .docx .rtf .doc .html .htm on darwin)
hashFile(abs) → Promise<sha1 hex>
diffManifest(prev: Manifest, files: FileEntry[], { hashFile }) → Promise<{ added: rel[], changed: rel[], removed: rel[], next: Manifest }>
```

## main/projects/email.js + extract.js — PRJ-003
```js
// email.js
parseEml(input /* Buffer|string */) → { from, to, cc, date /* ISO or '' */, subject, messageId, inReplyTo, references: string[], text }
splitMbox(text) → string[]
emailFromText(text) → parsed|null   // .md/.txt starting with From:/Date:/Subject: lines
stripQuoted(text) → string
threadMessages(msgs) → [{ key, subject, messages /* oldest → newest */ }]
renderThread(thread, { maxBytes = 12000 }) → string   // newest message in full, older ones de-quoted, newest last
// extract.js
extractDoc(abs, rel, { kind, platform, execFileImpl }) → Promise<Doc|null>   // null = not readable / empty
writeExtracted(textDir, rel, text) → void   // mirrors rel under textDir as <rel>.txt, never escapes textDir
// platform seam (darwin.js + win32.js, same export on both): extractTextCommand(ext) → [cmd, args(fileArg)] | null
```

## main/projects/search.js — PRJ-004
```js
openIndex(dbPath) → { available: boolean, upsert(doc: Doc), remove(rel), search(text, { kinds, limit = 20 }) → [{ rel, date, kind, title, excerpt, score }], close() }
// available === false (and every method a no-op returning []) when node:sqlite can't load
chunkText(text, size = 2000) → string[]
queryTerms(text) → string[]
```
Tests that need node:sqlite use `it.skipIf(!hasSqlite)`; `npm run test:sqlite` runs them under Electron's Node 24.

## main/projects/watch.js — PRJ-005
```js
createFolderWatcher({ dir, onChange, debounceMs = 2000, watchImpl = fs.watch, timers = { setTimeout, clearTimeout } }) → { start(), stop(), poke() }
// any fs event or poke() → onChange() once after debounceMs of quiet; watch errors → stays usable via poke()
```

## main/projects/classify.js — PRJ-006
```js
buildManifestText(scan, { readSnippet /* (rel) => Promise<string> */, maxBytes = 40000 }) → Promise<string>
parseClassify(raw) → [{ rel, kind, question? }]   // throws on unusable output
classifyFolders({ run, scan, readSnippet }) → Promise<{ folders: [{ rel, kind, question?, on }], error?: { message, errorType } }>
// one retry on bad JSON; on failure every folder → { kind: 'reference', on: true } plus `error`
```
Prompt text: `main/prompts/project-classify.txt` (loaded with `loadPrompt`/`fillTemplate` from main/prompts.js).

## main/projects/summary.js — PRJ-007
```js
SECTIONS = ['The project','People','How they like to be written to','Agreed','Open right now','Latest activity','Words']
estimateCalls(docs) → number
buildSummary({ run, docs: Doc[], onProgress, signal }) → Promise<{ text, fileCount }>       // map batches ≤ 60 KB, then merge
refreshSummary({ run, summary, pins, docs /* new/changed */, removed: rel[], recent: Doc[] /* last 14 days of conversations */ }) → Promise<{ text }>
applyDiff(summaryText, diff /* {add:[{section,text,source}], change:[{id|match,text,source}], retire:[{match,reason}]} */, pins) → string
parseSections(text) → { [section]: string[] /* bullets */ }, renderSections(sections) → string
pinsFromEdit(before, after) → Pin[]    Pin = { id, section, text }
sourcesOf(summaryText) → Source[]
```
Prompts: `project-facts.txt`, `project-merge.txt`, `project-refresh.txt`.

## main/projects/context.js — PRJ-008
```js
pickOutput(transcript, defaultOutput) → 'email'|'prompt'|'polish'      // spec §17 phrases
assembleContext({ summary, transcript, output, search /* (text,{kinds,limit}) => hits */, threads /* rel → rendered thread fn */, exclude = [], budgetBytes = 30000 }) → { block /* '<project>…</project>' */, sources: Source[] }
KINDS_FOR = { email: [...], prompt: [...], polish: [...] }
```
Grounding instructions: `main/prompts/project-context.txt`.

## main/projects/suggest.js — PRJ-014
```js
suggestProject(text, projects /* [{ id, name, people: string[], words: string[], lastUsedAt, defaultOutput }] */) → { id, name, output }|null
```

## main/llm.js — PRJ-015
`createClaudeRunner().run(prompt, { …existing, cwd, tools /* e.g. ['Read','Grep','Glob'] */, maxTurns, onTool /* ({ name, input }) */ })` —
without `tools` every argument is exactly as today. With `tools`: `--tools` gets the list instead of `''`, `--strict-mcp-config` stays,
`--max-turns N` is added, the user's settings still load (no `--setting-sources`, never `--restricted`), spawn `cwd` = `cwd`, stream-json is used so `onTool` sees each tool_use.
