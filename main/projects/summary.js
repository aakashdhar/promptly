'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadPrompt, fillTemplate } = require('../prompts');
const { parseJsonOutput } = require('../llm');

// The project summary (spec §7-12). Build: every file becomes a short fact list (several files
// per call), then one merge writes the fixed sections. Refresh: only the new files and the
// current summary go in, and the answer is a JSON diff Promptly applies itself. Lines the person
// edited are pins: build, refresh and the word cap all keep them as written (or keep them out).

const SECTIONS = ['The project', 'People', 'How they like to be written to', 'Agreed', 'Open right now', 'Latest activity', 'Words'];
const LATEST = 'Latest activity';
const BATCH_BYTES = 60000;
// More files per call means a longer answer; past about 15 it risks the 2-minute limit.
const BATCH_FILES = 15;
const MERGE_BYTES = 150000;
const MAX_FILES = 400;
const TARGET_WORDS = 1500;
// Group summaries only feed the final merge, so they may keep more detail.
const GROUP_WORDS = 2000;
const MAX_WORDS = 2500;
const LATEST_DAYS = 14;
const RUN_OPTIONS = { timeoutMs: 120000, slowWarningMs: 0 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BULLET = /^(?:[-*+•]|\d+[.)])\s+/;
const PLACEHOLDERS = new Set(['none', 'none yet', 'nothing', 'nothing yet', 'nothing useful', 'n a', 'no recent activity', 'not in the files', 'not in the project files']);
const DIFF_KEYS = ['add', 'change', 'retire', 'latest'];
const PROMPTLY_MD = 'PROMPTLY.md';
const PROMPTLY_NOTE = '<!-- Written by Promptly. Edit any line: your lines are kept when the summary is refreshed. -->';

class Cancelled extends Error {}

const bytes = (s) => Buffer.byteLength(s, 'utf8');
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');
const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');

// ---- Dates ----

function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isoDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-10-04" → "4 Oct", with the year when it isn't today's.
function dateLabel(iso, today, { year = false } = {}) {
  const day = isoDay(iso);
  const [y, m, d] = day.split('-').map(Number);
  if (!day || !MONTHS[m - 1]) return '';
  return `${d} ${MONTHS[m - 1]}${year || String(y) !== today.slice(0, 4) ? ` ${y}` : ''}`;
}

// "4 Oct" or "Oct 4" → the latest such date not after today; with a year, as given.
function labelDay(label, today) {
  const text = oneLine(label).replace(/[.,]/g, '');
  if (isoDay(text)) return isoDay(text);
  const dayFirst = /^(\d{1,2}) ([a-z]{3})[a-z]*(?: (\d{4}))?$/i.exec(text);
  const monthFirst = dayFirst ? null : /^([a-z]{3})[a-z]* (\d{1,2})(?: (\d{4}))?$/i.exec(text);
  const [day, name, given] = dayFirst ? dayFirst.slice(1) : monthFirst ? [monthFirst[2], monthFirst[1], monthFirst[3]] : [];
  const month = name ? MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase()) : -1;
  if (month < 0) return '';
  const on = (year) => `${year}-${pad(month + 1)}-${pad(Number(day))}`;
  if (given) return on(given);
  const year = Number(today.slice(0, 4));
  return on(year) > today ? on(year - 1) : on(year);
}

// What a run may cite: its files, plus (on a refresh, via cite) what the current summary already
// cites. folderSize is set only when docs are every file in play, so folder counts can be capped.
function context(docs, today, { complete = false } = {}) {
  const day = isoDay(today) || todayIso();
  const ctx = { today: day, from: addDays(day, -LATEST_DAYS), byRel: new Map(), known: new Map(), tops: new Map(), folderSize: new Map() };
  for (const doc of docs) ctx.byRel.set(doc.rel, doc);
  cite(ctx, docs.map((doc) => ({ rel: doc.rel })));
  if (complete) {
    for (const doc of docs) {
      const top = topOf(doc.rel);
      if (top) ctx.folderSize.set(top, (ctx.folderSize.get(top) || 0) + 1);
    }
  }
  return ctx;
}

function cite(ctx, sources) {
  for (const s of sources) {
    const lower = s.rel.toLowerCase();
    if (s.count) {
      if (!ctx.tops.has(lower)) ctx.tops.set(lower, s.rel);
      continue;
    }
    if (!ctx.known.has(lower)) ctx.known.set(lower, s.rel);
    const top = topOf(s.rel);
    if (top && !ctx.tops.has(top.toLowerCase())) ctx.tops.set(top.toLowerCase(), top);
  }
}

