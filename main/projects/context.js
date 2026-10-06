'use strict';

const { loadPrompt } = require('../prompts');
const { sourcesOf } = require('./summary');

// What a project request reads (spec D17, E20-22): which output the person asked for, and the
// <project> block placed before their request. Summary first, then for an email the thread it
// answers, then the best search matches, each labelled with its path and date.

const OUTPUTS = ['email', 'prompt', 'polish'];
const PHRASES = {
  email: ['reply to', 'email', 'e-mail', 'write to', 'respond to', 'draft a mail', 'mail to'],
  prompt: ['prompt', 'brief for', 'task for', 'ask claude', 'ask the team to'],
};
const KINDS_FOR = Object.freeze({
  email: Object.freeze(['overview', 'conversations', 'agreements', 'reference']),
  prompt: Object.freeze(['overview', 'build', 'reference', 'agreements']),
  polish: Object.freeze(['overview', 'conversations', 'agreements', 'reference']),
});

const SUMMARY_MAX_BYTES = 12000;
const THREAD_MAX_BYTES = 12000;
const SEARCH_LIMIT = 20;
const EXCERPT_GAP = '\n…\n';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternatives = (list) => list.map((p) => p.split(' ').map(escapeRe).join('\\s+')).join('|');
// Whole words only ("impromptu" isn't "prompt"; a combining mark is part of the word). One
// pattern for both lists, so the phrase said first decides, and the group that matched names it.
const WORD = '[\\p{L}\\p{N}\\p{M}]';
const PHRASE_RE = new RegExp(
  `(?<!${WORD})(?:${Object.entries(PHRASES).map(([output, list]) => `(?<${output}>${alternatives(list)})`).join('|')})(?!${WORD})`,
  'iu',
);

function pickOutput(transcript, defaultOutput) {
  const match = PHRASE_RE.exec(String(transcript ?? ''));
  const said = match && Object.keys(PHRASES).find((output) => match.groups[output] !== undefined);
  if (said) return said;
  return OUTPUTS.includes(defaultOutput) ? defaultOutput : 'prompt';
}

const bytes = (s) => Buffer.byteLength(s, 'utf8');

const ATTR = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\n': '&#10;', '\r': '&#13;', '\t': '&#9;' };
const attr = (value) => String(value ?? '').replace(/[&<>"'\n\r\t]/g, (c) => ATTR[c]);

// File text goes in as written, except that it can't close (or fake) the block's own tags.
const OWN_TAG = /<(?=\s*\/?\s*(?:project|document|thread|summary)\b)/gi;
const neutralise = (text) => String(text ?? '').replace(OWN_TAG, '&lt;');

const element = (tag, { rel, date }, text) => `<${tag} path="${attr(rel)}" date="${attr(date)}">\n${text}\n</${tag}>`;
const sourceOf = ({ rel, date }) => ({ rel, date: String(date ?? '') });

// Context is best effort: a lookup that fails leaves its part out instead of failing the request.
function attempt(fn, fallback) {
  try {
    return fn() ?? fallback;
  } catch {
    return fallback;
  }
}

// A summary line sourced from a file the person left out goes too, so its facts aren't used. Read
// with the summary's own tag parser so both agree on where a path ends. A folder count
// ("comms · 31 emails") rests on other files as well, so it stays.
const citesExcluded = (line, excluded) => sourcesOf(line).some((s) => !s.count && excluded.has(s.rel));

// On a character boundary, at the last space when one is close, so a word or number isn't split.
function cutBytes(text, max) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= max) return text;
  let end = Math.max(0, max);
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  const head = buf.subarray(0, end).toString('utf8');
  const space = head.search(/\s\S*$/);
  return space > 0 && head.length - space < 200 ? head.slice(0, space) : head;
}

const ITEM_START = /^\s*(?:[-*+]\s|\d+[.)]\s|#)/;
const HEADING = /^\s*#/;

