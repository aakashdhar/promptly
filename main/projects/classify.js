'use strict';

const { loadPrompt, fillTemplate } = require('../prompts');
const { parseJsonOutput } = require('../llm');

// The folder map (spec A3-A4): one Claude call sees names, counts and short snippets only, and
// says what each top-level folder holds. Top-level files and code are decided here, never sent
// for a verdict, and a failed or unreadable answer still gives the person a map to correct.

const KINDS = new Set(['overview', 'conversations', 'agreements', 'build', 'reference', 'exclude', 'unsure']);
const MAX_BYTES = 40000;
// The answer has a line per folder; many more than this and it can't finish inside the time limit.
const MAX_ASKED = 100;
const SAMPLES_PER_FOLDER = 3;
const SNIPPET_CHARS = 300;
const PARSE_ERROR = "Promptly couldn't sort these; check them";

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const day = (ms) => (Number(ms) > 0 ? new Date(Number(ms)).toISOString().slice(0, 10) : '');
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
// Names and file text can't open or close the <manifest> block they sit in.
const safe = (s) => s.replace(/<(?=\s*\/?\s*manifest)/gi, '‹');

function sizeLabel(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Code is never opened; top-level files are sampled for context only.
const sampled = (folder) => folder.rel === '' || !folder.codeRoot;
const modelDecides = (folder) => folder.rel !== '' && !folder.codeRoot;

function header(folder) {
  const skipped = Number(folder.skippedCount) || 0;
  const count = Number(folder.count) || 0;
  const parts = [
    folder.rel === '' ? 'Top-level files (already decided: overview)'
      : folder.codeRoot ? `Folder ${JSON.stringify(folder.rel)} (code, already decided: exclude)`
        : `Folder ${JSON.stringify(folder.rel)}`,
    `${count} readable ${count === 1 ? 'file' : 'files'}`,
  ];
  if (day(folder.newestMs)) parts.push(`newest ${day(folder.newestMs)}`);
  if (skipped) parts.push(`${skipped} skipped`);
  return safe(parts.join(' · '));
}

const sampleLine = (file) => safe(`- ${oneLine(file.rel)} · ${sizeLabel(file.size)}${day(file.mtimeMs) ? ` · ${day(file.mtimeMs)}` : ''}`);
const snippetLine = (snippet) => safe(`  > ${snippet}`);

function render(blocks) {
  return blocks.map((b) => [
    header(b.folder),
    ...b.samples.flatMap((file, i) => (b.snippets[i] ? [sampleLine(file), snippetLine(b.snippets[i])] : [sampleLine(file)])),
  ].join('\n')).join('\n\n');
}

// Cuts at the last whole line that fits; a single overlong line is cut on a character boundary.
function trimToBytes(text, maxBytes) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  const newline = buf.lastIndexOf(0x0a, maxBytes);
  if (newline > 0) return buf.subarray(0, newline).toString('utf8');
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8');
}

async function readSnippets(files, readSnippet) {
  return Promise.all(files.map(async (file) => {
    try {
      // Whitespace is collapsed over the first 20,000 characters only: cheap on a long text, and
      // plenty for 300.
      const text = String((await readSnippet(file.rel)) ?? '').trimStart().slice(0, 20000);
      return Array.from(oneLine(text)).slice(0, SNIPPET_CHARS).join('');
    } catch {
      return '';
    }
  }));
}

// Over the cap, snippets go first, then sample lines, both from the largest folders first, and
// only then whole folders from the end. Snippets are added smallest folder first and stop at the
// first folder that would overflow, so files whose text would be dropped are mostly never opened.
async function buildManifestText(scan, { readSnippet = async () => '', maxBytes = MAX_BYTES } = {}) {
  const cap = Number.isFinite(maxBytes) ? Math.min(MAX_BYTES, Math.max(0, Math.floor(maxBytes))) : MAX_BYTES;
  const byTop = new Map();
  for (const file of scan.files || []) {
    if (!byTop.has(file.top)) byTop.set(file.top, []);
    byTop.get(file.top).push(file);
  }
  const blocks = (scan.folders || []).map((folder) => {
    const files = sampled(folder) && Number(folder.count) > 0 ? (byTop.get(folder.rel) || []) : [];
    const samples = [...files].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0)).slice(0, SAMPLES_PER_FOLDER);
    return { folder, samples, snippets: [] };
  });
  const smallestFirst = blocks.filter((b) => b.samples.length).sort((a, b) => (Number(a.folder.count) || 0) - (Number(b.folder.count) || 0));
  let used = bytes(render(blocks));
  for (const block of [...smallestFirst].reverse()) {
    if (used <= cap) break;
    used -= bytes(render([block])) - bytes(header(block.folder));
    block.samples = [];
  }
  for (const block of smallestFirst) {
    if (used >= cap) break;
    const snippets = await readSnippets(block.samples, readSnippet);
    const extra = snippets.reduce((n, s) => n + (s ? bytes(snippetLine(s)) + 1 : 0), 0);
    if (used + extra > cap) break;
    block.snippets = snippets;
    used += extra;
  }
  return trimToBytes(render(blocks), cap);
}

