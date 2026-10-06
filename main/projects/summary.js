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
// A model's day without a year that lands this far past today is last year's, its year dropped.
const AHEAD_DAYS = 92;
const RUN_OPTIONS = { timeoutMs: 120000, slowWarningMs: 0 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BULLET = /^(?:[-*+•]|\d+[.)])\s+/;
const PLACEHOLDERS = new Set(['none', 'none yet', 'nothing', 'nothing yet', 'nothing useful', 'n a', 'no recent activity', 'not in the files', 'not in the project files']);
const DIFF_KEYS = ['add', 'change', 'retire', 'latest'];
const PROMPTLY_MD = 'PROMPTLY.md';
const PROMPTLY_MD_MAX = 1024 * 1024;
const PROMPTLY_NOTE = '<!-- Written by Promptly. Edit any line: your lines are kept when the summary is refreshed. -->';

class Cancelled extends Error {}

const bytes = (s) => Buffer.byteLength(s, 'utf8');
// Most text is already one tidy line; checking that is cheaper than rebuilding it.
const UNTIDY = /[^\S ]| {2}|^ | $/;
const oneLine = (s) => {
  const text = String(s ?? '');
  return UNTIDY.test(text) ? text.replace(/\s+/g, ' ').trim() : text;
};

// Strips the characters `drop` matches from both ends (`end`, when given, from the end instead).
// A loop, not a regex: an unanchored /[…]+$/ slows to seconds on a long run of them mid-line.
function trimWith(text, drop, end = drop) {
  const s = String(text ?? '');
  let from = 0;
  let to = s.length;
  while (from < to && drop.test(s[from])) from++;
  while (to > from && end.test(s[to - 1])) to--;
  return s.slice(from, to);
}
const pad = (n) => String(n).padStart(2, '0');
const byRel = (doc) => doc.rel;
// Paths compare in one Unicode form (names from older Mac disks are often decomposed, NFD, while a
// model writes them composed, NFC) and without a leading "./".
const relKey = (rel) => String(rel).normalize('NFC').replace(/^\.?\//, '');
const looseKey = (rel) => relKey(rel).toLowerCase();

function relList(value) {
  const list = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return list.filter((rel) => typeof rel === 'string' && rel);
}

// present as a list, a Set, a Map or a manifest object ({ rel: … }); anything else isn't given. An
// empty list beside a summary that cites files is more likely a scan that found nothing (an
// unmounted drive) than an emptied project, so it isn't trusted to retire lines either.
function presentOf(value, summaryText) {
  let list = null;
  if (value instanceof Map) list = [...value.keys()];
  else if (value && typeof value === 'object' && typeof value[Symbol.iterator] === 'function') list = [...value];
  else if (value && typeof value === 'object') list = Object.keys(value);
  const rels = list && list.filter((rel) => typeof rel === 'string' && rel);
  return rels && (rels.length || !sourcesOf(summaryText).length) ? rels : null;
}

// ---- Dates ----

function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isoDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

// An ISO day, a timestamp or a Date → ISO day, or ''.
function dayOf(value) {
  if (typeof value === 'number' || value instanceof Date) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : todayIso(date);
  }
  return isoDay(value);
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-10-04" → "4 Oct 2026". Stored tags always carry the year, so a tag names the same day
// whenever and by whatever it is read; a view may shorten this year's dates for display.
function dateLabel(iso) {
  const day = isoDay(iso);
  const [y, m, d] = day.split('-').map(Number);
  return day && MONTHS[m - 1] ? `${d} ${MONTHS[m - 1]} ${y}` : '';
}

const LABEL = /^(?:(\d{1,2}) ([a-z]{3})[a-z]*|([a-z]{3})[a-z]* (\d{1,2}))(?: (\d{4}))?$/i;

// "4 Oct", "Oct 4", "4 Oct 2025" or "2025-10-04" → an ISO day. Without a year: the latest such
// day not after anchor, or not more than `ahead` days after it.
function labelDay(label, anchor, ahead = 0) {
  const text = oneLine(label).replace(/[.,]/g, '');
  if (isoDay(text)) return isoDay(text);
  const m = LABEL.exec(text);
  const month = m ? MONTHS.findIndex((name) => name.toLowerCase() === (m[2] || m[3]).toLowerCase()) : -1;
  if (month < 0) return '';
  const on = (year) => `${year}-${pad(month + 1)}-${pad(Number(m[1] || m[4]))}`;
  if (m[5]) return on(m[5]);
  const year = Number(anchor.slice(0, 4));
  return on(year) > addDays(anchor, ahead) ? on(year - 1) : on(year);
}

// The date a line starts with ("4 Oct — call"), as Latest activity lines do.
const LEADING = /^(\d{4}-\d{2}-\d{2}|\d{1,2} [a-z]{3,9}\.?(?:,? \d{4})?|[a-z]{3,9}\.? \d{1,2}(?:,? \d{4})?)\b/i;
function leadingDay(body, anchor) {
  const m = LEADING.exec(body);
  return m ? labelDay(m[1], anchor, AHEAD_DAYS) : '';
}

// What a run may cite: its files, plus (on a refresh, via cite) what the current summary already
// cites. folderSize counts each top folder's files when every file in play is known (a build's
// files, or present on a refresh), so counts can be capped and an emptied folder seen. A label
// without a year in a stored summary is read from the day it was written (anchor). gone and lost
// (removed files per top folder) are filled by markGone on a refresh. hashes and bases index known
// so a lookup costs the same however many files the run knows.
function context(docs, today, { complete = false, present = null, writtenOn } = {}) {
  const day = isoDay(today) || todayIso();
  const written = dayOf(writtenOn);
  const ctx = {
    today: day,
    from: addDays(day, -LATEST_DAYS),
    anchor: written && written < day ? written : day,
    byRel: new Map(),
    known: new Map(),
    longest: 0,
    hashes: new Set(),
    bases: new Map(),
    tops: new Map(),
    days: new Map(),
    folderSize: new Map(),
    present: null,
    gone: new Set(),
    lost: new Map(),
  };
  // Where a tag's paths end: find allows the slips findRel allows, exact takes the path as written;
  // a file present in the folder counts too (it may be read, not cited).
  const inFolder = new Map();
  const exact = (rel) => {
    const want = looseKey(oneLine(rel));
    return ctx.known.get(want) || inFolder.get(want) || '';
  };
  ctx.names = { find: (rel) => findRel(rel, ctx, inFolder), exact, ...shapes() };
  for (const doc of docs) ctx.byRel.set(doc.rel, doc);
  cite(ctx, docs.map((doc) => ({ rel: doc.rel })));
  if (present) ctx.present = new Set([...present, ...ctx.byRel.keys()].map(relKey));
  for (const rel of ctx.present || []) {
    inFolder.set(looseKey(rel), rel);
    noteShape(ctx.names, looseKey(rel));
  }
  for (const rel of ctx.present || (complete ? ctx.byRel.keys() : [])) {
    const top = topOf(rel);
    if (top) ctx.folderSize.set(looseKey(top), (ctx.folderSize.get(looseKey(top)) || 0) + 1);
  }
  return ctx;
}

// Every prefix of a tag's text is hashed in one pass to find the known paths it starts with. The
// base is random per process, so no crafted file name can make lookups collide; a hit is still
// checked against the path itself. Modulus below 2^26 and base below 2^20 keep every step exact
// in a double, and floor division is several times faster than %.
const HASH_MOD = 67108859;
const HASH_BASE = 65536 + crypto.randomInt(983040);
function hashStep(hash, code) {
  const next = hash * HASH_BASE + code;
  return next - Math.floor(next / HASH_MOD) * HASH_MOD;
}

function hashOf(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = hashStep(hash, key.charCodeAt(i));
  return hash;
}

const semicolons = (s) => {
  let n = 0;
  for (let i = s.indexOf(';'); i >= 0; i = s.indexOf(';', i + 1)) n++;
  return n;
};

// What reading a tag needs to know about the paths it may name: how many ";" a path (or its file
// name alone) spans, the text before its first ";" (heads), how paths end (tails), and which
// closing brackets a path holds. Without them, a tag's pieces are looked up one by one and only
// its first bracket can end it. memo: splitTags's answers for this set of paths.
const TAIL = 8;
const shapes = () => ({ spans: new Set(), heads: new Set(), tails: new Set(), marks: new Set(), memo: new Map() });
const headOf = (piece) => looseKey(oneLine(piece));
function noteShape(shape, key) {
  for (const part of [key, baseName(key)]) {
    const n = semicolons(part);
    if (!n) continue;
    shape.spans.add(n);
    shape.heads.add(headOf(part.slice(0, part.indexOf(';'))));
  }
  shape.tails.add(key.slice(-TAIL));
  for (const mark of ')]') if (key.includes(mark)) shape.marks.add(mark);
}

function know(ctx, key, rel) {
  if (ctx.known.has(key)) return;
  ctx.known.set(key, rel);
  ctx.longest = Math.max(ctx.longest, key.length);
  ctx.hashes.add(hashOf(key));
  const base = baseName(key);
  if (!ctx.bases.has(base)) ctx.bases.set(base, new Set());
  ctx.bases.get(base).add(rel);
  noteShape(ctx.names, key);
  ctx.names.memo.clear();
}

// A path can reach a prompt with its "<" escaped (neutralise), and a model copies it that way.
function cite(ctx, sources) {
  for (const s of sources) {
    if (s.count) {
      if (!ctx.tops.has(looseKey(s.rel))) ctx.tops.set(looseKey(s.rel), s.rel);
      continue;
    }
    for (const key of [looseKey(s.rel), looseKey(neutralise(s.rel))]) know(ctx, key, s.rel);
    const day = s.date ? labelDay(s.date, ctx.anchor) : '';
    if (day && !ctx.days.has(looseKey(s.rel))) ctx.days.set(looseKey(s.rel), day);
    const top = topOf(s.rel);
    if (top && !ctx.tops.has(looseKey(top))) ctx.tops.set(looseKey(top), top);
  }
}

const docFor = (rel, ctx) => ctx.byRel.get(rel) || ctx.byRel.get(ctx.known.get(looseKey(rel))) || null;
const folderCount = (ctx, folder) => ctx.folderSize.get(looseKey(folder)) || 0;

// What may follow a path in a model's tag: ", 4 Oct", " (from Aparna)", " - note". Text through
// looseKey has only plain spaces.
const AFTER_PATH = new Set([' ', ',', ';', '(', '–', '—', '-']);
const HAS_AFTER_PATH = /[ ,;(–—-]/;

// A tag's path → a path this run knows, or ''. Models sometimes add ", 4 Oct" without the "·"
// (the longest known path before such a mark wins), or drop the folder; both still find the file
// when only one path fits. folder (optional): more paths taken only exactly as written. One pass
// over the text, whatever the number of known paths.
function findRel(text, ctx, folder = null) {
  const want = looseKey(oneLine(text));
  const hit = ctx.known.get(want);
  if (hit) return hit;
  let best = '';
  let hash = 0;
  const upto = HAS_AFTER_PATH.test(want) ? Math.min(want.length, ctx.longest + 1) : 0;
  for (let p = 0; p < upto; p++) {
    if (p && AFTER_PATH.has(want[p]) && ctx.hashes.has(hash)) {
      const rel = ctx.known.get(want.slice(0, p));
      if (rel && rel.length > best.length) best = rel;
    }
    hash = hashStep(hash, want.charCodeAt(p));
  }
  if (!best && !want.includes('/')) {
    const same = ctx.bases.get(want);
    if (same?.size === 1) best = [...same][0];
  }
  return best || folder?.get(want) || '';
}

// ---- Source tags ----

const topOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '');
const isEmail = (rel, ctx) => /\.(eml|mbox)$/i.test(rel) || Boolean(docFor(rel, ctx)?.sender);

function formatSource(source) {
  if (source.count) return `[source: ${source.rel} · ${source.count} ${source.count === 1 ? source.noun.replace(/s$/, '') : source.noun}]`;
  return `[source: ${source.rel}${source.date ? ` · ${source.date}` : ''}]`;
}

const tagFor = (doc) => formatSource({ rel: doc.rel, date: dateLabel(doc.date) });

// "[source: …]" or "(source: …)"; one tag may list several files split by ";".
const OPENER = /[[(]\s*sources?\s*:/gi;
const DATED = new RegExp(String.raw`^·\s*(?:\d{1,2}\s+[a-z]{3,9}\.?(?:,?\s+\d{4})?|[a-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2}|\d+\s+(?:emails?|files?))\s*$`, 'i');
// A date or count ends with a digit, a letter or "." (then maybe spaces); a bracket, ";" or other
// mark can't, which spares the slice for most brackets checked.
const mayEndDate = (code) => code > 127 || code <= 32 || code === 46 || (code >= 48 && code <= 57) || ((code | 32) >= 97 && (code | 32) <= 122);
// Whether text[from, to) ends with "· <date>" or "· N emails", read from its last 64 characters
// only (a date holds no "·", so only the last one there can start it): checking every bracket
// and piece of a long line stays linear.
function endsDated(text, from = 0, to = text.length) {
  if (to <= from || !mayEndDate(text.charCodeAt(to - 1))) return false;
  const end = text.slice(Math.max(from, to - 64), to);
  const dot = end.lastIndexOf('·');
  return dot >= 0 && DATED.test(end.slice(dot));
}
// Paths and counts in one tag (a longer tag is read by dates alone), and how far a tag is read.
const MAX_PIECES = 16;
const MAX_TAG = 1024;
// How many times over its own text a line's path lookups may read it. Past that its tags are read
// by their dates and brackets alone, so no line, however it is written, costs more than a few
// passes.
const LOOKUP_READS = 4;

// names (optional): the run's { find, exact, … }, each rel → the path it knows or ''. A path with
// "·" in it ("Call · Aparna.md") stays whole when it is one the run knows.
function parseSource(part, names) {
  const text = oneLine(part);
  if (!text) return null;
  // The label follows the last "·"; text is one trimmed line, so only plain spaces surround it.
  const dot = text.lastIndexOf('·');
  const rel = dot > 0 ? text.slice(0, dot).trimEnd() : '';
  const label = dot > 0 ? text.slice(dot + 1).trim() : '';
  if (!rel || !label || (names && !endsDated(text) && names.exact(text))) return { rel: text, date: '' };
  const group = /^(\d+)\s+(email|file)s?$/i.exec(label);
  if (group) return { rel, date: '', count: Number(group[1]), noun: `${group[2].toLowerCase()}s` };
  return { rel, date: label };
}

// A path the run knows. A loose match can't reach across a ";" ("a.md; b.md" isn't a.md), and a
// date never holds one. strict (for where a tag ends): the path exactly as written, and a "·" only
// before a date, so a close further on can't swallow the words after a tag ("[source: a.md, 4 Oct] y]").
function isKnown(part, names, strict = false) {
  const s = parseSource(part, names);
  if (!s || s.count || s.date.includes(';')) return false;
  if (strict) return Boolean(names.exact(s.rel)) && (!s.date || endsDated(oneLine(part)));
  const rel = names.find(s.rel);
  return Boolean(rel) && semicolons(s.rel) <= semicolons(rel);
}

// One line's path lookups: each piece of text is looked up once, and all of them together read
// the line at most LOOKUP_READS times over. known → true, false, or null once that is spent (then
// out is set and the rest of the line is read by its dates and brackets alone).
function lookups(names, size) {
  const seen = [new Map(), new Map()];
  let left = LOOKUP_READS * size + 64;
  const reader = {
    // How many ";" a known path spans, most first, then 0 (a piece alone).
    spans: [...names.spans].sort((a, b) => b - a).concat(0),
    heads: names.heads,
    tails: names.tails,
    marks: names.marks,
    out: false,
    // Takes units from what is left; false once it is spent.
    spend(units) {
      left -= units;
      if (left < 0) reader.out = true;
      return !reader.out;
    },
    known(part, strict = false) {
      const memo = seen[strict ? 1 : 0];
      if (memo.has(part)) return memo.get(part);
      if (!reader.spend(part.length + 8)) return null;
      const known = isKnown(part, names, strict);
      memo.set(part, known);
      return known;
    },
  };
  return reader;
}

// A tag's text → one entry per source. File names hold ";" too ("RE; Invoice.eml"), so a ";"
// splits only where every piece is a file the run knows (reader), the longest such reading first so
// a known path stays whole, else only after a piece that ends with its date or file count. Pieces
// are joined only as far as a known path spans, and only from a piece that starts one, so a tag
// costs about one lookup per piece.
function tagParts(content, reader) {
  const text = String(content);
  const ends = [];
  for (let i = text.indexOf(';'); i >= 0; i = text.indexOf(';', i + 1)) ends.push(i);
  if (!ends.length) return [text];
  const starts = [0, ...ends.map((i) => i + 1)];
  ends.push(text.length);
  const n = starts.length;
  const group = (i, j) => text.slice(starts[i], ends[j - 1]);
  const spans = reader && n <= MAX_PIECES ? reader.spans.filter((s) => s < n) : [];
  // Without a "·" no piece ends with a date, so what the run doesn't know stays one source.
  const dated = text.includes('·');
  const parts = [];
  for (let i = 0; i < n;) {
    let j = 0;
    const live = spans.length && !reader.out;
    const opens = live && spans.length > 1 && reader.heads.has(headOf(group(i, i + 1)));
    for (const s of !live ? [] : opens ? spans : [0]) {
      if (i + s < n && reader.known(group(i, i + s + 1))) {
        j = i + s + 1;
        break;
      }
    }
    if (!j) {
      j = dated ? i + 1 : n;
      while (j < n && !endsDated(text, starts[j - 1], ends[j - 1])) j++;
    }
    parts.push(group(i, j));
    i = j;
  }
  return parts;
}

// Whether text[from, to) can end with a path the run knows, judged by its last characters, or with
// a date: a close after anything else isn't looked up. A few more characters than a tail are
// tidied, so an accent split from its letter still lines up.
function mayEndPath(text, from, to, reader) {
  const end = looseKey(oneLine(text.slice(Math.max(from, to - 2 * TAIL), to)));
  for (let k = Math.min(TAIL, end.length); k > 0; k--) if (reader.tails.has(end.slice(-k))) return true;
  return endsDated(text, from, to);
}

// Whether a tag's text names only files the run knows, exactly as written; null when the tag's
// lookups are spent.
function namesOnly(content, reader) {
  const known = tagParts(content, reader).every((part) => reader.known(part, true));
  return reader.out ? null : known;
}

function nextTag(text, from) {
  OPENER.lastIndex = from;
  const m = OPENER.exec(text);
  return m ? { at: m.index, start: m.index + m[0].length, open: m[0][0], close: m[0][0] === '[' ? ']' : ')' } : null;
}

// File names hold brackets ("[EXTERNAL] Re SSO.eml"), so a tag ends where its brackets balance.
// A name with a stray bracket still reads right when its tag ends with a date or a file count. A
// new bracket group opening after the balanced close ("[source: a.md] and [see · 4 Oct]") ends
// the tag at a.md, unless a later dated close is one more than those groups need, as in
// Promptly's own "[source: comms/RE] [EXT] Fee.eml · 8 Oct 2026]". In a run (reader), the
// furthest close whose text names only files the run knows wins; when no known path holds the
// closing bracket, only the first close can. A tag never runs past limit (the end of its line or
// the next tag).
function tagClose(text, tag, limit, lookup) {
  const reader = lookup?.out ? null : lookup;
  let depth = 1;
  let balanced = -1;
  let first = -1;
  let opened = false;
  let close = -1;
  const closes = [];
  // Only a known path holding this bracket can make a later close the tag's end.
  const furthest = Boolean(reader?.marks.has(tag.close));
  // From bracket to bracket, the next of each kind kept, and never searching past limit: the
  // tag's own text is scanned once. Without a "·" in it, no close follows a date.
  const own = text.slice(0, limit);
  const dots = own.indexOf('·', tag.start) >= 0;
  let nextOpen = own.indexOf(tag.open, tag.start);
  let nextClose = own.indexOf(tag.close, tag.start);
  while (nextClose >= 0 || nextOpen >= 0) {
    const isOpen = nextOpen >= 0 && (nextClose < 0 || nextOpen < nextClose);
    const i = isOpen ? nextOpen : nextClose;
    if (isOpen) nextOpen = own.indexOf(tag.open, i + 1);
    else nextClose = own.indexOf(tag.close, i + 1);
    if (isOpen) {
      depth++;
      if (balanced >= 0 && /\s/.test(text[i - 1])) opened = true;
      continue;
    }
    depth--;
    if (reader && (furthest || !closes.length) && i - tag.start <= MAX_TAG) closes.push(i);
    if (close < 0 && !(opened && depth >= 0)) {
      if (dots && endsDated(text, tag.start, i)) close = i;
      else if (!opened) {
        if (first < 0) first = i;
        if (depth === 0 && balanced < 0) balanced = i;
      }
    }
    if (close >= 0 && !(furthest && i - tag.start < MAX_TAG)) break;
  }
  const fallback = close >= 0 ? close : balanced >= 0 ? balanced : first;
  // Otherwise only the first close is tried, and only when the rule above chose another.
  const tries = furthest ? closes.reverse() : closes.slice(0, closes[0] === fallback ? 0 : 1);
  for (const i of tries) {
    if (furthest) {
      if (!reader.spend(2 * TAIL)) break;
      if (!mayEndPath(text, tag.start, i, reader)) continue;
    }
    const known = namesOnly(text.slice(tag.start, i), reader);
    if (known === null) break;
    if (known) return i;
  }
  return fallback;
}

// A line → its words without source tags, and the tags in order. names (optional) lets a tag's
// paths be read against the files the run knows; a run reads the same lines several times, so
// its answers are kept (frozen: shared) until it knows another file.
function splitTags(line, names = null) {
  const text = String(line ?? '');
  const kept = names?.memo?.get(text);
  if (kept) return kept;
  const sources = [];
  const body = [];
  const reader = names && lookups(names, text.length);
  let at = 0;
  let newline = -1;
  let tag = nextTag(text, 0);
  while (tag) {
    if (newline < tag.start) {
      newline = text.indexOf('\n', tag.start);
      if (newline < 0) newline = text.length;
    }
    const after = nextTag(text, tag.start);
    const close = tagClose(text, tag, Math.min(after ? after.at : text.length, newline), reader);
    if (close >= 0) {
      body.push(text.slice(at, tag.at));
      for (const part of tagParts(text.slice(tag.start, close), reader)) {
        const source = parseSource(part, names);
        if (source) sources.push(source);
      }
      at = close + 1;
    }
    tag = after;
  }
  body.push(text.slice(at));
  const result = { body: oneLine(body.join(' ')), sources };
  if (names?.memo) {
    sources.forEach(Object.freeze);
    names.memo.set(text, Object.freeze(Object.assign(result, { sources: Object.freeze(sources) })));
  }
  return result;
}

// The tag as this run knows it (canonical path, the file's own date), or null for a path the run
// never saw: a model can't cite a file into existence. A file the summary already cites keeps the
// date its tag had, whatever date the model wrote.
function resolveSource(source, ctx) {
  if (source.count) {
    const top = ctx.tops.get(looseKey(source.rel));
    const size = top ? folderCount(ctx, top) : 0;
    if (!top || (ctx.present && !size)) return null;
    return { rel: top, date: '', count: Math.min(source.count, size || Infinity), noun: source.noun };
  }
  const rel = findRel(source.rel, ctx);
  if (!rel) return null;
  const doc = ctx.byRel.get(rel);
  const day = doc ? isoDay(doc.date) : ctx.days.get(looseKey(rel)) || labelDay(source.date, ctx.today, AHEAD_DAYS);
  return { rel, date: dateLabel(day), day };
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
    : { rel: top, date: '', count: Math.min(f.count + f.files.length, folderCount(ctx, top) || Infinity), noun: f.emails ? 'emails' : 'files' }));
  return [...grouped, ...loose];
}

// A tag's day: the file's own date when this run has it, else its label read from anchor (the day
// the line was written; a label without a year is the latest such day not after it).
const sourceDay = (s, ctx, anchor = ctx.today) => s.day || isoDay(docFor(s.rel, ctx)?.date) || labelDay(s.date, anchor);

// Canonical tags (path and date from the file itself), each once, at the end of the line.
// recent is judged on the files themselves, before a folder tag hides their dates.
function tidy(line, ctx) {
  const { body, sources } = splitTags(line, ctx.names);
  const seen = new Set();
  const unique = [];
  for (const source of sources) {
    const s = resolveSource(source, ctx);
    const key = s && formatSource(s);
    if (!s || seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  const days = unique.filter((s) => !s.count).map((s) => s.day).filter(Boolean);
  const tags = collapse(unique, ctx).map(formatSource);
  return { text: [body, ...tags].join(' '), sourced: Boolean(body) && tags.length > 0, recent: !days.length || days.some((day) => day >= ctx.from) };
}

// Every source a text cites, once. names: read against the files a run knows (see splitTags), a
// line at a time, so each line has its own lookups.
function sourcesIn(summaryText, names = null) {
  const found = new Map();
  for (const line of names ? String(summaryText ?? '').split('\n') : [summaryText]) {
    for (const s of splitTags(line, names).sources) {
      const key = formatSource(s);
      if (!found.has(key)) found.set(key, s.count ? { rel: s.rel, date: '', count: s.count, noun: s.noun } : { rel: s.rel, date: s.date });
    }
  }
  return [...found.values()];
}

const sourcesOf = (summaryText) => sourcesIn(summaryText);

// For comparing lines: without tags, case, punctuation or spacing. Currency signs, % and the
// vowel signs of Indic scripts stay.
function norm(line) {
  const text = String(line ?? '');
  const keep = remembered.runs > 0;
  let key = keep ? remembered.norms.get(text) : undefined;
  if (key === undefined) {
    key = splitTags(text).body.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Sc}%]+/gu, ' ').trim();
    if (keep && remembered.norms.size < MAX_REMEMBERED) remembered.norms.set(text, key);
  }
  return key;
}

