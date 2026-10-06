'use strict';

const { loadPrompt, fillTemplate } = require('../prompts');
const { parseJsonOutput } = require('../llm');

// The folder map (spec A3-A4): one Claude call sees names, counts and short snippets only, and
// says what each top-level folder holds. Top-level files and code are decided here, never sent
// for a verdict, and a failed or unreadable answer still gives the person a map to correct.

const KINDS = new Set(['overview', 'conversations', 'agreements', 'build', 'reference', 'exclude', 'unsure']);
const SAMPLES_PER_FOLDER = 3;
const SNIPPET_CHARS = 300;
const PARSE_ERROR = "Promptly couldn't sort these; check them";

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const day = (ms) => (Number(ms) > 0 ? new Date(Number(ms)).toISOString().slice(0, 10) : '');
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

function sizeLabel(size) {
  const n = Number(size) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Only folders the model sorts get sampled; code is never opened.
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
  return parts.join(' · ');
}

const sampleLine = (file) => `- ${oneLine(file.rel)} · ${sizeLabel(file.size)}${day(file.mtimeMs) ? ` · ${day(file.mtimeMs)}` : ''}`;
const snippetLine = (snippet) => `  > ${snippet}`;

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
  let end = Math.max(0, maxBytes);
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8');
}

async function readSnippets(files, readSnippet) {
  return Promise.all(files.map(async (file) => {
    try {
      const text = await readSnippet(file.rel);
      return Array.from(oneLine(String(text ?? '').slice(0, 20000))).slice(0, SNIPPET_CHARS).join('');
    } catch {
      return '';
    }
  }));
}

// Snippets are added smallest folder first and stop at the first folder that would overflow,
// which is the same as dropping them from the largest folders first. Reading folder by folder
// means files whose text would be dropped are mostly never opened.
async function buildManifestText(scan, { readSnippet = async () => '', maxBytes = 40000 } = {}) {
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
  let used = bytes(render(blocks));
  const smallestFirst = blocks.filter((b) => b.samples.length).sort((a, b) => (Number(a.folder.count) || 0) - (Number(b.folder.count) || 0));
  for (const block of smallestFirst) {
    if (used >= maxBytes) break;
    const snippets = await readSnippets(block.samples, readSnippet);
    const extra = snippets.reduce((n, s) => n + (s ? bytes(snippetLine(s)) + 1 : 0), 0);
    if (used + extra > maxBytes) break;
    block.snippets = snippets;
    used += extra;
  }
  return trimToBytes(render(blocks), maxBytes);
}

// Model output → one entry per folder. With `rels` (the folders the model was asked about) it
// keeps only those, matching a trailing slash or different case, and fills any it left out.
function parseClassify(raw, rels) {
  const data = parseJsonOutput(String(raw ?? ''));
  const entries = Array.isArray(data) ? data : data?.folders;
  if (!Array.isArray(entries)) throw new Error('No folders in response');
  const known = rels ? new Map(rels.map((rel) => [rel.toLowerCase(), rel])) : null;
  const found = new Map();
  for (const entry of entries) {
    if (typeof entry?.rel !== 'string') continue;
    const said = entry.rel.trim().replace(/^\.\//, '').replace(/\/+$/, '');
    const rel = !known ? said : rels.includes(said) ? said : known.get(said.toLowerCase());
    if (rel === undefined || rel === '' || found.has(rel)) continue;
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

async function classifyFolders({ run, scan, readSnippet }) {
  const rels = (scan.folders || []).filter(modelDecides).map((folder) => folder.rel);
  if (!rels.length) return { folders: folderMap(scan) };
  const manifest = await buildManifestText(scan, { readSnippet });
  const prompt = fillTemplate(loadPrompt('project-classify'), { MANIFEST: manifest, FOLDERS: JSON.stringify(rels) });
  for (let attempt = 0; attempt < 2; attempt++) {
    let result;
    try {
      result = await run(prompt, { timeoutMs: 60000, slowWarningMs: 0, thinking: false });
    } catch (err) {
      result = { success: false, error: err?.message || 'Claude CLI error', errorType: 'unknown' };
    }
    if (result?.cancelled || result?.errorType === 'cancelled') return { cancelled: true };
    if (!result?.success) return { folders: folderMap(scan), error: { message: result?.error, errorType: result?.errorType } };
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