const docFor = (rel, ctx) => ctx.byRel.get(rel) || ctx.byRel.get(ctx.known.get(String(rel).replace(/^\.\//, '').toLowerCase())) || null;

// A tag's path → a path this run knows, or ''. Models sometimes add ", 4 Oct" without the "·",
// or drop the folder; both still find the file when only one path fits.
function findRel(text, ctx) {
  const want = oneLine(text).replace(/^\.?\//, '').toLowerCase();
  if (ctx.known.has(want)) return ctx.known.get(want);
  let best = '';
  for (const [lower, rel] of ctx.known) {
    if (want.startsWith(lower) && /^[\s,;(–—-]/.test(want.slice(lower.length)) && rel.length > best.length) best = rel;
  }
  if (best || want.includes('/')) return best;
  const same = [...ctx.known].filter(([lower]) => lower.slice(lower.lastIndexOf('/') + 1) === want);
  return same.length === 1 ? same[0][1] : '';
}

// ---- Source tags ----

const topOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '');
const isEmail = (rel, ctx) => /\.(eml|mbox)$/i.test(rel) || Boolean(docFor(rel, ctx)?.sender);

function formatSource(source) {
  if (source.count) return `[source: ${source.rel} · ${source.count} ${source.noun}]`;
  return `[source: ${source.rel}${source.date ? ` · ${source.date}` : ''}]`;
}

const tagFor = (doc, today) => formatSource({ rel: doc.rel, date: dateLabel(doc.date, today) });

function parseSource(part) {
  const text = oneLine(part);
  if (!text) return null;
  const m = /^(.*\S)\s*·\s*([^·]+)$/.exec(text);
  if (!m) return { rel: text, date: '' };
  const group = /^(\d+)\s+(email|file)s?$/i.exec(m[2].trim());
  if (group) return { rel: m[1], date: '', count: Number(group[1]), noun: `${group[2].toLowerCase()}s` };
  return { rel: m[1], date: m[2].trim() };
}

// File names can hold brackets ("[EXTERNAL] Re SSO.eml"), so a square tag runs to the date (or
// file count) that ends it; a tag without one may hold balanced brackets. "(source: …)" counts
// too, and one tag may list several files split by ";".
const OPEN_TAG = String.raw`\[\s*sources?\s*:`;
const TAG_END = String.raw`·\s*(?:\d{1,2}\s+[a-z]{3,9}\.?(?:,?\s+\d{4})?|[a-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d+\s+(?:emails?|files?))\s*`;
const TAG = new RegExp([
  String.raw`${OPEN_TAG}((?:(?!${OPEN_TAG})[^\n])*?${TAG_END})\]`,
  String.raw`${OPEN_TAG}((?:[^[\]\n]|\[[^[\]\n]*\])*)\]`,
  String.raw`\(\s*sources?\s*:((?:[^()\n]|\([^()\n]*\))*)\)`,
].join('|'), 'gi');

// A line → its words without source tags, and the tags in order.
function splitTags(line) {
  const sources = [];
  const body = String(line ?? '').replace(TAG, (_match, dated, plain, round) => {
    for (const part of (dated ?? plain ?? round).split(/\s*;\s*/)) {
      const source = parseSource(part);
      if (source) sources.push(source);
    }
    return ' ';
  });
  return { body: oneLine(body), sources };
}

// The tag as this run knows it (canonical path, the file's own date), or null for a path the run
// never saw: a model can't cite a file into existence.
function resolveSource(source, ctx) {
  if (source.count) {
    const top = ctx.tops.get(source.rel.toLowerCase());
    return top ? { rel: top, date: '', count: Math.min(source.count, ctx.folderSize.get(top) || Infinity), noun: source.noun } : null;
  }
  const rel = findRel(source.rel, ctx);
  if (!rel) return null;
  const doc = ctx.byRel.get(rel);
  if (doc) return { rel, date: dateLabel(doc.date, ctx.today) };
  const day = labelDay(source.date, ctx.today);
  return { rel, date: day ? dateLabel(day, ctx.today) : '' };
}

const groupOf = (s) => (s.count ? s.rel : topOf(s.rel));

// A line resting on more than two files cites each top folder once: [source: comms · 31 emails].
// Counts add up (group summaries cover different files), capped at the folder's file count when
// known. Top-level files keep their own tags.
function collapse(sources, ctx) {
  const crowded = sources.length > 2 || sources.some((s) => s.count && sources.some((o) => o !== s && groupOf(o) === s.rel));
  if (!crowded) return sources;
  const folders = new Map();
  const loose = [];
  for (const s of sources) {
    const top = groupOf(s);
    if (!top) { loose.push(s); continue; }
    if (!folders.has(top)) folders.set(top, { files: [], count: 0, emails: true });
    const folder = folders.get(top);
    if (s.count) folder.count += s.count;
    else folder.files.push(s);
    folder.emails = folder.emails && (s.count ? s.noun === 'emails' : isEmail(s.rel, ctx));
  }
  const grouped = [...folders].map(([top, f]) => (!f.count && f.files.length === 1 ? f.files[0]
    : { rel: top, date: '', count: Math.min(f.count + f.files.length, ctx.folderSize.get(top) || Infinity), noun: f.emails ? 'emails' : 'files' }));
  return [...grouped, ...loose];
}

const sourceDay = (s, ctx) => isoDay(docFor(s.rel, ctx)?.date) || labelDay(s.date, ctx.today);

// Canonical tags (path and date from the file itself), each once, at the end of the line.
// recent is judged on the files themselves, before a folder tag hides their dates.
function tidy(line, ctx) {
  const { body, sources } = splitTags(line);
  const seen = new Set();
  const unique = [];
  for (const source of sources) {
    const s = resolveSource(source, ctx);
    const key = s && formatSource(s);
    if (!s || seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  const days = unique.filter((s) => !s.count).map((s) => sourceDay(s, ctx)).filter(Boolean);
  const tags = collapse(unique, ctx).map(formatSource);
  return { text: [body, ...tags].join(' '), sourced: Boolean(body) && tags.length > 0, recent: !days.length || days.some((day) => day >= ctx.from) };
}

function sourcesOf(summaryText) {
  const found = new Map();
  for (const s of splitTags(summaryText).sources) {
    const key = formatSource(s);
    if (!found.has(key)) found.set(key, s.count ? { rel: s.rel, date: '', count: s.count, noun: s.noun } : { rel: s.rel, date: s.date });
  }
  return [...found.values()];
}

// For comparing lines: without tags, case, punctuation or spacing. Currency signs, % and the
// vowel signs of Indic scripts stay.
function norm(line) {
  return splitTags(line).body.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Sc}%]+/gu, ' ').trim();
}

// For spotting the person's edits: a fixed capital ("MS Teams") is an edit; a dropped tag,
// spacing or a final full stop isn't.
function editKey(line) {
  return splitTags(line).body.normalize('NFC').replace(/[\s.,;:!?…]+$/u, '').trim();
}

// ---- Sections ----

const simple = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
const SIMPLE = SECTIONS.map(simple);
const emptySections = () => Object.fromEntries(SECTIONS.map((name) => [name, []]));

// Other headings people (and models) use for the same sections.
const ALIASES = {
  'The project': ['project', 'overview', 'about', 'background'],
  People: ['contacts', 'team', 'stakeholders', 'who s who', 'key people'],
  'How they like to be written to': ['tone', 'style', 'writing style', 'communication', 'how to write', 'preferences'],
  Agreed: ['agreements', 'decisions', 'scope'],
  'Open right now': ['open', 'pending', 'questions', 'to do', 'todo', 'action items', 'next steps', 'waiting on', 'outstanding'],
  'Latest activity': ['latest', 'recent', 'activity', 'updates'],
  Words: ['glossary', 'terms', 'terminology', 'vocabulary', 'acronyms', 'jargon'],
};

// "## People (both sides)" → People. exact: only the bare name, for "People:" lines.
function sectionNamed(heading, { exact = false } = {}) {
  const h = simple(heading);
  const is = (name) => h === name || (!exact && h.startsWith(`${name} `));
  const i = SIMPLE.findIndex(is);
  if (i >= 0) return SECTIONS[i];
  return exact ? null : SECTIONS.find((name) => ALIASES[name].some(is)) || null;
}

const SKIP = /^(?:`{3}|-{3,}$|\*{3,}$|_{3,}$|<!--.*-->$)/;

// Lines under a heading Promptly doesn't know stay with the section above it. Text before the
// first known heading is dropped from a model's answer (a title, a preamble); in the person's own
// edit (preamble) it belongs to The project.
function readSections(text, { preamble = false } = {}) {
  const sections = emptySections();
  let current = preamble ? SECTIONS[0] : null;
  let found = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || SKIP.test(line)) continue;
    const heading = /^#{1,6}\s+(.*?)[\s#]*$/.exec(line);
    const label = heading || BULLET.test(line) ? null : sectionNamed(line.replace(/[*_:]/g, ''), { exact: true });
    if (heading || label) {
      const name = label || sectionNamed(heading[1].replace(/[*_]/g, ''));
      if (name) { current = name; found = true; }
      continue;
    }
    if (!current) continue;
    const bullet = line.replace(BULLET, '').trim();
    if (bullet && !PLACEHOLDERS.has(norm(bullet))) sections[current].push(bullet);
  }
  return { sections, found };
}

const parseSections = (text) => readSections(text).sections;

function render(sections) {
  return SECTIONS.map((name) => [`## ${name}`, ...(sections[name] || []).map((line) => `- ${line}`)].join('\n')).join('\n\n');
}

// ---- Pins ----

const isDrop = (pin) => pin.kind === 'drop';
// A damaged pins.json entry is skipped, never a crash.
const cleanPins = (pins) => (Array.isArray(pins) ? pins : []).filter((pin) => pin && typeof pin.text === 'string');

function keptPins(pins) {
  const kept = new Map();
  for (const pin of pins) {
    const key = isDrop(pin) ? '' : norm(pin.text);
    if (key && !kept.has(key)) kept.set(key, pin);
  }
  return kept;
}

const pinSection = (pin) => sectionNamed(pin.section || '') || SECTIONS[0];

// The model's lines minus anything the person deleted or already wrote themselves; their own
// lines stay where they are, or go at the end of their section when the model's text lacks them.
function applyPins(sections, pins) {
  const kept = keptPins(pins);
  const dropped = new Set(pins.filter(isDrop).map((pin) => norm(pin.text)));
  const placed = new Set();
  const out = emptySections();
  for (const name of SECTIONS) {
    const seen = new Set();
    for (const line of sections[name] || []) {
      const key = norm(line);
      if (!key || seen.has(key)) continue;
      const pin = kept.get(key);
      if (pin) {
        if (pinSection(pin) === name && !placed.has(pin)) { out[name].push(pin.text); placed.add(pin); seen.add(key); }
        continue;
      }
      if (dropped.has(key)) continue;
      seen.add(key);
      out[name].push(line);
    }
  }
  for (const pin of kept.values()) if (!placed.has(pin)) out[pinSection(pin)].push(pin.text);
  return out;
}

const renderSections = (sections, pins = []) => render(applyPins(sections, cleanPins(pins)));

function makePin(section, text, kind) {
  const id = crypto.createHash('sha1').update(`${kind}\n${section}\n${norm(text)}`).digest('hex').slice(0, 12);
  return { id, section, text, kind };
}

function placesOf(sections, keyOf) {
  const places = new Map();
  for (const name of SECTIONS) {
    for (const line of sections[name]) {
      const key = keyOf(line);
      if (!key) continue;
      if (!places.has(key)) places.set(key, new Set());
      places.get(key).add(name);
    }
  }
  return places;
}

// Lines the person added, changed (even only a capital) or moved become keep-pins; lines they
// deleted, including the old wording of a reworded line, become drop-pins so the model can't
// bring them back. A line that only changed case isn't deleted: its keep-pin covers it.
function pinsFromEdit(before, after) {
  const was = readSections(before, { preamble: true }).sections;
  const now = readSections(after, { preamble: true }).sections;
  const wasAt = placesOf(was, editKey);
  const nowAt = placesOf(now, norm);
  const pins = new Map();
  const add = (pin) => pins.set(pin.id, pin);
  for (const name of SECTIONS) {
    for (const line of now[name]) {
      const key = editKey(line);
      if (key && norm(line) && !wasAt.get(key)?.has(name)) add(makePin(name, line, 'keep'));
    }
  }
  for (const name of SECTIONS) {
    for (const line of was[name]) {
      const key = norm(line);
      if (key && !nowAt.has(key)) add(makePin(name, line, 'drop'));
    }
  }
  return [...pins.values()];
}

// The newest word on a line wins: re-adding a deleted line lifts its drop-pin, deleting a pinned
// line turns its keep-pin into a drop-pin.
function mergePins(existing = [], fresh = []) {
  const newer = cleanPins(fresh);
  const replaced = new Set(newer.map((pin) => norm(pin.text)));
  const merged = new Map();
  for (const pin of [...cleanPins(existing).filter((pin) => !replaced.has(norm(pin.text))), ...newer]) merged.set(pin.id, pin);
  return [...merged.values()];
}

function pinLines(pins, drop) {
  const lines = pins.filter((pin) => isDrop(pin) === drop && oneLine(pin.text)).map((pin) => `- ${oneLine(pin.text)}`);
  return lines.length ? lines.join('\n') : '(none)';
}

// ---- Finishing: Latest activity window, pins, word cap ----

// A Latest activity line stays while any of its files is from the window; lines whose files
// have no readable date are left alone.
function isRecent(line, ctx) {
  const days = splitTags(line).sources.filter((s) => !s.count).map((s) => sourceDay(s, ctx)).filter(Boolean);
  return !days.length || days.some((day) => day >= ctx.from);
}

const wordCount = (line) => splitTags(line).body.split(/\s+/).filter(Boolean).length;

// The hard cap: whole lines come off the end of the last non-empty section, working back.
// Headings and pinned lines always stay.
function capWords(sections, pinned, max = MAX_WORDS) {
  let total = SECTIONS.reduce((sum, name) => sum + sections[name].reduce((n, line) => n + wordCount(line), 0), 0);
  for (let s = SECTIONS.length - 1; s >= 0 && total > max; s--) {
    const lines = sections[SECTIONS[s]];
    for (let i = lines.length - 1; i >= 0 && total > max; i--) {
      if (pinned(lines[i])) continue;
      total -= wordCount(lines[i]);
      lines.splice(i, 1);
    }
  }
  return sections;
}

function finish(sections, pins, ctx) {
  const kept = keptPins(pins);
  const pinned = (line) => kept.has(norm(line));
  const latest = (sections[LATEST] || []).filter((line) => pinned(line) || isRecent(line, ctx));
  return render(capWords(applyPins({ ...sections, [LATEST]: latest }, pins), pinned));
}

// ---- Claude calls ----

function failure(message, errorType, progress) {
  return Object.assign(new Error(message || 'Claude CLI error'), { errorType: errorType || 'unknown', done: progress.done, total: progress.total });
}

function createCaller({ run, signal, onProgress = () => {} }) {
  const progress = { done: 0, total: 0 };
  const report = (stage, current = '') => {
    try {
      onProgress({ done: progress.done, total: Math.max(progress.total, progress.done), stage, current });
    } catch {
      // A broken progress listener never stops the work.
    }
  };
  async function call(prompt, stage, current) {
    if (signal?.aborted) throw new Cancelled();
    let result;
    try {
      result = await run(prompt, { ...RUN_OPTIONS });
    } catch (err) {
      result = { success: false, error: err?.message, errorType: 'unknown' };
    }
    if (result?.cancelled || result?.errorType === 'cancelled') throw new Cancelled();
    if (!result?.success) throw failure(result?.error, result?.errorType, progress);
    progress.done++;
    report(stage, current);
    return String(result.prompt ?? '');
  }
  return { call, report, progress };
}

// ---- Map: files → facts ----

const newestFirst = (a, b) => isoDay(b.date).localeCompare(isoDay(a.date)) || a.rel.localeCompare(b.rel);
// PROMPTLY.md is this summary written into the folder; reading it back as a file would feed the
// summary to itself.
const usable = (docs) => (Array.isArray(docs) ? docs : [])
  .filter((doc) => typeof doc?.rel === 'string' && doc.rel && doc.rel.toLowerCase() !== PROMPTLY_MD.toLowerCase() && oneLine(doc.text))
  .sort(newestFirst);

// Past 400 files, kinds take turns (each newest first), so a busy inbox can't crowd out the contract.
function pickDocs(docs) {
  const all = usable(docs);
  if (all.length <= MAX_FILES) return { chosen: all, leftOut: [] };
  const byKind = new Map();
  for (const doc of all) {
    if (!byKind.has(doc.kind)) byKind.set(doc.kind, []);
    byKind.get(doc.kind).push(doc);
  }
  const queues = [...byKind.values()];
  const chosen = new Set();
  for (let i = 0; chosen.size < MAX_FILES; i++) {
    for (const queue of queues) if (i < queue.length && chosen.size < MAX_FILES) chosen.add(queue[i]);
  }
  return { chosen: [...chosen].sort(newestFirst), leftOut: all.filter((doc) => !chosen.has(doc)) };
}

// Last whole line within max bytes, else a cut on a character boundary.
function headBytes(text, max) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= max) return text;
  const newline = buf.lastIndexOf(0x0a, max);
  let end = newline > max / 2 ? newline : max;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8');
}

function tailBytes(text, max) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= max) return text;
  let start = buf.length - max;
  const newline = buf.indexOf(0x0a, start);
  if (newline >= 0 && newline < start + max / 2) start = newline + 1;
  while (start < buf.length && (buf[start] & 0xc0) === 0x80) start++;
  return buf.subarray(start).toString('utf8');
}