const looseName = (s) => s.trim().replace(/^\.\//, '').replace(/\/+$/, '');

// Model output → one entry per folder. With `rels` (the folders the model was asked about) it
// keeps only those: the exact name, else the one name that matches apart from spaces at the ends,
// a trailing slash or case. It fills any the model left out. Without `rels` it keeps any plain
// top-level name, never a path.
function parseClassify(raw, rels) {
  const data = parseJsonOutput(String(raw ?? ''));
  const entries = Array.isArray(data) ? data : data?.folders;
  if (!Array.isArray(entries)) throw new Error('No folders in response');
  const exact = new Set(rels || []);
  const loose = new Map();
  for (const rel of rels || []) {
    const key = looseName(rel).toLowerCase();
    if (key) loose.set(key, loose.has(key) ? null : rel);
  }
  const found = new Map();
  for (const entry of entries) {
    if (typeof entry?.rel !== 'string') continue;
    const said = looseName(entry.rel);
    const rel = !rels ? (/[\\/]/.test(said) || said === '.' || said === '..' ? '' : said)
      : exact.has(entry.rel) ? entry.rel : loose.get(said.toLowerCase());
    if (!rel || found.has(rel)) continue;
    let kind = typeof entry.kind === 'string' ? entry.kind.trim().toLowerCase() : '';
    if (!KINDS.has(kind)) kind = 'reference';
    const question = kind === 'unsure' && typeof entry.question === 'string' ? oneLine(entry.question).slice(0, 160) : '';
    if (kind === 'unsure' && !question) kind = 'reference';
    found.set(rel, question ? { rel, kind, question } : { rel, kind });
  }
  if (!found.size) throw new Error('No usable folders in response');
  if (!rels) return [...found.values()];
  return rels.map((rel) => found.get(rel) || { rel, kind: 'reference' });
}

function folderMap(scan, answers = new Map()) {
  return (scan.folders || []).map((folder) => {
    if (folder.rel === '') return { rel: '', kind: 'overview', on: true };
    if (folder.codeRoot) return { rel: folder.rel, kind: 'exclude', on: false };
    const answer = answers.get(folder.rel) || { kind: 'reference' };
    return { rel: folder.rel, kind: answer.kind, ...(answer.question ? { question: answer.question } : {}), on: answer.kind !== 'exclude' };
  });
}

// The whole prompt fits in 40 KB: instructions, the folder list and every listed folder's name
// line. Top-level files come first, then the folders to sort, then code, each in scan order until
// one doesn't fit. Folders left out are shown as reference, as when the call fails.
function foldersThatFit(folders, baseBytes) {
  const order = [...folders.filter((f) => f.rel === ''), ...folders.filter(modelDecides), ...folders.filter((f) => f.rel !== '' && f.codeRoot)];
  const kept = new Set();
  let used = baseBytes;
  let asked = 0;
  for (const folder of order) {
    const ask = modelDecides(folder);
    if (ask && asked === MAX_ASKED) continue;
    // Its name line and a blank line in the manifest; its JSON and a comma in the folder list.
    const cost = bytes(header(folder)) + 2 + (ask ? bytes(JSON.stringify(folder.rel)) + 1 : 0);
    if (used + cost > MAX_BYTES) break;
    kept.add(folder);
    used += cost;
    if (ask) asked++;
  }
  return folders.filter((folder) => kept.has(folder));
}

async function classifyFolders({ run, scan, readSnippet }) {
  const folders = scan.folders || [];
  if (!folders.some(modelDecides)) return { folders: folderMap(scan) };
  const template = loadPrompt('project-classify');
  const fill = (manifest, rels) => fillTemplate(template, { MANIFEST: manifest, FOLDERS: JSON.stringify(rels) });
  const shown = foldersThatFit(folders, bytes(fill('', [])));
  const rels = shown.filter(modelDecides).map((folder) => folder.rel);
  const manifest = await buildManifestText({ ...scan, folders: shown }, { readSnippet, maxBytes: MAX_BYTES - bytes(fill('', rels)) });
  const prompt = fill(manifest, rels);
  for (let attempt = 0; attempt < 2; attempt++) {
    let result;
    try {
      result = await run(prompt, { timeoutMs: 60000, slowWarningMs: 0, thinking: false });
    } catch (err) {
      result = { success: false, error: err?.message };
    }
    if (result?.cancelled || result?.errorType === 'cancelled') return { cancelled: true };
    if (!result?.success) {
      return { folders: folderMap(scan), error: { message: result?.error || 'Claude CLI error', errorType: result?.errorType || 'unknown' } };
    }
    try {
      const answers = parseClassify(result.prompt, rels);
      return { folders: folderMap(scan, new Map(answers.map((a) => [a.rel, a]))) };
    } catch {
      // Unusable JSON: ask once more with the same prompt.
    }
  }
  return { folders: folderMap(scan), error: { message: PARSE_ERROR, errorType: 'parse' } };
}

module.exports = { buildManifestText, parseClassify, classifyFolders };