// A build, refresh or edit compares the same lines many times over (pins, sections, the word
// cap), so while one runs norm keeps its answers; they are dropped when the last run ends, and
// never more than MAX_REMEMBERED are kept.
const MAX_REMEMBERED = 100000;
const remembered = { runs: 0, norms: new Map() };

function remembering(fn) {
  const done = () => {
    remembered.runs--;
    if (!remembered.runs) remembered.norms.clear();
  };
  return (...args) => {
    remembered.runs++;
    let result;
    try {
      result = fn(...args);
    } catch (err) {
      done();
      throw err;
    }
    if (typeof result?.then !== 'function') {
      done();
      return result;
    }
    return result.finally(done);
  };
}

// For spotting the person's edits: a fixed capital ("MS Teams") is an edit; a dropped tag,
// spacing or a final full stop isn't.
function editKey(line) {
  return trimWith(splitTags(line).body.normalize('NFC'), /\s/, /[\s.,;:!?…]/);
}

// ---- Sections ----

const simple = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '');
const SIMPLE = SECTIONS.map(simple);
const emptySections = () => Object.fromEntries(SECTIONS.map((name) => [name, []]));
// "1. People", "2) Agreed", "IV. Words", "1 - People", "Section 1: People": models often number
// the headings.
const ENUMERATOR = /^\s*(?:(?:section|part)\s+(?:\d{1,2}|[ivx]{1,4})\s*[.):\-–—]?|(?:\d{1,2}|[ivx]{1,4})[.):]|\d{1,2}\s*[-–—]|\d{1,2}(?=\s+[a-z]))\s*/i;
// Words that only qualify the heading's noun: "Recent decisions" is Agreed, "Project contacts"
// is People; on their own ("Recent", "Project overview") they keep their section.
const QUALIFIERS = ['recent', 'latest', 'project'];