// Too long for one call: keep the start and the end, which usually say what the file is and
// where it got to, and mark the gap.
function fitText(text, maxBytes) {
  const size = bytes(text);
  if (size <= maxBytes) return text;
  const gap = (kb) => `\n[… ${kb} KB of this file left out here …]\n`;
  const room = Math.max(0, maxBytes - bytes(gap(size)));
  const head = headBytes(text, Math.floor((room * 2) / 3));
  const tail = tailBytes(text, room - bytes(head));
  return `${head}${gap(Math.max(1, Math.round((size - bytes(head) - bytes(tail)) / 1024)))}${tail}`;
}

// File text goes in as written, except that it can't close (or fake) the prompt's own tags.
const OWN_TAG = /<(?=\s*\/?\s*(?:documents?|text|path|tag|kind|date|from|title|material|summary|group_summary|new_material|recent_conversations)\b)/gi;
const neutralise = (text) => String(text ?? '').replace(OWN_TAG, '&lt;');

function documentBlock(doc, today) {
  const head = [
    '<document>',
    `<path>${doc.rel}</path>`,
    `<tag>${tagFor(doc, today)}</tag>`,
    `<kind>${doc.kind || 'unknown'}</kind>`,
    isoDay(doc.date) && `<date>${isoDay(doc.date)}</date>`,
    oneLine(doc.sender) && `<from>${neutralise(oneLine(doc.sender).slice(0, 200))}</from>`,
    oneLine(doc.title) && `<title>${neutralise(oneLine(doc.title).slice(0, 300))}</title>`,
    '<text>',
  ].filter(Boolean).join('\n');
  const tail = '</text>\n</document>';
  return `${head}\n${fitText(neutralise(String(doc.text).trim()), BATCH_BYTES - bytes(head) - bytes(tail) - 2)}\n${tail}`;
}