// Cut between bullets, so no fact is left half-said and no heading is left with nothing under it.
// With no bullet boundary, the last whole line that fits; with nothing whole that fits under its
// heading, inside the oversized paragraph rather than losing the whole summary.
function capSummary(text, max) {
  if (bytes(text) <= max) return text;
  const lines = text.split('\n');
  let size = -1;
  let fits = 0;
  let keep = 0;
  for (let i = 0; i < lines.length; i++) {
    size += bytes(lines[i]) + 1;
    if (size > max) break;
    fits = i + 1;
    if (ITEM_START.test(lines[i + 1] || '')) keep = i + 1;
  }
  const kept = lines.slice(0, keep || fits);
  while (kept.length && (!kept[kept.length - 1].trim() || HEADING.test(kept[kept.length - 1]))) kept.pop();
  return kept.length ? kept.join('\n') : cutBytes(text, max).trimEnd();
}

// A rendered thread ends with its newest message, so a long one loses its oldest lines.
function keepTail(text, max) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= max) return text;
  let start = buf.length - max;
  const newline = buf.indexOf(0x0a, start - 1);
  if (newline !== -1 && newline + 1 < buf.length) return buf.subarray(newline + 1).toString('utf8');
  while ((buf[start] & 0xc0) === 0x80) start++;
  return buf.subarray(start).toString('utf8');
}

function assembleContext({ name = '', summary = '', transcript = '', output, search, thread, exclude = [], budgetBytes = 30000 } = {}) {
  const out = OUTPUTS.includes(output) ? output : 'prompt';
  const said = String(transcript ?? '');
  // These arrive over IPC: a wrong type must not fail the request or lift the budget.
  const excluded = new Set((Array.isArray(exclude) ? exclude : []).filter((rel) => typeof rel === 'string' && rel));
  const budget = Number.isFinite(budgetBytes) ? Math.max(0, budgetBytes) : 30000;
  const parts = [];
  const sources = [];

  let summaryText = String(summary ?? '');
  if (excluded.size) summaryText = summaryText.split('\n').filter((line) => !citesExcluded(line, excluded)).join('\n');
  summaryText = capSummary(neutralise(summaryText).trim(), SUMMARY_MAX_BYTES);
  if (summaryText) parts.push(`<summary>\n${summaryText}\n</summary>`);

  let threadRel = null;
  const found = out === 'email' && typeof thread === 'function' ? attempt(() => thread(said), null) : null;
  if (typeof found?.rel === 'string' && found.rel && !excluded.has(found.rel)) {
    const text = keepTail(neutralise(found.text).trim(), THREAD_MAX_BYTES);
    if (text) {
      parts.push(element('thread', found, text));
      sources.push(sourceOf(found));
      threadRel = found.rel;
    }
  }

  // Hits come best first. One that doesn't fit is skipped, not cut, and smaller ones after it
  // can still fill the budget.
  const hits = typeof search === 'function' ? attempt(() => search(said, { kinds: KINDS_FOR[out], limit: SEARCH_LIMIT }), []) : [];
  const docs = new Map();
  let spent = 0;
  for (const hit of Array.isArray(hits) ? hits : []) {
    const rel = typeof hit?.rel === 'string' ? hit.rel : '';
    const excerpt = neutralise(hit?.excerpt).trim();
    if (!rel || !excerpt || excluded.has(rel) || rel === threadRel) continue;
    const doc = docs.get(rel);
    const cost = doc ? bytes(EXCERPT_GAP + excerpt) : bytes(element('document', hit, excerpt));
    if ((doc && doc.excerpts.includes(excerpt)) || spent + cost > budget) continue;
    if (doc) doc.excerpts.push(excerpt);
    else docs.set(rel, { hit, excerpts: [excerpt] });
    spent += cost;
  }
  for (const { hit, excerpts } of docs.values()) {
    parts.push(element('document', hit, excerpts.join(EXCERPT_GAP)));
    sources.push(sourceOf(hit));
  }

  const body = [...parts, loadPrompt('project-context')].join('\n\n');
  return { block: `<project name="${attr(name)}">\n${body}\n</project>`, sources };
}

module.exports = { pickOutput, assembleContext, KINDS_FOR };