// "## Heading ##" → "Heading"; null for a line that isn't a heading. No regex over the whole line:
// one slowed to seconds on a long run of spaces inside a heading.
function headingText(line) {
  const marks = /^#{1,6}(?=\s)/.exec(line);
  return marks ? trimWith(line.slice(marks[0].length), /\s/, /[\s#]/) : null;
}

// Other headings people (and models) use for the same sections.
const ALIASES = {
  'The project': ['project', 'overview', 'about', 'background'],
  People: ['contacts', 'team', 'stakeholders', 'who s who', 'who is who', 'key people'],
  'How they like to be written to': ['how they like to be written', 'how to write to them', 'writing to them', 'tone', 'style', 'writing style', 'communication', 'how to write', 'preferences'],
  Agreed: ['agreements', 'decisions', 'scope', 'what s agreed', 'what was agreed', 'commitments'],
  'Open right now': ['open', 'currently open', 'right now', 'pending', 'questions', 'to do', 'todo', 'action items', 'next steps', 'waiting on', 'outstanding'],
  'Latest activity': ['latest', 'recent', 'activity', 'updates', 'what s new'],
  Words: ['glossary', 'terms', 'terminology', 'vocabulary', 'acronyms', 'jargon', 'names and terms', 'key terms'],
};

// "## People (both sides)" → People. exact: only the bare name, for "People:" lines.
function sectionNamed(heading, { exact = false } = {}) {
  const h = simple(String(heading ?? '').replace(ENUMERATOR, ''));
  const is = (name) => h === name || (!exact && h.startsWith(`${name} `));
  const qualifier = exact ? '' : QUALIFIERS.find((word) => h.startsWith(`${word} `));
  const noun = qualifier && sectionNamed(h.slice(qualifier.length + 1));
  if (noun) return noun;
  const i = SIMPLE.findIndex(is);
  if (i >= 0) return SECTIONS[i];
  return exact ? null : SECTIONS.find((name) => ALIASES[name].some(is)) || null;
}

const SKIP = /^(?:`{3}|-{3,}$|\*{3,}$|_{3,}$|<!--.*-->$)/;

// Lines under a heading Promptly doesn't know stay with the section above it. Text before the
// first known heading is dropped from a model's answer (a title, a preamble); in the person's own
// edit (preamble) it belongs to The project. A numbered line that is only a section's name
// ("1. The project") is a heading too.
function readSections(text, { preamble = false } = {}) {
  const sections = emptySections();
  let current = preamble ? SECTIONS[0] : null;
  let found = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || SKIP.test(line)) continue;
    const heading = headingText(line);
    const label = heading !== null || (BULLET.test(line) && !/^\d/.test(line)) ? null : sectionNamed(line.replace(/[*_:]/g, ''), { exact: true });
    if (heading !== null || label) {
      const name = label || sectionNamed(heading.replace(/[*_]/g, ''));
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

// at: the day the person wrote the line, which dates a Latest activity line that has no date.
function makePin(section, text, kind, at) {
  const id = crypto.createHash('sha1').update(`${kind}\n${section}\n${norm(text)}`).digest('hex').slice(0, 12);
  return { id, section, text, kind, at };
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
function pinsFromEdit(before, after, { today } = {}) {
  const at = isoDay(today) || todayIso();
  const was = readSections(before, { preamble: true }).sections;
  const now = readSections(after, { preamble: true }).sections;
  const wasAt = placesOf(was, editKey);
  const nowAt = placesOf(now, norm);
  const pins = new Map();
  const add = (pin) => pins.set(pin.id, pin);
  for (const name of SECTIONS) {
    for (const line of now[name]) {
      const key = editKey(line);
      if (key && norm(line) && !wasAt.get(key)?.has(name)) add(makePin(name, line, 'keep', at));
    }
  }
  for (const name of SECTIONS) {
    for (const line of was[name]) {
      const key = norm(line);
      if (key && !nowAt.has(key)) add(makePin(name, line, 'drop', at));
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
  const lines = pins.filter((pin) => isDrop(pin) === drop && oneLine(pin.text)).map((pin) => `- ${neutralise(oneLine(pin.text))}`);
  return lines.length ? lines.join('\n') : '(none)';
}

// ---- Finishing: Latest activity window, pins, word cap ----

// A Latest activity line stays while any of its files is from the window. A line without a dated
// file goes by the date it starts with, else by the day it was written (at); no date at all leaves
// it alone, and so does a folder count on Promptly's own line (it was judged on the files' dates
// before they were collapsed). Dates without a year are read from anchor: today for Promptly's
// lines, the day the person wrote it for theirs (mine), so a pin's "4 Oct" never becomes next year's.
function isRecent(line, ctx, { anchor = ctx.today, at = '', mine = false } = {}) {
  const { body, sources } = splitTags(line, ctx.names);
  let days = sources.filter((s) => !s.count).map((s) => sourceDay(s, ctx, anchor)).filter(Boolean);
  if (!days.length && (mine || !sources.some((s) => s.count))) days = [leadingDay(body, anchor) || isoDay(at)].filter(Boolean);
  return !days.length || days.some((day) => day >= ctx.from);
}

// A pin is read from the day the person wrote it; one from before pins were dated, from the day
// the summary was written.
const pinAnchor = (pin, ctx) => isoDay(pin.at) || ctx.anchor;

// The person's lines in Latest activity are bound by the window too; past it they are left out of
// the summary and of what the model is told to keep.
const livePins = (pins, ctx) => pins.filter((pin) => isDrop(pin) || pinSection(pin) !== LATEST
  || isRecent(pin.text, ctx, { anchor: pinAnchor(pin, ctx), at: pin.at, mine: true }));

const wordCount = (line) => splitTags(line).body.split(/\s+/).filter(Boolean).length;

// The hard cap: whole lines come off the end of the last non-empty section, working back.
// Headings and pinned lines always stay; true when the pinned lines alone still pass the cap.
function capWords(sections, pinned, max) {
  let total = SECTIONS.reduce((sum, name) => sum + sections[name].reduce((n, line) => n + wordCount(line), 0), 0);
  for (let s = SECTIONS.length - 1; s >= 0 && total > max; s--) {
    const lines = sections[SECTIONS[s]];
    for (let i = lines.length - 1; i >= 0 && total > max; i--) {
      if (pinned(lines[i])) continue;
      total -= wordCount(lines[i]);
      lines.splice(i, 1);
    }
  }
  return total > max;
}

// A Latest activity pin past the window goes, and so does a model line saying the same.
function finish(sections, pins, ctx) {
  const live = livePins(pins, ctx);
  const alive = new Set(live);
  const expired = new Set(pins.filter((pin) => !alive.has(pin)).map((pin) => norm(pin.text)));
  const kept = keptPins(live);
  const pinned = (line) => kept.has(norm(line));
  const latest = (sections[LATEST] || []).filter((line) => pinned(line) || (!expired.has(norm(line)) && isRecent(line, ctx)));
  const out = applyPins({ ...sections, [LATEST]: latest }, live);
  const overCap = capWords(out, pinned, MAX_WORDS);
  return { text: render(out), overCap };
}

// ---- Claude calls ----

function failure(message, errorType, progress) {
  return Object.assign(new Error(message || 'Claude CLI error'), { errorType: errorType || 'unknown', done: progress.done, total: progress.total });
}

// Each call is reported as it starts (done = calls finished), so the stage shown is the one
// running; end() sends done === total when the work is finished.
function createCaller({ run, signal, onProgress = () => {} }) {
  const progress = { done: 0, total: 0 };
  const report = (stage, current = '') => {
    try {
      onProgress({ done: progress.done, total: Math.max(progress.total, progress.done), stage, current });
    } catch {
      // A broken progress listener never stops the work.
    }
  };
  async function call(prompt, stage, current = '') {
    if (signal?.aborted) throw new Cancelled();
    report(stage, current);
    let result;
    try {
      result = await run(prompt, { ...RUN_OPTIONS });
    } catch (err) {
      result = { success: false, error: err?.message, errorType: 'unknown' };
    }
    if (result?.cancelled || result?.errorType === 'cancelled') throw new Cancelled();
    if (!result?.success) throw failure(result?.error, result?.errorType, progress);
    progress.done++;
    return String(result.prompt ?? '');
  }
  const end = () => {
    progress.total = progress.done;
    report('merging');
  };
  return { call, end, progress };
}

// ---- Map: files → facts ----

const newestFirst = (a, b) => isoDay(b.date).localeCompare(isoDay(a.date)) || a.rel.localeCompare(b.rel);
// PROMPTLY.md is this summary written into the folder; reading it back as a file would feed the
// summary to itself. A file passed twice is read once, the newest copy.
function usable(docs) {
  const seen = new Set();
  return (Array.isArray(docs) ? docs : [])
    .filter((doc) => typeof doc?.rel === 'string' && doc.rel && doc.rel.toLowerCase() !== PROMPTLY_MD.toLowerCase() && oneLine(doc.text))
    .sort(newestFirst)
    .filter((doc) => !seen.has(doc.rel) && seen.add(doc.rel));
}

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

// Text going into a prompt (files, Claude's own notes, summary lines) can't close or fake the
// prompt's tags. One run of spaces only: two around an optional "/" took seconds on a long run.
const OWN_TAG = /<(?=\s*(?:\/\s*)?(?:documents?|text|path|tag|kind|date|from|title|material|summary|group_summary|new_material|recent_conversations|kept_lines|deleted_lines|removed_files)\b)/gi;
const neutralise = (text) => String(text ?? '').replace(OWN_TAG, '&lt;');

// A shared folder's file names are text from other people too, so they are neutralised as well.
function documentBlock(doc) {
  const head = [
    '<document>',
    `<path>${neutralise(doc.rel)}</path>`,
    `<tag>${neutralise(tagFor(doc))}</tag>`,
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
function makeBatches(docs) {
  const batches = [];
  let batch = null;
  for (const doc of docs) {
    const block = documentBlock(doc);
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

// One cache entry per file version: rel@sha1 when the integrator gives the file's hash, else
// rel@date. A changed file is read again; Rebuild starts from an empty cache.
const factsKey = (doc) => `${doc.rel}@${typeof doc.sha1 === 'string' && doc.sha1 ? doc.sha1 : isoDay(doc.date)}`;

const baseName = (key) => key.slice(key.lastIndexOf('/') + 1);
const trimMarks = (text) => trimWith(text, /[`*"'\s]/, /[`*"':\s]/);
const isBold = (line) => /^(?:\*\*|__)/.test(line) && /(?:\*\*|__):?$/.test(line);
// What models put before a file's path in a heading: "1. ", "File: ", "Document 2 — ".
const FILE_LABEL = /^(?:(?:\d{1,3}|[ivx]{1,4})\s*[.):\-–—]\s+|(?:file|document|doc|path|source)(?:\s+\d{1,3})?\s*[:\-–—]\s*)+/i;

// Whether key appears in text as a whole path, not as part of a longer name.
function mentions(text, key) {
  for (let at = text.indexOf(key); at >= 0; at = text.indexOf(key, at + 1)) {
    const before = at ? text[at - 1] : ' ';
    const after = text.slice(at + key.length, at + key.length + 2);
    if (!/[\p{L}\p{N}/\\._-]/u.test(before) && !/^(?:[\p{L}\p{N}/\\_]|[.-][\p{L}\p{N}])/u.test(after)) return true;
  }
  return false;
}

// Text → the file of this call it names, or null. how: 'path' for a tag's path, which may carry a
// note after it ("comms/a.eml (from Aparna)") or lose its folder when only one file fits; 'whole'
// for a list item that is a file's name and nothing else; 'title' for a line naming a file, maybe
// numbered or labelled ("1. comms/a.eml", "File: comms/a.eml"); 'mention' (headings, bold lines)
// also takes the one file of the call it mentions ("Notes on comms/a.eml"). names: the same files
// as { find, exact } for reading tags.
function docNamer(docs) {
  const names = docs.map((doc) => ({ doc, keys: [...new Set([looseKey(doc.rel), looseKey(neutralise(doc.rel))])] }));
  const exact = (want) => names.find(({ keys }) => keys.includes(want))?.doc || null;
  const near = (want) => {
    const hits = names.filter(({ keys }) => keys.some((key) => want.startsWith(key) && /^[\s·(—–:-]/.test(want.slice(key.length))));
    return hits.length ? hits.sort((a, b) => b.doc.rel.length - a.doc.rel.length)[0].doc : null;
  };
  const base = (want) => {
    const hits = want.includes('/') ? [] : names.filter(({ keys }) => baseName(keys[0]) === want);
    return hits.length === 1 ? hits[0].doc : null;
  };
  function lookup(text, how = 'path') {
    const raw = trimMarks(text);
    for (const variant of how === 'path' ? [raw] : [raw, trimMarks(raw.replace(FILE_LABEL, ''))]) {
      const want = looseKey(variant);
      const doc = exact(want) || (how !== 'whole' && near(want)) || base(want);
      if (doc) return doc;
    }
    if (how !== 'mention') return null;
    const want = looseKey(raw);
    const hits = names.filter(({ keys }) => keys.some((key) => mentions(want, key)));
    if (hits.length) return hits.length === 1 ? hits[0].doc : null;
    const bases = names.filter(({ keys }) => baseName(keys[0]).includes('.') && mentions(want, baseName(keys[0])));
    return bases.length === 1 ? bases[0].doc : null;
  }
  const shape = shapes();
  for (const { keys } of names) for (const key of keys) noteShape(shape, key);
  return { lookup, names: { find: (rel) => lookup(rel)?.rel || '', exact: (rel) => exact(looseKey(oneLine(rel)))?.rel || '', ...shape } };
}

// A facts answer → each file's fact lines. A file counts as answered only when the answer names
// it (a heading or line with its path, or a line tagged with it), "- nothing useful" included; a
// lone file's answer naming nothing counts only when it is "nothing useful", so a refusal is never
// stored as the file's facts. A line tagged with another file of the call belongs to that file,
// whatever heading it sits under. Every line gets its own file's tag, so later steps can trust tags.
function parseFacts(answer, docs) {
  const { lookup, names } = docNamer(docs);
  const facts = new Map();
  const loose = [];
  let current = null;
  for (const raw of String(answer ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const heading = headingText(line);
    const item = BULLET.test(line);
    const named = heading !== null ? lookup(heading, 'mention')
      : item ? lookup(line.replace(BULLET, ''), 'whole')
        : line ? lookup(line, isBold(line) ? 'mention' : 'title') : null;
    if (heading !== null || named) {
      current = named;
      if (current && !facts.has(current)) facts.set(current, []);
      continue;
    }
    if (!item) continue;
    const { body, sources } = splitTags(line.replace(BULLET, ''), names);
    const doc = sources.map((s) => lookup(s.rel)).find(Boolean) || current;
    if (!doc) {
      loose.push(body);
      continue;
    }
    if (!facts.has(doc)) facts.set(doc, []);
    if (body && !PLACEHOLDERS.has(norm(body))) facts.get(doc).push(`- ${neutralise(body)} ${neutralise(tagFor(doc))}`);
  }
  if (docs.length === 1 && !facts.size && loose.length && loose.every((body) => PLACEHOLDERS.has(norm(body)))) facts.set(docs[0], []);
  return new Map([...facts].map(([doc, lines]) => [doc, lines.join('\n')]));
}

// Fills cache (keyOf(doc) → facts, '' for a file with nothing useful). Files an answer skipped get
// one more call each, so one file Claude won't read can't take others with it. Files still
// unanswered are never cached: the run fails with a parse error naming them, and Retry reads only
// those.
async function readFacts(batches, caller, cache, keyOf) {
  const queue = batches.map((batch) => ({ ...batch, again: false }));
  const unread = [];
  while (queue.length) {
    const batch = queue.shift();
    const answer = await caller.call(fillTemplate(loadPrompt('project-facts'), { DOCUMENTS: batch.blocks.join('\n\n') }), 'reading', labelOf(batch.docs));
    const facts = parseFacts(answer, batch.docs);
    for (const [doc, text] of facts) cache.set(keyOf(doc), text);
    const missed = batch.docs.filter((doc) => !facts.has(doc));
    if (!missed.length) continue;
    if (batch.again) {
      unread.push(...missed);
      continue;
    }
    caller.progress.total += missed.length;
    queue.unshift(...missed.map((doc) => ({ docs: [doc], blocks: [documentBlock(doc)], again: true })));
  }
  if (unread.length) {
    throw Object.assign(failure("Promptly couldn't read Claude's notes on some files", 'parse', caller.progress), { files: unread.map(byRel) });
  }
}

const factsBlock = (doc, facts) => `### ${neutralise(doc.rel)} · ${doc.kind || 'unknown'}\n${facts}`;

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

// Newest first, as many blocks as fit; a single block too big on its own is cut to fit.
function fitBlocks(blocks, maxBytes) {
  const kept = [];
  let size = 0;
  for (const block of blocks) {
    const n = bytes(block) + (kept.length ? 2 : 0);
    if (size + n > maxBytes) break;
    kept.push(block);
    size += n;
  }
  return kept.length || !blocks.length ? kept : [fitText(blocks[0], maxBytes)];
}

async function mergeOnce(blocks, words, caller, ctx, pins) {
  const prompt = fillTemplate(loadPrompt('project-merge'), {
    TODAY: dateLabel(ctx.today),
    FROM: dateLabel(ctx.from),
    WORDS: words.toLocaleString('en-US'),
    FACTS: blocks.join('\n\n'),
    KEPT: pinLines(livePins(pins, ctx), false),
    DELETED: pinLines(pins, true),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) caller.progress.total++;
    const answer = readSummary(await caller.call(prompt, 'merging'), ctx);
    if (answer.usable) return answer.sections;
  }
  throw failure("Promptly couldn't read the summary Claude wrote", 'parse', caller.progress);
}

// One round: every group of up to 150 KB becomes a group summary, held to 2,000 words whatever
// the model wrote.
async function mergeGroups(groups, caller, ctx, pins) {
  caller.progress.total += groups.length;
  const parts = [];
  for (const group of groups) {
    const sections = await mergeOnce(group, GROUP_WORDS, caller, ctx, pins);
    capWords(sections, () => false, GROUP_WORDS);
    parts.push(`<group_summary>\n${neutralise(render(sections))}\n</group_summary>`);
  }
  return parts;
}

// Facts too big for one call are merged in groups (newest group first), then the group
// summaries are merged, as many rounds as it takes. A round that doesn't shrink the material
// can't end, so the final call then gets what fits, newest first.
async function mergeAll(blocks, caller, ctx, pins) {
  let level = blocks;
  while (sizeOf(level) > MERGE_BYTES) {
    caller.progress.total = caller.progress.done + 1;
    const next = await mergeGroups(groupBlocks(level, MERGE_BYTES), caller, ctx, pins);
    if (sizeOf(next) >= sizeOf(level)) {
      level = fitBlocks(next, MERGE_BYTES);
      break;
    }
    level = next;
  }
  caller.progress.total = caller.progress.done + 1;
  return finish(await mergeOnce(level, TARGET_WORDS, caller, ctx, pins), pins, ctx);
}

// Shrinks material to fit room by summarising it in groups; if a round doesn't shrink it, keeps
// what fits.
async function condense(blocks, room, caller, ctx, pins) {
  let level = blocks;
  while (level.length && sizeOf(level) > room) {
    const next = await mergeGroups(groupBlocks(level, MERGE_BYTES), caller, ctx, pins);
    if (sizeOf(next) >= sizeOf(level)) return fitBlocks(level, room);
    level = next;
  }
  return level;
}

function estimateCalls(docs) {
  const { chosen } = pickDocs(docs);
  return chosen.length ? makeBatches(chosen).length + 1 : 0;
}

// factsCache (factsKey → facts) lets Retry pick up where a failed or cancelled build stopped.
// pins: the person's lines, kept through a Rebuild. overCap: their lines alone pass 2,500 words.
async function buildSummary({ run, docs = [], onProgress, signal, factsCache, today, pins = [] } = {}) {
  const cache = factsCache instanceof Map ? factsCache : new Map();
  const pinList = cleanPins(pins);
  const { chosen, leftOut } = pickDocs(docs);
  const ctx = context(chosen, today, { complete: true });
  const caller = createCaller({ run, signal, onProgress });
  try {
    pruneFacts(cache, chosen, new Set());
    const batches = makeBatches(chosen.filter((doc) => !cache.has(factsKey(doc))));
    caller.progress.total = batches.length + 1;
    await readFacts(batches, caller, cache, factsKey);
    const blocks = chosen.filter((doc) => cache.get(factsKey(doc))).map((doc) => factsBlock(doc, cache.get(factsKey(doc))));
    const { text, overCap } = blocks.length ? await mergeAll(blocks, caller, ctx, pinList) : finish(emptySections(), pinList, ctx);
    if (signal?.aborted) return { cancelled: true };
    caller.end();
    return { text, overCap, fileCount: chosen.length, leftOut: leftOut.length, leftOutFiles: leftOut.map(byRel) };
  } catch (err) {
    if (err instanceof Cancelled) return { cancelled: true };
    throw err;
  }
}

// ---- Refresh: a JSON diff over the current summary ----

const cleanText = (text) => oneLine(text).replace(BULLET, '').replace(/^(?:\[(?:L\d+[^\]]*|fixed)\]\s*)+/i, '').trim();
const tagsOf = (line, ctx) => splitTags(line, ctx.names).sources.map(formatSource).join(' ');

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

// A stored line's tags with full dates. A label without a year is read from anchor, the day the
// line was written, so the day it names never changes.
function fullDates(line, anchor, names) {
  const { body, sources } = splitTags(line, names);
  if (!sources.length) return line;
  const tags = sources.map((s) => {
    const day = s.count ? '' : labelDay(s.date, anchor);
    return formatSource(day ? { rel: s.rel, date: dateLabel(day) } : s);
  });
  return [body, ...tags].join(' ');
}

// Gone: removed files (renamed ones moved instead), and, when present lists every file the
// summary may rest on, any file the summary cites that isn't there. lost counts the files removed
// from each top folder, which its folder-count tags lose.
function markGone(ctx, text, removed, renames) {
  const dropped = [...new Set(relList(removed).map(relKey))].filter((rel) => !renames.has(rel));
  ctx.gone = new Set(dropped);
  for (const rel of dropped) {
    const top = topOf(rel);
    if (top) ctx.lost.set(looseKey(top), (ctx.lost.get(looseKey(top)) || 0) + 1);
  }
  if (ctx.present) for (const s of sourcesIn(text, ctx.names)) if (!s.count && !ctx.present.has(relKey(s.rel))) ctx.gone.add(relKey(s.rel));
}

// What a folder-count tag still rests on. Promptly doesn't keep which of the folder's files it
// counted, so every file removed from the folder comes off the count (a line may lose a tag it
// still had support for, never keep one it lost); never more than the folder holds now.
function countLeft(s, ctx) {
  const left = s.count - (ctx.lost.get(looseKey(s.rel)) || 0);
  return Math.max(0, ctx.present ? Math.min(left, folderCount(ctx, s.rel)) : left);
}

const isGone = (s, ctx) => (s.count ? countLeft(s, ctx) === 0 : ctx.gone.has(relKey(s.rel)));

// A stored line less its gone sources: their tags come off and folder counts shrink. A line left
// with no source is stale: it goes unless the diff gives it a new one.
function settle(line, ctx) {
  const { body, sources } = splitTags(line, ctx.names);
  const left = sources.filter((s) => !isGone(s, ctx)).map((s) => (s.count ? { ...s, count: countLeft(s, ctx) } : s));
  if (!sources.length || !left.length) return { text: line, stale: sources.length > 0 };
  const same = left.length === sources.length && left.every((s, i) => s.count === sources[i].count);
  return { text: same ? line : [body, ...left.map(formatSource)].join(' '), stale: false };
}

// Ids count the unpinned lines in order; applyChanges numbers them the same way. A stale line is
// marked, so a renamed file's facts can be moved to its new path.
function numbered(summary, pins, ctx) {
  const kept = keptPins(pins);
  const sections = parseSections(summary);
  let n = 0;
  return SECTIONS.map((name) => [`## ${name}`, ...sections[name].map((line) => {
    const pin = kept.get(norm(line));
    if (pin) return `[fixed] ${neutralise(fullDates(line, pinAnchor(pin, ctx), ctx.names))}`;
    const { text, stale } = settle(fullDates(line, ctx.anchor, ctx.names), ctx);
    n++;
    return `[L${n}${stale ? ' · source removed' : ''}] ${neutralise(text)}`;
  })].join('\n')).join('\n\n');
}

function itemsOf(list, key) {
  return (Array.isArray(list) ? list : [])
    .map((item) => (typeof item === 'string' || typeof item === 'number' ? (key ? { [key]: item } : null) : item))
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item));
}

// change and retire find their line by id ("L7", "[L7] …", 7) or by a normalised piece of its
// text, and never touch a pinned line. add never writes to Latest activity. Stale lines go unless
// a change gives them a source this run knows. latest replaces Latest activity (pins aside);
// without it, only lines resting on this run's files stay, so nothing stale is kept.
function applyChanges(text, diff, pinList, ctx) {
  const changes = diff && typeof diff === 'object' && !Array.isArray(diff) ? diff : {};
  const kept = keptPins(livePins(pinList, ctx));
  const parsed = parseSections(text);
  const ids = new Map();
  const sections = {};
  for (const name of SECTIONS) {
    sections[name] = parsed[name].map((line) => {
      const pinned = kept.has(norm(line));
      const entry = { ...(pinned ? { text: line, stale: false } : settle(fullDates(line, ctx.anchor, ctx.names), ctx)), pinned, gone: false };
      if (!pinned) ids.set(ids.size + 1, entry);
      return entry;
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
    const next = bulletFrom(item.text, item.source, ctx) || (line.stale ? '' : bulletFrom(item.text, tagsOf(line.text, ctx), ctx));
    if (next) Object.assign(line, { text: next, stale: false });
  }
  for (const item of itemsOf(changes.retire, 'match')) {
    const line = find(item.match ?? item.id);
    if (line) line.gone = true;
  }
  for (const item of itemsOf(changes.add)) {
    const name = typeof item.section === 'string' ? sectionNamed(item.section) : null;
    const next = name && name !== LATEST ? bulletFrom(item.text, item.source, ctx) : '';
    if (!next || lines().some((line) => !line.stale && norm(line.text) === norm(next))) continue;
    sections[name].push({ text: next, pinned: false, stale: false, gone: false });
  }
  for (const line of lines()) if (line.stale) line.gone = true;
  if (Array.isArray(changes.latest)) {
    const fresh = itemsOf(changes.latest, 'text').map((item) => bulletFrom(item.text, item.source, ctx, { latest: true })).filter(Boolean);
    sections[LATEST] = [...sections[LATEST].filter((line) => line.pinned), ...fresh.map((line) => ({ text: line, pinned: false, gone: false }))];
  } else {
    sections[LATEST] = sections[LATEST].filter((line) => line.pinned || splitTags(line.text, ctx.names).sources.some((s) => !s.count && docFor(s.rel, ctx)));
  }
  const plain = Object.fromEntries(SECTIONS.map((name) => [name, sections[name].filter((line) => !line.gone).map((line) => line.text)]));
  return finish(plain, pinList, ctx);
}

// docs: this run's files (only they and the files the summary cites can be cited); removed: rels
// gone from the folder; present: every file the summary may rest on now; writtenOn: the day
// Promptly last wrote the summary, for tags without a year.
function applyDiffResult(summaryText, diff, pins = [], { removed = [], docs = [], today, present, writtenOn } = {}) {
  const text = String(summaryText ?? '');
  const ctx = context(usable(docs), today, { present: presentOf(present, text), writtenOn });
  markGone(ctx, text, removed, new Map());
  cite(ctx, sourcesIn(text, ctx.names).filter((s) => !isGone(s, ctx)));
  return applyChanges(text, diff, cleanPins(pins), ctx);
}

const applyDiff = (summaryText, diff, pins, options) => applyDiffResult(summaryText, diff, pins, options).text;

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

// { old rel: new rel } (or a Map) from the integrator's manifest diff, keyed by the old path.
function renameMap(renamed) {
  const entries = renamed instanceof Map ? [...renamed] : renamed && typeof renamed === 'object' ? Object.entries(renamed) : [];
  return new Map(entries.filter(([from, to]) => typeof from === 'string' && typeof to === 'string' && from && to && relKey(from) !== relKey(to))
    .map(([from, to]) => [relKey(from), to]));
}

// A moved tag takes the new file's date, else keeps the day its label named.
function renameTags(text, renames, ctx) {
  if (!renames.size) return text;
  return text.split('\n').map((line) => {
    const { body, sources } = splitTags(line, ctx.names);
    if (!sources.some((s) => !s.count && renames.has(relKey(s.rel)))) return line;
    const moved = sources.map((s) => {
      if (s.count || !renames.has(relKey(s.rel))) return s;
      const rel = renames.get(relKey(s.rel));
      return { rel, date: dateLabel(docFor(rel, ctx)?.date) || dateLabel(labelDay(s.date, ctx.anchor)) || s.date };
    });
    return [body, ...moved.map(formatSource)].join(' ');
  }).join('\n');
}

// Drops cached facts for files that are gone or have a newer version in docs.
function pruneFacts(cache, docs, gone) {
  const current = new Map(docs.map((doc) => [doc.rel, factsKey(doc)]));
  for (const key of [...cache.keys()]) {
    const cut = typeof key === 'string' ? key.lastIndexOf('@') : -1;
    if (cut < 0) continue;
    const rel = key.slice(0, cut);
    if (gone.has(relKey(rel)) || (current.has(rel) && current.get(rel) !== key)) cache.delete(key);
  }
}

// Files that fit in one call go in whole; more than that are read down to facts first.
function planMaterial(docs, cache) {
  const blocks = docs.map(documentBlock);
  if (sizeOf(blocks) <= BATCH_BYTES) return { docs, blocks, batches: [] };
  return { docs, blocks: null, batches: makeBatches(docs.filter((doc) => !cache.has(factsKey(doc)))) };
}

const materialOf = (plan, cache) => plan.blocks
  || plan.docs.filter((doc) => cache.get(factsKey(doc))).map((doc) => factsBlock(doc, cache.get(factsKey(doc))));

// docs: new and changed files (at most 400, as in a build); removed: rels gone from the folder;
// renamed: { old rel: new rel } when the integrator matched them; recent: conversations from the
// last 14 days, which Latest activity is rewritten from every time; present: every file the
// summary may rest on now, as a list, Set, Map or manifest object (lets folder-count lines retire
// with their folder); writtenOn: the day Promptly last wrote the summary (ISO day or ms), which
// dates tags without a year (Promptly's own tags always carry one). Material over 150 KB is
// summarised in groups first. factsCache lets a failed refresh resume and spares re-reading
// recent conversations.
async function refreshSummary({ run, summary = '', pins = [], docs = [], removed = [], renamed, recent = [], present, writtenOn, today, signal, onProgress, factsCache } = {}) {
  const cache = factsCache instanceof Map ? factsCache : new Map();
  const pinList = cleanPins(pins);
  const renames = renameMap(renamed);
  const { chosen: fresh, leftOut } = pickDocs(docs);
  const freshRels = new Set(fresh.map(byRel));
  const older = pickDocs(usable(recent).filter((doc) => !freshRels.has(doc.rel))).chosen;
  const all = [...fresh, ...older];
  const ctx = context(all, today, { present: presentOf(present, summary), writtenOn });
  const current = renameTags(String(summary ?? ''), renames, ctx);
  markGone(ctx, current, removed, renames);
  cite(ctx, sourcesIn(current, ctx.names).filter((s) => !isGone(s, ctx)));
  pruneFacts(cache, all, new Set([...ctx.gone, ...renames.keys()]));
  const live = livePins(pinList, ctx);
  const caller = createCaller({ run, signal, onProgress });
  const apply = (diff) => applyChanges(current, diff, pinList, ctx);
  const result = ({ text, overCap }) => {
    caller.end();
    return { text, overCap, fileCount: fresh.length, leftOut: leftOut.length, leftOutFiles: leftOut.map(byRel) };
  };
  // Nothing new to read: removals and the emptied Latest activity need no call.
  if (!all.length) return result(apply({ latest: [] }));
  try {
    const plans = [fresh, older].map((list) => planMaterial(list, cache));
    const reading = plans.flatMap((plan) => plan.batches);
    caller.progress.total = reading.length + 1;
    for (const plan of plans) await readFacts(plan.batches, caller, cache, factsKey);
    let [news, recents] = plans.map((plan) => materialOf(plan, cache));
    // Whole files are under 60 KB each side, so only fact lists ever need condensing; recent
    // conversations keep at least a third of the room.
    if (sizeOf(news) + sizeOf(recents) > MERGE_BYTES) {
      if (!plans[1].blocks) recents = await condense(recents, Math.max(MERGE_BYTES / 3, MERGE_BYTES - sizeOf(news)), caller, ctx, pinList);
      if (!plans[0].blocks) news = await condense(news, MERGE_BYTES - sizeOf(recents), caller, ctx, pinList);
    }
    caller.progress.total = caller.progress.done + 1;
    const shown = new Set(Object.values(parseSections(current)).flat().map(norm));
    const prompt = fillTemplate(loadPrompt('project-refresh'), {
      TODAY: dateLabel(ctx.today),
      FROM: dateLabel(ctx.from),
      SUMMARY: numbered(current, live, ctx),
      KEPT: pinLines(live.filter((pin) => !shown.has(norm(pin.text))), false),
      DELETED: pinLines(pinList, true),
      REMOVED: ctx.gone.size ? [...ctx.gone].map((rel) => `- ${neutralise(rel)}`).join('\n') : '(none)',
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

// The temp file has an unguessable name and is created only if nothing is there yet ('wx'), so a
// link planted in a shared folder can't redirect the write.
function writePromptlyMd({ project, text, fsImpl = fs } = {}) {
  const file = promptlyMdPath(project, fsImpl);
  if (!file) return false;
  const tmp = path.join(project.dir, `.${PROMPTLY_MD}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  try {
    fsImpl.writeFileSync(tmp, `# ${oneLine(project.name) || 'Project'}\n${PROMPTLY_NOTE}\n\n${String(text ?? '').trim()}\n`, { flag: 'wx' });
    fsImpl.renameSync(tmp, file);
    return true;
  } catch (err) {
    if (err?.code !== 'EEXIST') {
      try { fsImpl.unlinkSync(tmp); } catch { /* nothing was written */ }
    }
    return false;
  }
}

// Opened without following a link (O_NOFOLLOW), so a link swapped in after the check can't feed a
// file from outside the folder into the summary, and without waiting (O_NONBLOCK, which regular
// files ignore), so a FIFO named PROMPTLY.md can't freeze the app; a regular file only, ≤ 1 MB.
function readOwnFile(file, fsImpl) {
  let fd = null;
  try {
    fd = fsImpl.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const stat = fsImpl.fstatSync(fd);
    if (!stat.isFile() || stat.size > PROMPTLY_MD_MAX) return '';
    // Windows has no O_NOFOLLOW: also check that what was opened is the file at that path, not
    // a link's target (a link there, or a different file, is refused).
    const here = fsImpl.lstatSync(file);
    if (here.isSymbolicLink() || here.ino !== stat.ino || here.dev !== stat.dev) return '';
    const buf = Buffer.alloc(stat.size);
    let got = 0;
    while (got < buf.length) {
      const n = fsImpl.readSync(fd, buf, got, buf.length - got, got);
      if (!n) break;
      got += n;
    }
    return buf.subarray(0, got).toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== null) try { fsImpl.closeSync(fd); } catch { /* already closed */ }
  }
}

// The person's edits to PROMPTLY.md become pins, compared with the summary Promptly last wrote.
// A missing file or one without the sections changes nothing (it isn't "every line deleted").
function readPromptlyMd({ project, stored = '', pins = [], today, fsImpl = fs } = {}) {
  const file = promptlyMdPath(project, fsImpl);
  const text = file ? readOwnFile(file, fsImpl) : '';
  if (!readSections(text).found) return cleanPins(pins);
  return mergePins(pins, pinsFromEdit(stored, text, { today }));
}

module.exports = {
  SECTIONS,
  estimateCalls,
  buildSummary: remembering(buildSummary),
  refreshSummary: remembering(refreshSummary),
  applyDiff: remembering(applyDiff),
  parseSections,
  renderSections: remembering(renderSections),
  pinsFromEdit: remembering(pinsFromEdit),
  mergePins: remembering(mergePins),
  sourcesOf,
  writePromptlyMd,
  readPromptlyMd: remembering(readPromptlyMd),
};