// Newest first, as many files per call as fit in 60 KB (and at most BATCH_FILES). Blocks are
// joined by a blank line, which counts too.
function makeBatches(docs, today) {
  const batches = [];
  let batch = null;
  for (const doc of docs) {
    const block = documentBlock(doc, today);
    const size = bytes(block);
    if (batch && batch.docs.length < BATCH_FILES && batch.bytes + 2 + size <= BATCH_BYTES) {
      batch.bytes += 2 + size;
    } else {
      batch = { docs: [], blocks: [], bytes: size };
      batches.push(batch);
    }
    batch.docs.push(doc);
    batch.blocks.push(block);
  }
  return batches;
}

const labelOf = (docs) => [...new Set(docs.map((doc) => topOf(doc.rel)).filter(Boolean))].join(', ');

// A facts answer → each file's fact lines. Every line gets its own file's tag, whatever tag the
// model wrote, so later steps can trust tags. A file the answer skipped is missing from the map.
function parseFacts(answer, docs, ctx) {
  const lookup = (path) => {
    const want = path.replace(/^[`*"'\s]+|[`*"':\s]+$/g, '').replace(/^\.\//, '').toLowerCase();
    return docs.find((doc) => doc.rel.toLowerCase() === want) || null;
  };
  const facts = new Map();
  let current = docs.length === 1 ? docs[0] : null;
  for (const raw of String(answer ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      current = lookup(heading[1]) || (docs.length === 1 ? docs[0] : null);
      if (current && !facts.has(current)) facts.set(current, []);
      continue;
    }
    if (!BULLET.test(line)) continue;
    const { body, sources } = splitTags(line.replace(BULLET, ''));
    const doc = current || sources.map((s) => lookup(s.rel)).find(Boolean);
    if (!doc) continue;
    if (!facts.has(doc)) facts.set(doc, []);
    if (body && !PLACEHOLDERS.has(norm(body))) facts.get(doc).push(`- ${body} ${tagFor(doc, ctx.today)}`);
  }
  return new Map([...facts].map(([doc, lines]) => [doc, lines.join('\n')]));
}

// Fills cache (keyOf(doc) → facts, '' for a file with nothing useful). Files an answer skipped
// get one more call of their own; after that they count as read.
async function readFacts(batches, caller, ctx, cache, keyOf) {
  const queue = batches.map((batch) => ({ ...batch, again: false }));
  while (queue.length) {
    const batch = queue.shift();
    const answer = await caller.call(fillTemplate(loadPrompt('project-facts'), { DOCUMENTS: batch.blocks.join('\n\n') }), 'reading', labelOf(batch.docs));
    const facts = parseFacts(answer, batch.docs, ctx);
    for (const [doc, text] of facts) cache.set(keyOf(doc), text);
    const missed = batch.docs.filter((doc) => !facts.has(doc));
    if (missed.length && !batch.again) {
      const retry = makeBatches(missed, ctx.today).map((b) => ({ ...b, again: true }));
      caller.progress.total += retry.length;
      queue.unshift(...retry);
    } else {
      for (const doc of missed) cache.set(keyOf(doc), '');
    }
  }
  return cache;
}

const factsBlock = (doc, facts) => `### ${doc.rel} · ${doc.kind || 'unknown'}\n${facts}`;

// ---- Reduce: facts → sections ----

// Unusable when it has none of the headings, or when most of its lines cite nothing real (then it
// isn't the summary that was asked for). Single unsourced lines are dropped, and so are Latest
// activity lines whose files are all older than the window.
function readSummary(answer, ctx) {
  const { sections, found } = readSections(answer);
  const out = emptySections();
  let lines = 0;
  let sourced = 0;
  for (const name of SECTIONS) {
    for (const line of sections[name]) {
      const tidied = tidy(line, ctx);
      lines++;
      if (!tidied.sourced) continue;
      sourced++;
      if (name !== LATEST || tidied.recent) out[name].push(tidied.text);
    }
  }
  return { sections: out, usable: found && sourced * 2 >= lines };
}

const sizeOf = (blocks) => bytes(blocks.join('\n\n'));

function groupBlocks(blocks, maxBytes) {
  const groups = [];
  let size = 0;
  for (const block of blocks) {
    const n = bytes(block) + 2;
    if (!groups.length || size + n > maxBytes) { groups.push([]); size = 0; }
    groups[groups.length - 1].push(block);
    size += n;
  }
  return groups;
}

async function mergeOnce(blocks, words, caller, ctx, pins) {
  const prompt = fillTemplate(loadPrompt('project-merge'), {
    TODAY: dateLabel(ctx.today, ctx.today, { year: true }),
    FROM: dateLabel(ctx.from, ctx.today, { year: true }),
    WORDS: words.toLocaleString('en-US'),
    FACTS: blocks.join('\n\n'),
    KEPT: pinLines(pins, false),
    DELETED: pinLines(pins, true),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) caller.progress.total++;
    const answer = readSummary(await caller.call(prompt, 'merging'), ctx);
    if (answer.usable) return answer.sections;
  }
  throw failure("Promptly couldn't read the summary Claude wrote", 'parse', caller.progress);
}

// One round: every group of up to 150 KB becomes a group summary.
async function mergeGroups(groups, caller, ctx, pins) {
  caller.progress.total += groups.length;
  const parts = [];
  for (const group of groups) parts.push(`<group_summary>\n${render(await mergeOnce(group, GROUP_WORDS, caller, ctx, pins))}\n</group_summary>`);
  return parts;
}

// Facts too big for one call are merged in groups (newest group first), then the group
// summaries are merged, as many rounds as it takes.
async function mergeAll(blocks, caller, ctx, pins) {
  let level = blocks;
  for (;;) {
    const groups = groupBlocks(level, MERGE_BYTES);
    if (groups.length === 1 || groups.length >= level.length) {
      caller.progress.total = caller.progress.done + 1;
      return finish(await mergeOnce(level, TARGET_WORDS, caller, ctx, pins), pins, ctx);
    }
    caller.progress.total = caller.progress.done + 1;
    level = await mergeGroups(groups, caller, ctx, pins);
  }
}

// Shrinks material to fit room by summarising it in groups; stops if a round doesn't shrink it.
async function condense(blocks, room, caller, ctx, pins) {
  let level = blocks;
  while (level.length && sizeOf(level) > room) {
    const next = await mergeGroups(groupBlocks(level, MERGE_BYTES), caller, ctx, pins);
    if (sizeOf(next) >= sizeOf(level)) return level;
    level = next;
  }
  return level;
}

function estimateCalls(docs, { today } = {}) {
  const { chosen } = pickDocs(docs);
  return chosen.length ? makeBatches(chosen, isoDay(today) || todayIso()).length + 1 : 0;
}

const byRel = (doc) => doc.rel;

// factsCache (rel → facts) lets Retry pick up where a failed or cancelled build stopped.
// pins: the person's lines, kept through a Rebuild.
async function buildSummary({ run, docs = [], onProgress, signal, factsCache, today, pins = [] } = {}) {
  const cache = factsCache instanceof Map ? factsCache : new Map();
  const pinList = cleanPins(pins);
  const { chosen, leftOut } = pickDocs(docs);
  const ctx = context(chosen, today, { complete: true });
  const caller = createCaller({ run, signal, onProgress });
  try {
    const batches = makeBatches(chosen.filter((doc) => !cache.has(doc.rel)), ctx.today);
    caller.progress.total = batches.length + 1;
    caller.report(batches.length ? 'reading' : 'merging', batches.length ? labelOf(batches[0].docs) : '');
    await readFacts(batches, caller, ctx, cache, byRel);
    const blocks = chosen.filter((doc) => cache.get(doc.rel)).map((doc) => factsBlock(doc, cache.get(doc.rel)));
    const text = blocks.length ? await mergeAll(blocks, caller, ctx, pinList) : finish(emptySections(), pinList, ctx);
    if (signal?.aborted) return { cancelled: true };
    return { text, fileCount: chosen.length, leftOut: leftOut.length, leftOutFiles: leftOut.map(byRel) };
  } catch (err) {
    if (err instanceof Cancelled) return { cancelled: true };
    throw err;
  }
}

// ---- Refresh: a JSON diff over the current summary ----

const cleanText = (text) => oneLine(text).replace(BULLET, '').replace(/^(?:\[(?:L\d+[^\]]*|fixed)\]\s*)+/i, '').trim();
const tagsOf = (line) => splitTags(line).sources.map(formatSource).join(' ');

function sourceList(source) {
  if (typeof source === 'string') return [source];
  return Array.isArray(source) ? source.filter((s) => typeof s === 'string') : [];
}

// A model's item → a summary line with canonical tags, or '' when it cites no file this run knows
// (or, for Latest activity, only files older than the window).
function bulletFrom(text, source, ctx, { latest = false } = {}) {
  const body = typeof text === 'string' ? cleanText(text) : '';
  if (!body) return '';
  const tags = sourceList(source).map(oneLine).filter(Boolean)
    .map((s) => (/^[[(]\s*sources?\s*:/i.test(s) ? s : `[source: ${s.replace(/^sources?\s*:\s*/i, '')}]`));
  const line = tidy([body, ...tags].join(' '), ctx);
  return line.sourced && (!latest || line.recent) ? line.text : '';
}

// Tags in a stored summary were written when it was built; a date from another year says so.
function withYears(line, today) {
  const { body, sources } = splitTags(line);
  if (!sources.length) return line;
  const tags = sources.map((s) => {
    const day = s.count ? '' : labelDay(s.date, today);
    return formatSource(day ? { rel: s.rel, date: dateLabel(day, today) } : s);
  });
  return [body, ...tags].join(' ');
}

const restsOnRemoved = (line, gone) => {
  const { sources } = splitTags(line);
  return sources.length > 0 && sources.every((s) => !s.count && gone.has(s.rel));
};

// Ids count the unpinned lines in order; applyDiff numbers them the same way. A line whose every
// file was removed is marked, so a renamed file's facts can be moved to its new path.
function numbered(summary, pins, gone, today) {
  const kept = keptPins(pins);
  const sections = parseSections(summary);
  let n = 0;
  return SECTIONS.map((name) => [`## ${name}`, ...sections[name].map((line) => {
    const shown = withYears(line, today);
    if (kept.has(norm(line))) return `[fixed] ${shown}`;
    n++;
    return `[L${n}${restsOnRemoved(line, gone) ? ' · source removed' : ''}] ${shown}`;
  })].join('\n')).join('\n\n');
}

function itemsOf(list, key) {
  return (Array.isArray(list) ? list : [])
    .map((item) => (typeof item === 'string' || typeof item === 'number' ? (key ? { [key]: item } : null) : item))
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

// change and retire find their line by id ("L7", "[L7] …", 7) or by a normalised piece of its
// text, and never touch a pinned line. Lines whose only sources were removed go; the removed
// file's tag comes off lines that cite others too. latest replaces Latest activity entirely
// (pins aside); without latest, its lines stay while they're in the window.
function applyDiff(summaryText, diff, pins = [], { removed = [], docs = [], today } = {}) {
  const changes = diff && typeof diff === 'object' ? diff : {};
  const pinList = cleanPins(pins);
  const gone = new Set((Array.isArray(removed) ? removed : []).filter((rel) => typeof rel === 'string'));
  const ctx = context(usable(docs), today);
  cite(ctx, sourcesOf(String(summaryText ?? '')).filter((s) => s.count || !gone.has(s.rel)));
  const kept = keptPins(pinList);
  const parsed = parseSections(summaryText);
  const ids = new Map();
  const sections = {};
  // Tags from an earlier year get it written in, so "4 Dec" can't drift to next December.
  for (const name of SECTIONS) {
    sections[name] = parsed[name].map((text) => {
      const pinned = kept.has(norm(text));
      const line = { text: pinned ? text : withYears(text, ctx.today), pinned, gone: false };
      if (!pinned) ids.set(ids.size + 1, line);
      return line;
    });
  }
  const lines = () => SECTIONS.flatMap((name) => sections[name]).filter((line) => !line.gone);
  const find = (match) => {
    if (typeof match !== 'string' && typeof match !== 'number') return null;
    const key = oneLine(match);
    const id = /^\[?L(\d+)\b/i.exec(key) || /^(\d+)$/.exec(key);
    if (id) {
      const line = ids.get(Number(id[1]));
      return line && !line.gone ? line : null;
    }
    const want = norm(key);
    return want.length >= 3 ? lines().find((line) => !line.pinned && norm(line.text).includes(want)) || null : null;
  };

  for (const item of itemsOf(changes.change)) {
    const line = find(item.match ?? item.id);
    if (!line) continue;
    const text = bulletFrom(item.text, item.source, ctx) || bulletFrom(item.text, tagsOf(line.text), ctx);
    if (text) line.text = text;
  }
  for (const item of itemsOf(changes.retire, 'match')) {
    const line = find(item.match ?? item.id);
    if (line) line.gone = true;
  }
  const replaceLatest = Array.isArray(changes.latest);
  for (const item of itemsOf(changes.add)) {
    const name = typeof item.section === 'string' ? sectionNamed(item.section) : null;
    const text = bulletFrom(item.text, item.source, ctx);
    if (!name || !text || (replaceLatest && name === LATEST)) continue;
    if (lines().some((line) => norm(line.text) === norm(text))) continue;
    sections[name].push({ text, pinned: false, gone: false });
  }
  for (const line of gone.size ? lines() : []) {
    if (line.pinned) continue;
    const { body, sources } = splitTags(line.text);
    const left = sources.filter((s) => s.count || !gone.has(s.rel));
    if (left.length === sources.length) continue;
    if (left.length) line.text = [body, ...left.map(formatSource)].join(' ');
    else line.gone = true;
  }
  if (replaceLatest) {
    const fresh = itemsOf(changes.latest, 'text').map((item) => bulletFrom(item.text, item.source, ctx, { latest: true })).filter(Boolean);
    sections[LATEST] = [...sections[LATEST].filter((line) => line.pinned), ...fresh.map((text) => ({ text, pinned: false, gone: false }))];
  }
  const plain = Object.fromEntries(SECTIONS.map((name) => [name, sections[name].filter((line) => !line.gone).map((line) => line.text)]));
  return finish(plain, pinList, ctx);
}

// "{}" means nothing changed. An object with other keys and none of the diff's is a wrong answer.
function readDiff(answer) {
  let data;
  try {
    data = parseJsonOutput(String(answer ?? ''));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Object.keys(data).length && !DIFF_KEYS.some((key) => key in data)) return null;
  return Object.fromEntries(DIFF_KEYS.filter((key) => Array.isArray(data[key])).map((key) => [key, data[key]]));
}

// { old rel: new rel } (or a Map) from the integrator's manifest diff.
function renameMap(renamed) {
  const entries = renamed instanceof Map ? [...renamed] : renamed && typeof renamed === 'object' ? Object.entries(renamed) : [];
  return new Map(entries.filter(([from, to]) => typeof from === 'string' && typeof to === 'string' && from && to && from !== to));
}

function renameTags(text, renames, ctx) {
  if (!renames.size) return text;
  return text.split('\n').map((line) => {
    const { body, sources } = splitTags(line);
    if (!sources.some((s) => !s.count && renames.has(s.rel))) return line;
    const moved = sources.map((s) => {
      if (s.count || !renames.has(s.rel)) return s;
      const rel = renames.get(s.rel);
      return { rel, date: dateLabel(docFor(rel, ctx)?.date, ctx.today) || s.date };
    });
    return [body, ...moved.map(formatSource)].join(' ');
  }).join('\n');
}

// Refresh caches facts by path and content, so a file that changed is read again and one that
// didn't (a recent conversation, or a file read before a failed refresh) isn't.
function refreshKeys() {
  const keys = new Map();
  return (doc) => {
    if (!keys.has(doc)) keys.set(doc, `${doc.rel}\n${sha1(doc.text).slice(0, 16)}`);
    return keys.get(doc);
  };
}

function pruneFacts(cache, docs, gone, keyOf) {
  const current = new Map(docs.map((doc) => [doc.rel, keyOf(doc)]));
  for (const key of [...cache.keys()]) {
    const cut = typeof key === 'string' ? key.lastIndexOf('\n') : -1;
    if (cut < 0) continue;
    const rel = key.slice(0, cut);
    if (gone.has(rel) || (current.has(rel) && current.get(rel) !== key)) cache.delete(key);
  }
}

// Files that fit in one call go in whole; more than that are read down to facts first.
function planMaterial(docs, ctx, cache, keyOf) {
  const blocks = docs.map((doc) => documentBlock(doc, ctx.today));
  if (sizeOf(blocks) <= BATCH_BYTES) return { docs, blocks, batches: [] };
  return { docs, blocks: null, batches: makeBatches(docs.filter((doc) => !cache.has(keyOf(doc))), ctx.today) };
}

const materialOf = (plan, cache, keyOf) => plan.blocks
  || plan.docs.filter((doc) => cache.get(keyOf(doc))).map((doc) => factsBlock(doc, cache.get(keyOf(doc))));

// docs: new and changed files (at most 400, as in a build); removed: rels gone from the folder;
// renamed: { old rel: new rel } when the integrator matched them; recent: conversations from the
// last 14 days, which Latest activity is rewritten from every time. Material over 150 KB is
// summarised in groups first. factsCache lets a failed refresh resume and spares re-reading
// recent conversations.
async function refreshSummary({ run, summary = '', pins = [], docs = [], removed = [], renamed, recent = [], today, signal, onProgress, factsCache } = {}) {
  const cache = factsCache instanceof Map ? factsCache : new Map();
  const pinList = cleanPins(pins);
  const renames = renameMap(renamed);
  const gone = new Set((Array.isArray(removed) ? removed : []).filter((rel) => typeof rel === 'string' && !renames.has(rel)));
  const { chosen: fresh, leftOut } = pickDocs(docs);
  const freshRels = new Set(fresh.map(byRel));
  const older = pickDocs(usable(recent).filter((doc) => !freshRels.has(doc.rel))).chosen;
  const all = [...fresh, ...older];
  const ctx = context(all, today);
  const current = renameTags(String(summary ?? ''), renames, ctx);
  cite(ctx, sourcesOf(current).filter((s) => s.count || !gone.has(s.rel)));
  const keyOf = refreshKeys();
  pruneFacts(cache, all, new Set([...gone, ...renames.keys()]), keyOf);
  const apply = (diff) => applyDiff(current, diff, pinList, { removed: [...gone], docs: all, today: ctx.today });
  const result = (text) => ({ text, fileCount: fresh.length, leftOut: leftOut.length, leftOutFiles: leftOut.map(byRel) });
  // Nothing new to read: removals and the emptied Latest activity need no call.
  if (!all.length) return result(apply({ latest: [] }));
  const caller = createCaller({ run, signal, onProgress });
  try {
    const plans = [fresh, older].map((list) => planMaterial(list, ctx, cache, keyOf));
    const reading = plans.flatMap((plan) => plan.batches);
    caller.progress.total = reading.length + 1;
    caller.report(reading.length ? 'reading' : 'merging', reading.length ? labelOf(reading[0].docs) : '');
    for (const plan of plans) await readFacts(plan.batches, caller, ctx, cache, keyOf);
    let [news, recents] = plans.map((plan) => materialOf(plan, cache, keyOf));
    // Whole files are under 60 KB each side, so only fact lists ever need condensing; recent
    // conversations keep at least a third of the room.
    if (sizeOf(news) + sizeOf(recents) > MERGE_BYTES) {
      if (!plans[1].blocks) recents = await condense(recents, Math.max(MERGE_BYTES / 3, MERGE_BYTES - sizeOf(news)), caller, ctx, pinList);
      if (!plans[0].blocks) news = await condense(news, MERGE_BYTES - sizeOf(recents), caller, ctx, pinList);
    }
    caller.progress.total = caller.progress.done + 1;
    const prompt = fillTemplate(loadPrompt('project-refresh'), {
      TODAY: dateLabel(ctx.today, ctx.today, { year: true }),
      FROM: dateLabel(ctx.from, ctx.today, { year: true }),
      SUMMARY: numbered(current, pinList, gone, ctx.today),
      DELETED: pinLines(pinList, true),
      REMOVED: gone.size ? [...gone].map((rel) => `- ${rel}`).join('\n') : '(none)',
      NEW: news.join('\n\n') || '(none)',
      RECENT: recents.join('\n\n') || '(none)',
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) caller.progress.total++;
      const diff = readDiff(await caller.call(prompt, 'merging'));
      if (diff) {
        if (signal?.aborted) return { cancelled: true };
        return result(apply(diff));
      }
    }
    throw failure("Promptly couldn't read Claude's changes to the summary", 'parse', caller.progress);
  } catch (err) {
    if (err instanceof Cancelled) return { cancelled: true };
    throw err;
  }
}

// ---- PROMPTLY.md (keepInFolder only) ----

// Always the folder root, never through a link, written whole or not at all.
function promptlyMdPath(project, fsImpl) {
  if (!project?.keepInFolder || typeof project.dir !== 'string' || !project.dir) return null;
  const file = path.join(project.dir, PROMPTLY_MD);
  try {
    if (fsImpl.lstatSync(file).isSymbolicLink()) return null;
  } catch (err) {
    if (err?.code !== 'ENOENT') return null;
  }
  return file;
}

function writePromptlyMd({ project, text, fsImpl = fs } = {}) {
  const file = promptlyMdPath(project, fsImpl);
  if (!file) return false;
  const tmp = path.join(project.dir, `.${PROMPTLY_MD}.${process.pid}.tmp`);
  try {
    fsImpl.writeFileSync(tmp, `# ${oneLine(project.name) || 'Project'}\n${PROMPTLY_NOTE}\n\n${String(text ?? '').trim()}\n`);
    fsImpl.renameSync(tmp, file);
    return true;
  } catch {
    try { fsImpl.unlinkSync(tmp); } catch { /* nothing was written */ }
    return false;
  }
}

// The person's edits to PROMPTLY.md become pins, compared with the summary Promptly last wrote.
// A missing file or one without the sections changes nothing (it isn't "every line deleted").
function readPromptlyMd({ project, stored = '', pins = [], fsImpl = fs } = {}) {
  const file = promptlyMdPath(project, fsImpl);
  let text = '';
  try {
    text = file ? fsImpl.readFileSync(file, 'utf8') : '';
  } catch {
    text = '';
  }
  if (!readSections(text).found) return cleanPins(pins);
  return mergePins(pins, pinsFromEdit(stored, text));
}

module.exports = {
  SECTIONS, estimateCalls, buildSummary, refreshSummary, applyDiff, parseSections, renderSections,
  pinsFromEdit, mergePins, sourcesOf, writePromptlyMd, readPromptlyMd,
};
